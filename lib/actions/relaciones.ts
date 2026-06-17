"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, getTableColumns, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { assertAdmin } from "@/lib/actions/auth";
import { getRelTableDef } from "@/lib/admin/relacionesTables";
import type { RelacionRow, RelTargetSource } from "@/lib/admin/relaciones";
import { naciones, razas, minerales, bestias, armasArtefactos } from "@/db/schema/mundo";
import { regiones } from "@/db/schema/mapa";
import { elementos } from "@/db/schema/elementos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cols = Record<string, any>;

export interface OpcionRel {
  id: number;
  label: string;
}

/** Opciones para el selector objetivo de un bloque de relación. */
export async function getOpcionesRelacion(source: RelTargetSource): Promise<OpcionRel[]> {
  await assertAdmin();
  if (source === "elementos") {
    const rows = await db.select({ id: elementos.id, label: elementos.nombre }).from(elementos).orderBy(asc(elementos.orden));
    return rows.map((r) => ({ id: r.id, label: r.label }));
  }
  if (source === "regiones") {
    const rows = await db.select({ id: regiones.id, label: regiones.nombre }).from(regiones).where(isNull(regiones.eliminadoEn)).orderBy(asc(regiones.nombre));
    return rows.map((r) => ({ id: r.id, label: r.label ?? `#${r.id}` }));
  }
  if (source === "artefactos") {
    const rows = await db.select({ id: armasArtefactos.id, label: armasArtefactos.nombre }).from(armasArtefactos).where(isNull(armasArtefactos.eliminadoEn)).orderBy(asc(armasArtefactos.nombre));
    return rows.map((r) => ({ id: r.id, label: r.label ?? `#${r.id}` }));
  }
  const table = source === "naciones" ? naciones : source === "razas" ? razas : source === "minerales" ? minerales : bestias;
  const c = getTableColumns(table) as Cols;
  const rows = (await db.select({ id: c.id, label: c.nombre }).from(table).where(isNull(c.eliminadoEn)).orderBy(asc(c.nombre))) as Cols[];
  return rows.map((r) => ({ id: r.id as number, label: (r.label as string) ?? `#${r.id}` }));
}

/** Lee las filas de un bloque de relación para un dueño. */
export async function getRelacion(entidad: string, relKey: string, ownerId: number): Promise<RelacionRow[]> {
  await assertAdmin();
  const def = getRelTableDef(entidad, relKey);
  if (!def) return [];
  const c = getTableColumns(def.table) as Cols;
  const filtros = [eq(c[def.ownerCol], ownerId)];
  if (def.tipoPolimorfico) filtros.push(eq(c.entidadTipo, def.tipoPolimorfico));
  const orderCol = def.orden ? c.orden : c.id;
  const rows = (await db.select().from(def.table).where(and(...filtros)).orderBy(asc(orderCol))) as Cols[];
  return rows.map((r) => {
    const campos: Record<string, string> = {};
    for (const col of def.extraCols) campos[col] = r[col] == null ? "" : String(r[col]);
    for (const col of def.libreCols ?? []) campos[col] = r[col] == null ? "" : String(r[col]);
    return { targetId: def.targetCol ? ((r[def.targetCol] as number) ?? null) : null, campos };
  });
}

/** Reescribe por completo el bloque de relación de un dueño (delete + insert). */
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

  const delFiltros = [eq(c[def.ownerCol], ownerId)];
  if (def.tipoPolimorfico) delFiltros.push(eq(c.entidadTipo, def.tipoPolimorfico));
  await db.delete(def.table).where(and(...delFiltros));

  const limpio = rows.filter((r) => (def.targetCol ? r.targetId != null : (r.campos[def.libreCols?.[0] ?? ""] ?? "").trim() !== ""));
  if (limpio.length > 0) {
    const values = limpio.map((r, i) => {
      const v: Cols = { [def.ownerCol]: ownerId };
      if (def.tipoPolimorfico) v.entidadTipo = def.tipoPolimorfico;
      if (def.targetCol && r.targetId != null) v[def.targetCol] = r.targetId;
      for (const col of def.extraCols) {
        const raw = (r.campos[col] ?? "").trim();
        v[col] = raw === "" ? null : raw;
      }
      for (const col of def.libreCols ?? []) {
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
