"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets } from "@/db/schema/media";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { assertAdmin } from "@/lib/actions/auth";

export interface AssetRegistrado {
  id: number;
  url: string;
}

/**
 * Genera un blurDataURL diminuto a partir de una URL de Cloudinary (best-effort).
 * Devuelve un data URI base64 o null si falla.
 */
async function generarBlur(url: string): Promise<string | null> {
  try {
    if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return null;
    const tiny = url.replace("/upload/", "/upload/w_16,e_blur:1200,q_30,f_auto/");
    const res = await fetch(tiny);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Registra en media_assets una imagen ya subida a Cloudinary por el widget. */
export async function registrarAsset(input: {
  publicId: string;
  url: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  alt?: string | null;
}): Promise<AssetRegistrado> {
  await assertAdmin();
  const blur = await generarBlur(input.url);
  const [row] = await db
    .insert(mediaAssets)
    .values({
      storage: "cloudinary",
      publicId: input.publicId,
      urlPublica: input.url,
      tipo: "imagen",
      mime: input.format ? `image/${input.format}` : null,
      alt: input.alt ?? null,
      ancho: input.width ?? null,
      alto: input.height ?? null,
      bytes: input.bytes ?? null,
      blurhash: blur,
    })
    .returning({ id: mediaAssets.id, url: mediaAssets.urlPublica });
  return { id: row.id, url: row.url };
}

/** Borra un asset de la DB y de Cloudinary (best-effort). */
export async function eliminarAsset(id: number): Promise<void> {
  await assertAdmin();
  const [row] = await db
    .select({ publicId: mediaAssets.publicId })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  if (row?.publicId) await deleteFromCloudinary(row.publicId).catch(() => {});
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
}
