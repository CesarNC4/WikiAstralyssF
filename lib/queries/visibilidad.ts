import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/**
 * Visibilidad por campo. Permite ocultar al público un dato concreto de una
 * ficha sin borrarlo: la fecha de nacimiento de un personaje, el paradero de un
 * artefacto, el desenlace de una misión.
 *
 * La ausencia de fila significa visible, así que una wiki sin nada marcado no
 * paga ningún coste más allá de una consulta que casi siempre vuelve vacía.
 */

/** Campos marcados como ocultos para una ficha. */
export async function camposOcultos(entidadTipo: string, entidadId: number): Promise<Set<string>> {
  if (!entidadId) return new Set();
  const filas = await db
    .select({ campo: s.campoVisibilidad.campo })
    .from(s.campoVisibilidad)
    .where(
      and(
        eq(s.campoVisibilidad.entidadTipo, entidadTipo),
        eq(s.campoVisibilidad.entidadId, entidadId),
        eq(s.campoVisibilidad.visible, false),
      ),
    );
  return new Set(filas.map((f) => f.campo));
}

/**
 * Devuelve la fila con los campos ocultos puestos a null.
 *
 * Se vacían en lugar de eliminarlos para no romper el tipo con el que trabajan
 * las fichas: los componentes ya saben no pintar un campo nulo, que es
 * exactamente el comportamiento que se busca.
 *
 * Nunca se toca `id` ni los campos de identidad: ocultar el nombre dejaría una
 * ficha sin título y con una URL que no lleva a ninguna parte.
 */
const INTOCABLES = new Set(["id", "nombre", "titulo", "slug", "estadoPublicacion", "eliminadoEn"]);

export async function aplicarVisibilidad<T extends Record<string, unknown>>(
  entidadTipo: string,
  fila: T | undefined,
): Promise<T | undefined> {
  if (!fila) return fila;
  const id = Number(fila.id);
  if (!id) return fila;

  const ocultos = await camposOcultos(entidadTipo, id);
  if (ocultos.size === 0) return fila;

  const copia = { ...fila } as Record<string, unknown>;
  for (const campo of ocultos) {
    if (INTOCABLES.has(campo)) continue;
    if (campo in copia) copia[campo] = null;
  }
  return copia as T;
}
