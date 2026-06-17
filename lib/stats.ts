/**
 * Definiciones de stats 0-100 por entidad (client-safe). Una sola fuente para
 * los sliders del admin, las barras de la ficha pública y las columnas del
 * compendio comparativo.
 */
export interface StatDef {
  /** Columna camelCase en Drizzle / payload. */
  key: string;
  label: string;
  icon: string;
}

export interface StatGroup {
  titulo: string;
  color: string;
  stats: StatDef[];
}

export const STATS_POR_ENTIDAD: Record<string, StatGroup[]> = {
  bestias: [
    {
      titulo: "Combate",
      color: "#ef6f6f",
      stats: [
        { key: "statFuerza", label: "Fuerza", icon: "Sword" },
        { key: "statVelocidad", label: "Velocidad", icon: "Gauge" },
        { key: "statResistencia", label: "Resistencia", icon: "Shield" },
        { key: "statPoderMagico", label: "Poder mágico", icon: "Sparkles" },
      ],
    },
    {
      titulo: "Bestiario",
      color: "#e0a44a",
      stats: [
        { key: "statPeligrosidad", label: "Peligrosidad", icon: "Flame" },
        { key: "statRareza", label: "Rareza", icon: "Star" },
        { key: "statTerritorialidad", label: "Territorialidad", icon: "Crosshair" },
      ],
    },
  ],
  minerales: [
    {
      titulo: "Gema",
      color: "#6fc3d6",
      stats: [
        { key: "statDureza", label: "Dureza", icon: "Gem" },
        { key: "statPureza", label: "Pureza", icon: "Sparkle" },
        { key: "statConductividad", label: "Conductividad mágica", icon: "Zap" },
      ],
    },
    {
      titulo: "Mercado",
      color: "#cbab57",
      stats: [
        { key: "statRareza", label: "Rareza", icon: "Star" },
        { key: "statValor", label: "Valor", icon: "Coins" },
        { key: "statDemanda", label: "Demanda", icon: "TrendingUp" },
        { key: "statAbundancia", label: "Abundancia", icon: "Layers" },
      ],
    },
  ],
  razas: [
    {
      titulo: "Atributos",
      color: "#9b8cff",
      stats: [
        { key: "statLongevidad", label: "Longevidad", icon: "Hourglass" },
        { key: "statAfinidadMagica", label: "Afinidad mágica", icon: "Sparkles" },
        { key: "statFuerza", label: "Fuerza física", icon: "Dumbbell" },
        { key: "statAgilidad", label: "Agilidad", icon: "Wind" },
        { key: "statAdaptabilidad", label: "Adaptabilidad", icon: "Shuffle" },
      ],
    },
    {
      titulo: "Demografía",
      color: "#5fb98f",
      stats: [
        { key: "statDispersion", label: "Dispersión", icon: "Map" },
        { key: "statPurezaLinaje", label: "Pureza de linaje", icon: "GitBranch" },
      ],
    },
  ],
  naciones: [
    {
      titulo: "Poder",
      color: "#7b5cff",
      stats: [
        { key: "poderMilitarNivel", label: "Militar", icon: "Swords" },
        { key: "poderEconomicoNivel", label: "Económico", icon: "Coins" },
        { key: "poderPoliticoNivel", label: "Político", icon: "Landmark" },
        { key: "poderMagicoNivel", label: "Mágico", icon: "Sparkles" },
        { key: "poderTecnologicoNivel", label: "Tecnológico", icon: "Cog" },
      ],
    },
  ],
};

/** Todas las claves de stat de una entidad, aplanadas. */
export function statKeys(entidad: string): string[] {
  return (STATS_POR_ENTIDAD[entidad] ?? []).flatMap((g) => g.stats.map((s) => s.key));
}

/** Normaliza un valor de stat a 0-100 (o null si vacío). */
export function clampStat(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

/** ¿La fila tiene al menos un stat con valor? */
export function tieneStats(entidad: string, row: Record<string, unknown>): boolean {
  return statKeys(entidad).some((k) => clampStat(row[k]) != null);
}
