import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { db } from "@/db/client";
import { TABLAS_GRUPO, cols } from "@/lib/propuestas/listasDb";
import type { FaccionRow, IdsNuevos, JerarquiaRow, RangoRow, SubfilasConocidas } from "@/lib/admin/complejas";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface FilaDeseada {
  key: string;
  id?: number;
  valores: Record<string, unknown>;
}

const nz = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** La lista de ids que manda el formulario, sin fiarse de lo que llegue. */
const ids = (v: unknown): number[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : undefined;

/**
 * Una lista de filas de un grupo, por diferencias: la fila con id se actualiza (solo las
 * columnas de `valores`), la nueva se inserta, y se borra solo lo que el formulario
 * conocía y ya no manda. Devuelve el id de cada fila por su clave de cliente, y anota en
 * `nuevos` las insertadas.
 */
async function sincronizar(
  tx: Tx,
  tabla: PgTable,
  fk: string,
  ownerId: number,
  filas: FilaDeseada[],
  conocidos: number[] | undefined,
  nuevos: Record<string, number>,
  antesDeBorrar?: (fuera: number[]) => Promise<void>,
): Promise<Map<string, number>> {
  const c = cols(tabla);
  const existentes = new Set(
    (await tx.select({ id: c.id }).from(tabla).where(eq(c[fk], ownerId))).map((f) => Number(f.id)),
  );
  const porClave = new Map<string, number>();
  const usados = new Set<number>();
  for (const f of filas) {
    if (f.id != null && existentes.has(f.id) && !usados.has(f.id)) {
      await tx.update(tabla).set(f.valores as never).where(eq(c.id, f.id));
      usados.add(f.id);
      porClave.set(f.key, f.id);
    } else {
      const [ins] = (await tx
        .insert(tabla)
        .values({ ...f.valores, [fk]: ownerId } as never)
        .returning({ id: c.id })) as { id: number }[];
      usados.add(ins.id);
      porClave.set(f.key, ins.id);
      nuevos[f.key] = ins.id;
    }
  }
  // Un formulario abierto antes de que existiera la lista conocía todo lo que había.
  const conocia = conocidos ? new Set(conocidos) : existentes;
  const fuera = [...existentes].filter((id) => !usados.has(id) && conocia.has(id));
  if (fuera.length) {
    await antesDeBorrar?.(fuera);
    await tx.delete(tabla).where(inArray(c.id, fuera));
  }
  return porClave;
}

/**
 * Rangos, facciones y miembros de una organización, una familia o el gremio, tal como
 * los manda su formulario.
 *
 * Antes se borraba todo y se reinsertaba. Así se perdían las columnas que el formulario
 * no enseña (el rol, el tipo y la descripción de un miembro de una organización, que
 * escriben la ficha del personaje, el panel de conexiones y la bandeja) y los miembros
 * añadidos desde otra ficha mientras el formulario estaba abierto.
 *
 * `propios` da las columnas de cada variante: el título o apodo, o los títulos de la familia.
 */
export async function guardarGrupo(
  tx: Tx,
  entidad: "organizaciones" | "familias" | "gremio",
  ownerId: number,
  datos: { rangos: RangoRow[]; facciones: FaccionRow[]; jerarquia: JerarquiaRow[]; conocidos?: SubfilasConocidas },
  propios: (j: JerarquiaRow) => Record<string, unknown>,
): Promise<IdsNuevos> {
  const g = TABLAS_GRUPO[entidad];
  const j = cols(g.jerarquia);
  const nuevos: IdsNuevos = { rangos: {}, facciones: {}, jerarquia: {} };
  const conocidos = datos.conocidos;

  // Peso por posición: arriba, mayor.
  const rangos = datos.rangos.filter((r) => r.nombre.trim());
  const rangoDe = await sincronizar(
    tx,
    g.rangos,
    g.fk,
    ownerId,
    rangos.map((r, i) => ({ key: r.key, id: r.id, valores: { nombre: r.nombre.trim(), peso: rangos.length - i } })),
    ids(conocidos?.rangos),
    nuevos.rangos,
    async (fuera) => {
      await tx.update(g.jerarquia).set({ rangoId: null } as never).where(inArray(j.rangoId, fuera));
    },
  );

  const faccionDe = await sincronizar(
    tx,
    g.facciones,
    g.fk,
    ownerId,
    datos.facciones
      .filter((f) => f.nombre.trim())
      .map((f) => ({ key: f.key, id: f.id, valores: { nombre: f.nombre.trim(), color: nz(f.color) } })),
    ids(conocidos?.facciones),
    nuevos.facciones,
    async (fuera) => {
      await tx.update(g.jerarquia).set({ faccionId: null } as never).where(inArray(j.faccionId, fuera));
    },
  );

  await sincronizar(
    tx,
    g.jerarquia,
    g.fk,
    ownerId,
    datos.jerarquia
      .filter((m) => m.personajeId != null || m.nombre.trim())
      .map((m, i) => ({
        key: m.key,
        id: m.id,
        valores: {
          personajeId: m.personajeId,
          nombre: m.personajeId == null ? nz(m.nombre) : null,
          rangoId: m.rangoKey ? (rangoDe.get(m.rangoKey) ?? null) : null,
          faccionId: m.faccionKey ? (faccionDe.get(m.faccionKey) ?? null) : null,
          orden: i,
          ...propios(m),
        },
      })),
    ids(conocidos?.jerarquia),
    nuevos.jerarquia,
  );

  return nuevos;
}
