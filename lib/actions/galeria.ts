"use server";

import { and, eq, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { entidadMedia } from "@/db/schema/media";
import { assertAdmin } from "@/lib/actions/auth";
import { getGaleria, type GaleriaItem } from "@/lib/queries/galeria";

/** Devuelve la galería actual de una entidad (para el editor del admin). */
export async function listarGaleria(entidadTipo: string, entidadId: number): Promise<GaleriaItem[]> {
  await assertAdmin();
  return getGaleria(entidadTipo, entidadId);
}

/** Añade un asset ya registrado a la galería de una entidad (al final). */
export async function anadirGaleriaImagen(input: {
  entidadTipo: string;
  entidadId: number;
  assetId: number;
  revalidar?: string;
}): Promise<GaleriaItem[]> {
  await assertAdmin();
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${entidadMedia.orden}), -1)` })
    .from(entidadMedia)
    .where(and(eq(entidadMedia.entidadTipo, input.entidadTipo), eq(entidadMedia.entidadId, input.entidadId), eq(entidadMedia.rol, "galeria")));
  await db.insert(entidadMedia).values({
    entidadTipo: input.entidadTipo,
    entidadId: input.entidadId,
    assetId: input.assetId,
    rol: "galeria",
    orden: (max ?? -1) + 1,
  });
  if (input.revalidar) revalidatePath(input.revalidar);
  return getGaleria(input.entidadTipo, input.entidadId);
}

/** Quita una imagen de la galería (borra el vínculo; el asset se conserva). */
export async function quitarGaleriaImagen(input: {
  id: number;
  entidadTipo: string;
  entidadId: number;
  revalidar?: string;
}): Promise<GaleriaItem[]> {
  await assertAdmin();
  await db.delete(entidadMedia).where(eq(entidadMedia.id, input.id));
  if (input.revalidar) revalidatePath(input.revalidar);
  return getGaleria(input.entidadTipo, input.entidadId);
}

/** Reordena la galería según el array de ids de entidad_media. */
export async function reordenarGaleria(input: {
  ids: number[];
  entidadTipo: string;
  entidadId: number;
  revalidar?: string;
}): Promise<GaleriaItem[]> {
  await assertAdmin();
  if (input.ids.length > 0) {
    // Verificación de pertenencia y actualización de orden en una transacción.
    await db.transaction(async (tx) => {
      const filas = await tx
        .select({ id: entidadMedia.id })
        .from(entidadMedia)
        .where(and(eq(entidadMedia.entidadTipo, input.entidadTipo), eq(entidadMedia.entidadId, input.entidadId), inArray(entidadMedia.id, input.ids)));
      const validos = new Set(filas.map((f) => f.id));
      let orden = 0;
      for (const id of input.ids) {
        if (!validos.has(id)) continue;
        await tx.update(entidadMedia).set({ orden: orden++ }).where(eq(entidadMedia.id, id));
      }
    });
  }
  if (input.revalidar) revalidatePath(input.revalidar);
  return getGaleria(input.entidadTipo, input.entidadId);
}
