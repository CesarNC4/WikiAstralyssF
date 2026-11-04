import "server-only";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { moldeDe } from "@/lib/propuestas/moldes";
import { infoDe } from "@/lib/relaciones/tablas";
import { CAMPOS_LIGADOS, MARCA_OCULTO, OCULTOS_POR_DEFECTO, censurar, ocultoPorDefecto, type ConOcultos } from "@/lib/visibilidad";

/**
 * Visibilidad por campo. Permite ocultar al público un dato concreto de una
 * ficha sin borrarlo: la fecha de nacimiento de un personaje, el paradero de un
 * artefacto, el desenlace de una misión.
 *
 * La ausencia de fila significa visible (salvo `OCULTOS_POR_DEFECTO`), así que una
 * wiki sin nada marcado no paga ningún coste más allá de una consulta que casi
 * siempre vuelve vacía.
 */

function aplicarMarcas(entidad: string, filas: { campo: string; visible: boolean }[]): Set<string> {
  const ocultos = new Set<string>(OCULTOS_POR_DEFECTO[entidad] ?? []);
  for (const f of filas) {
    if (f.visible) {
      ocultos.delete(f.campo);
      continue;
    }
    ocultos.add(f.campo);
    for (const ligado of CAMPOS_LIGADOS[entidad]?.[f.campo] ?? []) ocultos.add(ligado);
  }
  return ocultos;
}

/** Campos ocultos de una ficha. */
export async function camposOcultos(entidadTipo: string, entidadId: number): Promise<Set<string>> {
  if (!entidadId) return new Set();
  const filas = await db
    .select({ campo: s.campoVisibilidad.campo, visible: s.campoVisibilidad.visible })
    .from(s.campoVisibilidad)
    .where(and(eq(s.campoVisibilidad.entidadTipo, entidadTipo), eq(s.campoVisibilidad.entidadId, entidadId)));
  return aplicarMarcas(entidadTipo, filas);
}

/** Campos ocultos de varias fichas de golpe, por id. Toda ficha pedida tiene entrada. */
export async function camposOcultosDe(entidadTipo: string, ids: number[]): Promise<Map<number, Set<string>>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  const out = new Map<number, Set<string>>();
  if (unicos.length === 0) return out;
  const filas = await db
    .select({ id: s.campoVisibilidad.entidadId, campo: s.campoVisibilidad.campo, visible: s.campoVisibilidad.visible })
    .from(s.campoVisibilidad)
    .where(and(eq(s.campoVisibilidad.entidadTipo, entidadTipo), inArray(s.campoVisibilidad.entidadId, unicos)));
  const porFicha = new Map<number, { campo: string; visible: boolean }[]>();
  for (const f of filas) (porFicha.get(f.id) ?? porFicha.set(f.id, []).get(f.id)!).push(f);
  for (const id of unicos) out.set(id, aplicarMarcas(entidadTipo, porFicha.get(id) ?? []));
  return out;
}

/** Lo que identifica a una ficha no se oculta: quedaría sin título y sin URL. */
const INTOCABLES = new Set(["id", "slug", "estadoPublicacion", "eliminadoEn", "creadoEn", "actualizadoEn", "publicadoPrimeraVezEn"]);

/**
 * Qué deja un campo oculto: la marca en los de texto, también si están vacíos; null
 * en los que no pueden llevar texto (números, sí/no, imágenes, referencias), que la
 * ficha marca aparte con `conMarca`. Los que nacen ocultos, vacíos, no dejan nada.
 */
function valorOculto(entidad: string, campo: string, valor: unknown): unknown {
  if (ocultoPorDefecto(entidad, campo) && (valor == null || valor === "")) return null;
  if (typeof valor === "number" || typeof valor === "boolean") return null;
  if (/(Url|Id)$/.test(campo)) return null;
  const tipo = moldeDe(entidad)?.campos.find((c) => c.name === campo)?.tipo;
  if (tipo === "numero" || tipo === "si-no" || tipo === "ficha") return null;
  if (tipo === "lista" || Array.isArray(valor)) return [MARCA_OCULTO];
  return MARCA_OCULTO;
}

/** Enmascara una fila con sus campos ocultos ya conocidos. */
export function ocultarCampos<T extends object>(entidad: string, fila: T, ocultos: Set<string> | undefined): T {
  const censurada = censurar(fila) as Record<string, unknown>;
  if (!ocultos || ocultos.size === 0) return censurada as T;
  const nombre = infoDe(entidad)?.label;
  const nombres: string[] = [];
  for (const campo of ocultos) {
    if (INTOCABLES.has(campo) || campo === nombre) continue;
    nombres.push(campo);
    if (campo in censurada) censurada[campo] = valorOculto(entidad, campo, censurada[campo]);
  }
  (censurada as ConOcultos)._ocultos = nombres;
  return censurada as T;
}

