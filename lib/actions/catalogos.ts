"use server";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { USOS_DE_CATALOGO } from "@/lib/admin/catalogosMeta";

/**
 * Gestión de los catálogos: las listas que alimentan todos los desplegables.
 *
 * Antes la fuente de verdad era `lib/catalogos.ts` y sincronizarla exigía correr
 * un seed desde la terminal, en modo espejo estricto. Ahora la fuente de verdad
 * es la tabla y el archivo es solo la semilla, así que se puede añadir una
 * opción sin tocar código ni desplegar.
 *
 * `assertAdmin` en cada export: al ser un módulo "use server", todos son
 * endpoints alcanzables por POST directo.
 */

export interface OpcionFila {
  id: number;
  campo: string;
  grupo: string | null;
  valor: string;
  orden: number;
  /** Cuántas fichas usan este valor ahora mismo. Manda antes de borrar. */
  usos?: number;
}

/**
 * Filas afectadas por una sentencia.
 *
 * `db.execute` con el driver de postgres.js devuelve una lista de filas que
 * lleva el total en `.count`; no hay `rowCount` ni `rows`. Leerlo mal no
 * rompía nada, pero informaba siempre de cero fichas afectadas, que engaña más
 * que un error.
 */
function afectadas(resultado: unknown): number {
  return Number((resultado as { count?: number })?.count ?? 0);
}

/** Todas las opciones de un catálogo, en su orden. */
export async function listarCatalogo(campo: string): Promise<OpcionFila[]> {
  await assertAdmin();
  return db
    .select({
      id: s.catalogos.id,
      campo: s.catalogos.campo,
      grupo: s.catalogos.grupo,
      valor: s.catalogos.valor,
      orden: s.catalogos.orden,
    })
    .from(s.catalogos)
    .where(eq(s.catalogos.campo, campo))
    .orderBy(asc(s.catalogos.grupo), asc(s.catalogos.orden), asc(s.catalogos.valor));
}

/**
 * Varias listas de golpe, por nombre de catálogo.
 *
 * Lo usa el panel de conexiones: sus trece desplegables salían fijos del código
 * y ahora vienen de aquí, así que se editan como el resto sin desplegar.
 */
export async function catalogosPorNombre(campos: string[]): Promise<Record<string, string[]>> {
  await assertAdmin();
  const out: Record<string, string[]> = {};
  for (const c of campos) out[c] = [];
  if (campos.length === 0) return out;
  const filas = await db
    .select({ campo: s.catalogos.campo, valor: s.catalogos.valor })
    .from(s.catalogos)
    .where(inArray(s.catalogos.campo, campos))
    .orderBy(asc(s.catalogos.orden), asc(s.catalogos.valor));
  for (const f of filas) (out[f.campo] ??= []).push(f.valor);
  return out;
}

/** Los catálogos que existen, con cuántas opciones tiene cada uno. */
export async function listarCampos(): Promise<{ campo: string; opciones: number; grupos: number }[]> {
  await assertAdmin();
  const filas = await db
    .select({
      campo: s.catalogos.campo,
      opciones: sql<number>`count(*)::int`,
      grupos: sql<number>`count(distinct ${s.catalogos.grupo})::int`,
    })
    .from(s.catalogos)
    .groupBy(s.catalogos.campo)
    .orderBy(asc(s.catalogos.campo));
  return filas;
}

/**
 * Añade una opción. Es lo que llama el "añadir al vuelo" de los desplegables:
 * escribes un valor que no está y queda disponible para todas las fichas.
 * Idempotente: si ya existe, devuelve la que hay.
 */
