/**
 * Escalas de estadísticas y cálculo del "Poder de Combate" del personaje.
 * Client-safe (sin imports de servidor): lo usan el formulario admin, la ficha
 * pública y la server action de guardado para no divergir.
 *
 * Tres secciones con escalas distintas → cada una se normaliza a % sobre 100,
 * y el Poder de Combate es el promedio de esos tres porcentajes:
 *   · Atributos primarios   1–10   → value / 10
 *   · Estadísticas de combate 1–300 → value / 300
 *   · Rangos (D…SSS)         letras → valor de la letra / 100 (ya es %)
 * Los campos sin valor toman el mínimo de su escala (regla: "por defecto el más bajo").
 */

export const PRIMARY_KEYS = [
  "fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma",
] as const;

export const COMBAT_KEYS = [
  "mpMax", "ataqueFisico", "ataqueMagico", "defensaFisica", "defensaMagica",
  "velocidad", "capacidadDeReaccion", "precisionVal",
] as const;

export const RATING_KEYS = [
  "rangoCuerpoACuerpo", "rangoDistancia", "danoMagico", "defensa", "apoyo", "movilidad", "controlDeMasas",
] as const;

export type PrimaryKey = (typeof PRIMARY_KEYS)[number];
export type CombatKey = (typeof COMBAT_KEYS)[number];
export type RatingKey = (typeof RATING_KEYS)[number];

// Escalas numéricas.
export const PRIMARY_MIN = 1;
export const PRIMARY_MAX = 10;
export const COMBAT_MIN = 1;
export const COMBAT_MAX = 300;

/** Rangos cualitativos en orden ascendente y su valor sobre 100. */
export const RANGOS = ["D", "C", "B", "A", "S", "SS", "SSS"] as const;
export type Rango = (typeof RANGOS)[number];

export const RANGO_VALOR: Record<Rango, number> = {
  D: 20, C: 40, B: 50, A: 70, S: 80, SS: 90, SSS: 100,
};

/** Letra de rango por defecto (la más baja). */
export const RANGO_DEFAULT: Rango = "D";

export function esRango(v: unknown): v is Rango {
  return typeof v === "string" && (RANGOS as readonly string[]).includes(v);
}

/** Convierte el % global del Poder de Combate a su letra equivalente (D…SSS). */
export function rangoDesdePorcentaje(pct: number): Rango {
  let out: Rango = RANGOS[0];
  for (const r of RANGOS) {
    if (pct >= RANGO_VALOR[r]) out = r;
  }
  return out;
}

type StatsLike = Record<string, number | string | null | undefined>;

function numero(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface PoderDeCombate {
  /** % de cada sección sobre 100. */
  primarios: number;
  combate: number;
  rangos: number;
  /** Promedio de las tres secciones (0–100), redondeado. */
  total: number;
  /** Letra equivalente al total. */
  letra: Rango;
}

/**
 * Calcula el Poder de Combate a partir de un objeto de estadísticas crudo
 * (valores numéricos o strings de inputs). Los huecos toman el mínimo de escala.
 */
export function calcularPoderDeCombate(stats: StatsLike | null | undefined): PoderDeCombate {
  const primarioPct = (k: PrimaryKey) => {
    const v = numero(stats?.[k]) ?? PRIMARY_MIN;
    return Math.min(1, Math.max(0, v / PRIMARY_MAX));
  };
  const combatePct = (k: CombatKey) => {
    const v = numero(stats?.[k]) ?? COMBAT_MIN;
    return Math.min(1, Math.max(0, v / COMBAT_MAX));
  };
  const rangoPct = (k: RatingKey) => {
    const raw = stats?.[k];
    const letra = esRango(raw) ? (raw as Rango) : RANGO_DEFAULT;
    return RANGO_VALOR[letra] / 100;
  };

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const primarios = Math.round(avg(PRIMARY_KEYS.map(primarioPct)) * 100);
  const combate = Math.round(avg(COMBAT_KEYS.map(combatePct)) * 100);
  const rangos = Math.round(avg(RATING_KEYS.map(rangoPct)) * 100);
  const total = Math.round((primarios + combate + rangos) / 3);

  return { primarios, combate, rangos, total, letra: rangoDesdePorcentaje(total) };
}