/**
 * Devuelve la fila tal y como la puede ver el público. Se reemplaza el valor en
 * lugar de eliminar la clave para no romper el tipo con el que trabajan las fichas.
 */
export async function aplicarVisibilidad<T extends Record<string, unknown>>(
  entidadTipo: string,
  fila: T | undefined,
): Promise<T | undefined> {
  if (!fila) return fila;
  const id = Number(fila.id);
  if (!id) return censurar(fila);
  return ocultarCampos(entidadTipo, fila, await camposOcultos(entidadTipo, id));
}

/**
 * Lo mismo para una lista de fichas (tarjetas, enlaces): aquí lo oculto se vacía
 * sin dejar marca, porque es un dato secundario de una fila que se ve entera en su
 * ficha. `alias` traduce los nombres de la consulta a los de la columna.
 */
export async function ocultarEnLista<T extends object>(
  entidad: string,
  filas: T[],
  { idDe = "id", alias = {} }: { idDe?: string; alias?: Record<string, string> } = {},
): Promise<T[]> {
  const leer = (f: T) => Number((f as Record<string, unknown>)[idDe]);
  const ocultos = await camposOcultosDe(entidad, filas.map(leer));
  return filas.map((f) => {
    const copia = censurar(f) as Record<string, unknown>;
    const marcados = ocultos.get(leer(f));
    if (!marcados?.size) return copia as T;
    const nombre = infoDe(entidad)?.label;
    for (const clave of Object.keys(copia)) {
      const columna = alias[clave] ?? clave;
      if (clave !== idDe && columna !== nombre && marcados.has(columna)) copia[clave] = null;
    }
    return copia as T;
  });
}

/** Una fila cuya conexión está oculta: sin nada que la identifique ni enlace. */
export function filaOculta<T extends object>(fila: T, nombre = "nombre", idDe = "id"): T {
  const copia = { ...fila } as Record<string, unknown>;
  for (const k of Object.keys(copia)) {
    if (k === "oculto") continue;
    copia[k] = typeof copia[k] === "boolean" ? false : null;
  }
  copia[idDe] = 0;
  copia[nombre] = MARCA_OCULTO;
  return copia as T;
}

/** Enmascara las filas de una lista con `oculto = true`. */
export function ocultarFilas<T extends { oculto: boolean }>(filas: T[], nombre = "nombre", idDe = "id"): T[] {
  return filas.map((f) => (f.oculto ? filaOculta(f, nombre, idDe) : f));
}

/**
 * Marca u oculta un campo y actualiza el buscador, que deja fuera lo oculto. La
 * ausencia de fila significa visible, salvo en los campos que nacen ocultos: ahí
 * revelar guarda una fila con `visible = true`.
 *
 * Sin `assertAdmin`: quien la llame desde una Server Action lo ha comprobado ya.
 */
export async function escribirCampoOculto(entidadTipo: string, entidadId: number, campo: string, visible: boolean): Promise<void> {
  const filtro = and(
    eq(s.campoVisibilidad.entidadTipo, entidadTipo),
    eq(s.campoVisibilidad.entidadId, entidadId),
    eq(s.campoVisibilidad.campo, campo),
  );
  // Sin fila vale lo de por defecto: oculto en los que nacen ocultos, visible en el resto.
  if (visible === !ocultoPorDefecto(entidadTipo, campo)) {
    await db.delete(s.campoVisibilidad).where(filtro);
  } else {
    await db
      .insert(s.campoVisibilidad)
      .values({ entidadTipo, entidadId, campo, visible })
      .onConflictDoUpdate({
        target: [s.campoVisibilidad.entidadTipo, s.campoVisibilidad.entidadId, s.campoVisibilidad.campo],
        set: { visible },
      });
  }
  await reindexar(entidadTipo, entidadId);
}

/** Reescribe la fila sin cambiarla: el trigger del buscador la vuelve a indexar. */
export async function reindexar(entidadTipo: string, entidadId: number): Promise<void> {
  const info = infoDe(entidadTipo);
  if (!info) return;
  const c = getTableColumns(info.tabla) as unknown as Record<string, PgColumn>;
  await db.update(info.tabla).set({ id: sql`${c.id}` } as never).where(eq(c.id, entidadId));
}

/**
 * Fichas que apuntan a otra por una referencia oculta (quien nació aquí, las
 * sub-razas…): salen como marca en la lista del otro extremo.
 */
export async function ocultarPorReferencia<T extends { id: number }>(entidad: string, filas: T[], columnas: string[], nombre = "nombre"): Promise<T[]> {
  const ocultos = await camposOcultosDe(entidad, filas.map((f) => f.id));
  return filas.map((f) => (columnas.some((c) => ocultos.get(f.id)?.has(c)) ? filaOculta(f, nombre) : f));
}