export async function crearOpcion(campo: string, valor: string, grupo: string | null = null): Promise<void> {
  await assertAdmin();
  const v = valor.trim();
  if (!campo.trim() || !v) return;

  const [ya] = await db
    .select({ id: s.catalogos.id })
    .from(s.catalogos)
    .where(
      and(
        eq(s.catalogos.campo, campo),
        eq(s.catalogos.valor, v),
        grupo === null ? isNull(s.catalogos.grupo) : eq(s.catalogos.grupo, grupo),
      ),
    )
    .limit(1);
  if (ya) return;

  // Al final de su grupo, que es donde el usuario espera encontrar lo que acaba
  // de escribir.
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${s.catalogos.orden}), -1)` })
    .from(s.catalogos)
    .where(
      and(eq(s.catalogos.campo, campo), grupo === null ? isNull(s.catalogos.grupo) : eq(s.catalogos.grupo, grupo)),
    );

  await db.insert(s.catalogos).values({ campo, valor: v, grupo, orden: Number(max) + 1 });
  revalidatePath("/admin/catalogos");
}

/**
 * Renombra una opción y arrastra el valor en las fichas que la usaban.
 *
 * Sin el arrastre, renombrar dejaría huérfanas todas las fichas con el valor
 * viejo: el desplegable las mostraría en blanco. Por eso hace falta saber en qué
 * columnas se usa cada catálogo (`USOS_DE_CATALOGO`).
 */
export async function renombrarOpcion(id: number, nuevoValor: string): Promise<{ fichas: number }> {
  await assertAdmin();
  const v = nuevoValor.trim();
  if (!v) return { fichas: 0 };

  const [fila] = await db.select().from(s.catalogos).where(eq(s.catalogos.id, id)).limit(1);
  if (!fila || fila.valor === v) return { fichas: 0 };

  let fichas = 0;
  for (const [tabla, columna] of USOS_DE_CATALOGO[fila.campo] ?? []) {
    const r = await db.execute(
      sql`update ${sql.identifier(tabla)} set ${sql.identifier(columna)} = ${v}
          where ${sql.identifier(columna)} = ${fila.valor}`,
    );
    fichas += afectadas(r);
  }

  await db.update(s.catalogos).set({ valor: v }).where(eq(s.catalogos.id, id));
  revalidatePath("/admin/catalogos");
  return { fichas };
}

/** Cambia el orden en que aparecen las opciones del desplegable. */
export async function reordenarOpciones(ids: number[]): Promise<void> {
  await assertAdmin();
  if (ids.length === 0) return;
  // Una sola sentencia: uno por fila serían N viajes a la base.
  const valores = sql.join(
    ids.map((id, i) => sql`(${id}::int, ${i}::int)`),
    sql`, `,
  );
  await db.execute(
    sql`update catalogos c set orden = v.orden from (values ${valores}) as v(id, orden) where c.id = v.id`,
  );
  revalidatePath("/admin/catalogos");
}

/** Cuántas fichas usan una opción. Se consulta antes de ofrecer borrarla. */
export async function contarUsos(id: number): Promise<number> {
  await assertAdmin();
  const [fila] = await db.select().from(s.catalogos).where(eq(s.catalogos.id, id)).limit(1);
  if (!fila) return 0;

  let total = 0;
  for (const [tabla, columna] of USOS_DE_CATALOGO[fila.campo] ?? []) {
    const r = await db.execute(
      sql`select count(*)::int as n from ${sql.identifier(tabla)} where ${sql.identifier(columna)} = ${fila.valor}`,
    );
    total += Number((r as unknown as { n: number }[])[0]?.n ?? 0);
  }
  return total;
}

/**
 * Borra una opción. Las fichas que la usaban se quedan con el campo vacío, y el
 * panel las marca como incompletas: es preferible a dejar un valor que el
 * desplegable ya no reconoce y muestra en blanco sin explicar por qué.
 */
export async function borrarOpcion(id: number): Promise<{ fichas: number }> {
  await assertAdmin();
  const [fila] = await db.select().from(s.catalogos).where(eq(s.catalogos.id, id)).limit(1);
  if (!fila) return { fichas: 0 };

  let fichas = 0;
  for (const [tabla, columna] of USOS_DE_CATALOGO[fila.campo] ?? []) {
    const r = await db.execute(
      sql`update ${sql.identifier(tabla)} set ${sql.identifier(columna)} = null
          where ${sql.identifier(columna)} = ${fila.valor}`,
    );
    fichas += afectadas(r);
  }

  await db.delete(s.catalogos).where(eq(s.catalogos.id, id));
  revalidatePath("/admin/catalogos");
  return { fichas };
}

/** Para el verificador: qué columnas dice el código que alimenta cada catálogo. */
export async function usosDeclarados(): Promise<Record<string, [string, string][]>> {
  await assertAdmin();
  return USOS_DE_CATALOGO;
}
