"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets } from "@/db/schema/media";
import { assertAdmin } from "@/lib/actions/auth";
import { usosDeImagenes } from "@/lib/media/usos";

export interface AssetRegistrado {
  id: number;
  url: string;
}

/** Una imagen ya subida que se puede reutilizar, con las fichas que la usan. */
export interface ImagenSubida {
  id: number;
  url: string;
  ancho: number | null;
  alto: number | null;
  usos: string[];
}

/**
 * Las imágenes ya subidas, de la más nueva a la más vieja, para elegir una en
 * vez de subir otra copia. Compartirla entre fichas es seguro: la purga solo
 * borra una imagen cuando ya no la usa ninguna.
 *
 * Solo salen las que alguna ficha usa. Una sin usar es una subida a medias (aún
 * sin guardar) o una que la próxima purga va a borrar: elegirla dejaría la ficha
 * apuntando a una imagen que puede desaparecer.
 */
export async function listarImagenesSubidas(): Promise<ImagenSubida[]> {
  await assertAdmin();
  const [assets, usos] = await Promise.all([
    db
      .select({ id: mediaAssets.id, url: mediaAssets.urlPublica, ancho: mediaAssets.ancho, alto: mediaAssets.alto })
      .from(mediaAssets)
      .where(eq(mediaAssets.tipo, "imagen"))
      .orderBy(desc(mediaAssets.id)),
    usosDeImagenes(),
  ]);
  return assets.filter((a) => usos.has(a.id)).map((a) => ({ ...a, usos: usos.get(a.id)! }));
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

/**
 * Registra en media_assets un archivo ya subido a Cloudinary por el widget: una
 * imagen o, con `tipo: "audio"`, el audio propio de una canción.
 */
export async function registrarAsset(input: {
  publicId: string;
  url: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  alt?: string | null;
  tipo?: "imagen" | "audio";
}): Promise<AssetRegistrado> {
  await assertAdmin();
  const tipo = input.tipo === "audio" ? "audio" : "imagen";
  const blur = tipo === "imagen" ? await generarBlur(input.url) : null;
  const [row] = await db
    .insert(mediaAssets)
    .values({
      storage: "cloudinary",
      publicId: input.publicId,
      urlPublica: input.url,
      tipo,
      mime: input.format ? `${tipo === "audio" ? "audio" : "image"}/${input.format}` : null,
      alt: input.alt ?? null,
      ancho: input.width ?? null,
      alto: input.height ?? null,
      bytes: input.bytes ?? null,
      blurhash: blur,
    })
    .returning({ id: mediaAssets.id, url: mediaAssets.urlPublica });
  return { id: row.id, url: row.url };
}
