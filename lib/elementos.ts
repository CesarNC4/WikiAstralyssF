/**
 * Catálogo elemental unificado (client-safe).
 *
 * La fuente de verdad editable es la tabla `elementos`, que además recibe los
 * vínculos de las fichas por `entidad_elemento` (afinidad / debilidad /
 * resistencia): gracias a eso el elemento sabe quién lo usa sin editarlo desde
 * su lado. Este archivo la espeja para poder colorear e iconar sin un fetch, y
 * sirve de semilla.
 *
 * Naciones, razas, minerales y magia leen de aquí.
 */

/** Familias, en el orden en que se agrupan en los desplegables. */
export const FAMILIAS_ELEMENTALES = ["Elementales", "Antiguos", "Oscuros", "Sacros", "Sin elemento"] as const;

export type FamiliaElemental = (typeof FAMILIAS_ELEMENTALES)[number];

export interface ElementoMeta {
  slug: string;
  nombre: string;
  familia: FamiliaElemental;
  color: string;
  icono: string;
  /** Nombres antiguos que deben seguir resolviendo a este elemento. */
  alias?: string[];
}

/**
 * Los 14 elementos. El orden es el de aparición en los desplegables.
 *
 * Ojo: "Magia Oscura" y "Umbra" son cosas distintas del lore y conviven a
 * propósito; no son sinónimos y ninguna migra a la otra.
 */
export const ELEMENTOS: ElementoMeta[] = [
  { slug: "pyro", nombre: "Pyro", familia: "Elementales", color: "#ef7a35", icono: "Flame" },
  { slug: "hydro", nombre: "Hydro", familia: "Elementales", color: "#4cc2f1", icono: "Droplet" },
  { slug: "cryo", nombre: "Cryo", familia: "Elementales", color: "#9fd6e3", icono: "Snowflake" },
  { slug: "electro", nombre: "Electro", familia: "Elementales", color: "#b08fc9", icono: "Zap" },
  { slug: "geo", nombre: "Geo", familia: "Elementales", color: "#f8ba4f", icono: "Mountain" },
  { slug: "dendro", nombre: "Dendro", familia: "Elementales", color: "#a5c83b", icono: "Leaf" },
  // Se llamaba "Anemo (Vento)" y chocaba con el "Vento" que ya usaban naciones
  // y magia. Unificado bajo "Vento", conservando slug, color e icono para no
  // romper los vínculos ni el estilo.
  { slug: "anemo", nombre: "Vento", familia: "Elementales", color: "#74c2a8", icono: "Wind", alias: ["anemo (vento)", "anemo"] },
  { slug: "lumino", nombre: "Lumino", familia: "Antiguos", color: "#f6e7b4", icono: "Sunrise" },
  { slug: "umbra", nombre: "Umbra", familia: "Antiguos", color: "#6b5b95", icono: "Moon" },
  { slug: "magia-oscura", nombre: "Magia Oscura", familia: "Oscuros", color: "#3d2b56", icono: "Sparkles" },
  { slug: "demoniaco", nombre: "Demoníaco", familia: "Oscuros", color: "#b3203b", icono: "Skull" },
  { slug: "sacro", nombre: "Sacro", familia: "Sacros", color: "#f3e4a8", icono: "Sun" },
  { slug: "neutro", nombre: "Neutro", familia: "Sin elemento", color: "#9aa3b2", icono: "Circle" },
  { slug: "ausente", nombre: "Ausente", familia: "Sin elemento", color: "#5a616e", icono: "Ban" },
];

const BY_KEY = new Map<string, ElementoMeta>();
for (const e of ELEMENTOS) {
  BY_KEY.set(e.slug, e);
  BY_KEY.set(e.nombre.toLowerCase(), e);
  for (const a of e.alias ?? []) BY_KEY.set(a.toLowerCase(), e);
}

/** Resuelve un elemento por slug o nombre (case-insensitive). */
export function elementoMeta(key: string | null | undefined): ElementoMeta | null {
  if (!key) return null;
  const k = key.trim().toLowerCase();
  return BY_KEY.get(k) ?? BY_KEY.get(k.replace(/\s*\(.*\)\s*/, "")) ?? null;
}

/** Los elementos de una familia, en orden. */
export function elementosDeFamilia(familia: string): ElementoMeta[] {
  return ELEMENTOS.filter((e) => e.familia === familia);
}
