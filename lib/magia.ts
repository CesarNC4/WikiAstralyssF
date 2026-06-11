/**
 * Identidad visual del dominio Magia (§ puntos 11-12). Client-safe.
 * Separa los dos ejes: NATURALEZA (Fundamento/Concepto/Técnica/Hechizo) y
 * TIPO/escuela (Elemental/Demoníaca…), con color e icono por elemento.
 *
 * Las claves canónicas coinciden con los catálogos del admin (`magia_tipo`,
 * `magia_variante`). El lookup es insensible a acentos/mayúsculas para tolerar
 * variaciones de escritura en los datos.
 */

export interface VisualMeta {
  label: string;
  icon: string;
  /** Color de acento (hex) para badges, glows y bordes. */
  color: string;
}

/** Normaliza para búsquedas tolerantes (sin acentos, minúsculas). */
function norm(s: string): string {
  // ̀-ͯ = marcas diacríticas combinantes (acentos) tras NFD.
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function buildLookup(map: Record<string, VisualMeta>): Map<string, VisualMeta> {
  return new Map(Object.entries(map).map(([k, v]) => [norm(k), v]));
}

/** Elementos (catálogo `magia_variante`). */
export const ELEMENTOS: Record<string, VisualMeta> = {
  Pyro: { label: "Pyro", icon: "Flame", color: "#ff6b4a" },
  Hydro: { label: "Hydro", icon: "Droplet", color: "#4aa8ff" },
  Cryo: { label: "Cryo", icon: "Snowflake", color: "#7fe9ff" },
  Electro: { label: "Electro", icon: "Zap", color: "#c07bff" },
  Geo: { label: "Geo", icon: "Mountain", color: "#e0b34a" },
  Dendro: { label: "Dendro", icon: "Leaf", color: "#7fd65a" },
  Vento: { label: "Vento", icon: "Wind", color: "#5fe0c0" },
  Lumino: { label: "Lumino", icon: "Sun", color: "#ffe07f" },
  Umbra: { label: "Umbra", icon: "Moon", color: "#9a7bff" },
};
const ELEMENTOS_LK = buildLookup(ELEMENTOS);

/** Tipos/escuelas de magia (catálogo `magia_tipo`). */
export const TIPOS_MAGIA: Record<string, VisualMeta> = {
  Elemental: { label: "Elemental", icon: "Sparkles", color: "#8b7bff" },
  "Demoníaca": { label: "Demoníaca", icon: "Flame", color: "#ff4a6b" },
  Oscura: { label: "Oscura", icon: "Moon", color: "#7a6bff" },
  Antigua: { label: "Antigua", icon: "ScrollText", color: "#d9b06a" },
  Ritual: { label: "Ritual", icon: "Atom", color: "#6ad9c0" },
  "Rúnica": { label: "Rúnica", icon: "Wand2", color: "#9ad96a" },
};
const TIPOS_LK = buildLookup(TIPOS_MAGIA);

/** Naturaleza conceptual, en orden de presentación. Las tres primeras son "sistema". */
export const NATURALEZAS: { key: string; label: string; icon: string; color: string; sistema: boolean }[] = [
  { key: "Fundamento", label: "Fundamentos", icon: "Atom", color: "#7fb0ff", sistema: true },
  { key: "Concepto", label: "Conceptos", icon: "Lightbulb", color: "#ffd27f", sistema: true },
  { key: "Tecnica Avanzada", label: "Técnicas Avanzadas", icon: "Wand2", color: "#c07bff", sistema: true },
  { key: "Hechizo", label: "Hechizos", icon: "Sparkles", color: "#8b7bff", sistema: false },
];

export const NATURALEZA_LABEL: Record<string, string> = {
  Fundamento: "Fundamento",
  Concepto: "Concepto",
  "Tecnica Avanzada": "Técnica Avanzada",
  Hechizo: "Hechizo",
};

export function naturalezaEsSistema(naturaleza: string | null | undefined): boolean {
  return naturaleza === "Fundamento" || naturaleza === "Concepto" || naturaleza === "Tecnica Avanzada";
}

/** Busca el elemento por nombre (tolerante a acentos). */
export function elementoMeta(sub: string | null | undefined): VisualMeta | undefined {
  return sub ? ELEMENTOS_LK.get(norm(sub)) : undefined;
}

/** Busca el tipo/escuela por nombre (tolerante a acentos). */
export function tipoMeta(tipo: string | null | undefined): VisualMeta | undefined {
  return tipo ? TIPOS_LK.get(norm(tipo)) : undefined;
}

/** Identidad visual de una entrada de magia: prioriza el elemento, luego el tipo, luego la naturaleza. */
export function magiaVisual(m: {
  tipo?: string | null;
  subcategoria?: string | null;
  naturaleza?: string | null;
}): VisualMeta {
  return (
    elementoMeta(m.subcategoria) ??
    tipoMeta(m.tipo) ??
    (() => {
      const nat = NATURALEZAS.find((n) => n.key === m.naturaleza);
      return nat ? { label: nat.label, icon: nat.icon, color: nat.color } : { label: "Magia", icon: "Sparkles", color: "#8b7bff" };
    })()
  );
}
