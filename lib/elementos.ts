/**
 * Catálogo elemental unificado (client-safe). Espeja el seed de la tabla
 * `elementos` para poder colorear/iconar afinidades, debilidades y resistencias
 * en fichas y formularios sin un fetch. La tabla en BD sigue siendo la fuente
 * de verdad editable; este mapa cubre el render inmediato.
 */
export interface ElementoMeta {
  slug: string;
  nombre: string;
  color: string;
  icono: string;
}

export const ELEMENTOS: ElementoMeta[] = [
  { slug: "pyro", nombre: "Pyro", color: "#ef7a35", icono: "Flame" },
  { slug: "hydro", nombre: "Hydro", color: "#4cc2f1", icono: "Droplet" },
  { slug: "cryo", nombre: "Cryo", color: "#9fd6e3", icono: "Snowflake" },
  { slug: "electro", nombre: "Electro", color: "#b08fc9", icono: "Zap" },
  { slug: "geo", nombre: "Geo", color: "#f8ba4f", icono: "Mountain" },
  { slug: "dendro", nombre: "Dendro", color: "#a5c83b", icono: "Leaf" },
  { slug: "anemo", nombre: "Anemo (Vento)", color: "#74c2a8", icono: "Wind" },
  { slug: "sacro", nombre: "Sacro", color: "#f3e4a8", icono: "Sun" },
  { slug: "demoniaco", nombre: "Demoníaco", color: "#b3203b", icono: "Skull" },
  { slug: "neutro", nombre: "Neutro", color: "#9aa3b2", icono: "Circle" },
];

const BY_KEY = new Map<string, ElementoMeta>();
for (const e of ELEMENTOS) {
  BY_KEY.set(e.slug, e);
  BY_KEY.set(e.nombre.toLowerCase(), e);
}

/** Resuelve un elemento por slug o nombre (case-insensitive). */
export function elementoMeta(key: string | null | undefined): ElementoMeta | null {
  if (!key) return null;
  const k = key.trim().toLowerCase();
  return BY_KEY.get(k) ?? BY_KEY.get(k.replace(/\s*\(.*\)\s*/, "")) ?? null;
}

export const ELEMENTO_OPCIONES = ELEMENTOS.map((e) => e.nombre);

export type RelacionElemento = "afinidad" | "debilidad" | "resistencia";

export const RELACION_ELEMENTO_LABEL: Record<RelacionElemento, string> = {
  afinidad: "Afinidad",
  debilidad: "Debilidad",
  resistencia: "Resistencia",
};
