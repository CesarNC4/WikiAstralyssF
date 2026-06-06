import { z } from "zod";

const str = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const t = typeof v === "string" ? v.trim() : "";
    return t.length > 0 ? t : null;
  });

const idField = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  },
  z.number().int().positive().nullable(),
);

export const seccionTipoSchema = z.enum(["texto", "cita", "tabla"]);
export const estadoSchema = z.enum(["borrador", "publicado", "oculto"]);

export const loreSeccionSchema = z.object({
  id: idField.optional(),
  orden: z.preprocess((v) => Number(v) || 0, z.number().int()),
  titulo: str,
  contenido: str,
  tipo: seccionTipoSchema.default("texto"),
  estadoPublicacion: estadoSchema.default("publicado"),
});

export const loreSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio"),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio")
    .regex(/^[a-z0-9-]+$/, "Slug inválido: solo minúsculas, números y guiones"),
  subtitulo: str,
  introduccion: str,
  imagenUrl: str,
  bannerUrl: str,
  estadoPublicacion: estadoSchema.default("borrador"),
  secciones: z.array(loreSeccionSchema).default([]),
});

export type LoreInput = z.infer<typeof loreSchema>;
