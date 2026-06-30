import { z } from "zod";
import type { EntidadConfig } from "@/lib/admin/fields";

const str = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const t = typeof v === "string" ? v.trim() : "";
    return t.length > 0 ? t : null;
  });

const intField = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  },
  z.number().int().nullable(),
);

/** Stat 0-100: recorta al rango y vacío → null. */
const statField = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(100, Math.max(0, Math.trunc(n)));
  },
  z.number().int().min(0).max(100).nullable(),
);

const boolField = z.preprocess(
  (v) => v === true || v === "true" || v === "on" || v === 1 || v === "1",
  z.boolean(),
);

const idField = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  },
  z.number().int().positive().nullable(),
);

export const estadoPublicacionSchema = z.enum(["borrador", "publicado", "oculto"]);

/** Construye un esquema Zod a partir de la configuración de una entidad. */
export function buildEntidadSchema(config: EntidadConfig) {
  const shape: Record<string, z.ZodTypeAny> = {
    [config.nameField]: z.string().trim().min(1, "El nombre es obligatorio"),
    estadoPublicacion: estadoPublicacionSchema.default("borrador"),
  };
  for (const field of config.fields) {
    if (field.type === "reference") shape[field.name] = idField;
    else if (field.type === "slider") shape[field.name] = statField;
    else if (field.type === "number") shape[field.name] = intField;
    else if (field.type === "checkbox") shape[field.name] = boolField;
    // Regla de producto: solo el nombre es obligatorio; el resto siempre opcional.
    else shape[field.name] = str;
  }
  if (config.hasImage) {
    shape.imagenUrl = str;
    shape.imagenAssetId = idField;
  }
  if (config.hasBanner) {
    shape.bannerUrl = str;
    shape.bannerAssetId = idField;
  }
  return z.object(shape);
}
