import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entidadMedia, mediaAssets } from "@/db/schema/media";
import { camposOcultos } from "@/lib/queries/visibilidad";

/** Imagen de galería resuelta (entidad_media + media_assets). */
export interface GaleriaItem {
  id: number; // id de la fila entidad_media (no del asset)
  assetId: number;
  url: string;
  alt: string | null;
  blurhash: string | null;
}

/** La galería que ve el público: vacía si el autor la ha ocultado. */
export async function getGaleriaPublica(entidadTipo: string, entidadId: number): Promise<GaleriaItem[]> {
  const ocultos = await camposOcultos(entidadTipo, entidadId);
  return ocultos.has("galeria") ? [] : getGaleria(entidadTipo, entidadId);
}

/** Galería de una entidad (§5.2). rol = 'galeria', ordenada por `orden`. */
export async function getGaleria(entidadTipo: string, entidadId: number): Promise<GaleriaItem[]> {
  const rows = await db
    .select({
      id: entidadMedia.id,
      assetId: mediaAssets.id,
      url: mediaAssets.urlPublica,
      alt: mediaAssets.alt,
      blurhash: mediaAssets.blurhash,
    })
    .from(entidadMedia)
    .innerJoin(mediaAssets, eq(entidadMedia.assetId, mediaAssets.id))
    .where(
      and(
        eq(entidadMedia.entidadTipo, entidadTipo),
        eq(entidadMedia.entidadId, entidadId),
        eq(entidadMedia.rol, "galeria"),
      ),
    )
    .orderBy(asc(entidadMedia.orden), asc(entidadMedia.id));
  return rows;
}
