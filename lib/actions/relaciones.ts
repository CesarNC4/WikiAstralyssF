"use server";

import { revalidatePath } from "next/cache";
import { asc, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db/client";
import { assertAdmin } from "@/lib/actions/auth";
import { getRelTableDef } from "@/lib/admin/relacionesTables";
import type { RelacionRow } from "@/lib/admin/relaciones";

/**
 * Sub-listas de texto de una ficha (hoy sólo los usos de un mineral). Las
 * relaciones entre fichas no pasan por aquí: viven en `lib/actions/vinculos.ts`
 * y se guardan por diferencias para poder editarse desde los dos extremos.
 *
 * Aquí sí se reescribe el bloque entero, y es correcto: nadie más escribe en
 * estas filas, así que no hay otro lado al que pisar.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cols = Record<string, any>;

/** Lee las filas de una sub-lista. */
export async function getRelacion(entidad: string, relKey: string, ownerId: number): Promise<RelacionRow[]> {
  await assertAdmin();
  const def = getRelTableDef(entidad, relKey);
  if (!def) return [];
  const c = getTableColumns(def.table) as Cols;
  const orderCol = def.orden ? c.orden : c.id;
  const rows = (await db
    .select()
    .from(def.table)
    .where(eq(c[def.ownerCol], ownerId))
    .orderBy(asc(orderCol))) as Cols[];

  return rows.map((r) => {
    const campos: Record<string, string> = {};
    for (const col of def.libreCols) campos[col] = r[col] == null ? "" : String(r[col]);
    return { campos };
  });
}

/** Reescribe por completo la sub-lista de una ficha. */
export async function setRelacion(
  entidad: string,
  relKey: string,
  ownerId: number,
  rows: RelacionRow[],
  revalidar?: string,
): Promise<RelacionRow[]> {
  await assertAdmin();
  const def = getRelTableDef(entidad, relKey);
  if (!def || !ownerId) return [];
  const c = getTableColumns(def.table) as Cols;

  await db.delete(def.table).where(eq(c[def.ownerCol], ownerId));

  // La primera columna es la que da nombre a la fila: sin ella no hay nada que
  // guardar y la fila se descarta.
  const principal = def.libreCols[0];
  const limpio = rows.filter((r) => (r.campos[principal] ?? "").trim() !== "");

  if (limpio.length > 0) {
    const values = limpio.map((r, i) => {
      const v: Cols = { [def.ownerCol]: ownerId };
      for (const col of def.libreCols) {
        const raw = (r.campos[col] ?? "").trim();
        v[col] = raw === "" ? null : raw;
      }
      if (def.orden) v.orden = i;
      return v;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(def.table).values(values as any);
  }

  if (revalidar) revalidatePath(revalidar);
  return getRelacion(entidad, relKey, ownerId);
}
