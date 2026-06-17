/**
 * Descriptores client-safe de los bloques de relación N:M de cada entidad.
 * Describen la UI del editor (título, icono, fuente de opciones, campos extra).
 * La parte de BD vive en `lib/admin/relacionesTables.ts` (server-only) y comparte
 * las mismas keys de columna.
 */

export type RelTargetSource = "naciones" | "razas" | "minerales" | "regiones" | "artefactos" | "bestias" | "elementos";

export interface RelExtraField {
  name: string;
  label: string;
  tipo: "text" | "select";
  opciones?: string[];
}

export interface RelacionDef {
  /** Key única del bloque dentro de la entidad (coincide con la tabla). */
  key: string;
  titulo: string;
  icon: string;
  hint?: string;
  /** Si cada fila enlaza a otra entidad por id. */
  target?: { label: string; source: RelTargetSource; col: string };
  /** Si cada fila es texto libre (sin enlace), p.ej. usos de mineral. */
  libre?: { col: string; label: string; detalleCol?: string; detalleLabel?: string };
  extra: RelExtraField[];
  reorder?: boolean;
}

const RAREZA = ["Común", "Poco común", "Raro", "Épico", "Legendario"];

export const RELACIONES_POR_ENTIDAD: Record<string, RelacionDef[]> = {
  bestias: [
    {
      key: "bestia_nacion",
      titulo: "Hábitat · Naciones",
      icon: "Globe2",
      target: { label: "Nación", source: "naciones", col: "nacionId" },
      extra: [{ name: "nota", label: "Nota", tipo: "text" }],
    },
    {
      key: "bestia_region",
      titulo: "Hábitat · Regiones (mapa)",
      icon: "MapPinned",
      target: { label: "Región", source: "regiones", col: "regionId" },
      extra: [{ name: "nota", label: "Nota", tipo: "text" }],
    },
    {
      key: "bestia_drop",
      titulo: "Drops (minerales)",
      icon: "Gem",
      target: { label: "Mineral", source: "minerales", col: "mineralId" },
      extra: [
        { name: "rareza", label: "Rareza", tipo: "select", opciones: RAREZA },
        { name: "nota", label: "Nota", tipo: "text" },
      ],
      reorder: true,
    },
    {
      key: "bestia_relacion",
      titulo: "Bestias relacionadas",
      icon: "Network",
      target: { label: "Bestia", source: "bestias", col: "relacionadaId" },
      extra: [
        { name: "tipo", label: "Relación", tipo: "select", opciones: ["Depredador", "Presa", "Subespecie", "Evolución", "Simbiótica", "Rival"] },
        { name: "nota", label: "Nota", tipo: "text" },
      ],
    },
    {
      key: "entidad_elemento",
      titulo: "Debilidades / Resistencias",
      icon: "Sparkles",
      target: { label: "Elemento", source: "elementos", col: "elementoId" },
      extra: [{ name: "relacion", label: "Tipo", tipo: "select", opciones: ["Debilidad", "Resistencia"] }],
    },
  ],
  minerales: [
    {
      key: "mineral_artefacto",
      titulo: "Forjado en (armas / artefactos)",
      icon: "Sword",
      target: { label: "Artefacto", source: "artefactos", col: "artefactoId" },
      extra: [{ name: "nota", label: "Nota", tipo: "text" }],
    },
    {
      key: "mineral_uso",
      titulo: "Usos / aplicaciones",
      icon: "Layers",
      libre: { col: "nombre", label: "Uso", detalleCol: "detalle", detalleLabel: "Detalle" },
      extra: [],
      reorder: true,
    },
  ],
  razas: [
    {
      key: "nacion_raza",
      titulo: "Naciones donde habitan",
      icon: "Globe2",
      target: { label: "Nación", source: "naciones", col: "nacionId" },
      extra: [{ name: "tipo", label: "Tipo / rol", tipo: "text" }],
    },
    {
      key: "entidad_elemento",
      titulo: "Debilidades / Resistencias",
      icon: "Sparkles",
      target: { label: "Elemento", source: "elementos", col: "elementoId" },
      extra: [{ name: "relacion", label: "Tipo", tipo: "select", opciones: ["Debilidad", "Resistencia"] }],
    },
  ],
  naciones: [
    {
      key: "nacion_diplomacia",
      titulo: "Diplomacia",
      icon: "Landmark",
      hint: "Relación con otras naciones",
      target: { label: "Nación", source: "naciones", col: "otraNacionId" },
      extra: [
        { name: "tipo", label: "Relación", tipo: "select", opciones: ["Aliada", "Rival", "Neutral", "Vasalla", "En guerra"] },
        { name: "nota", label: "Nota", tipo: "text" },
      ],
    },
  ],
};

export function getRelacionesDe(entidad: string): RelacionDef[] {
  return RELACIONES_POR_ENTIDAD[entidad] ?? [];
}

/** Fila uniforme que viaja entre cliente y servidor. */
export interface RelacionRow {
  targetId: number | null;
  /** Valores de campos extra y libres por nombre de columna. */
  campos: Record<string, string>;
}
