import { claveExtremo, diasPorAnio } from "./calendario.ts";
import type { Calendario, Extremo, Fecha } from "./tipos.ts";

/**
 * Salto temporal entre dos fechas, para leer la alternancia de los fragmentos de
 * un acto: "3 días antes", "+1 mes", "mismo día" (docs/fragmentos-y-musica.md
 * §2.5). Pura y client-safe.
 *
 * Se compara el inicio de las dos fechas, a la precisión de la menos precisa:
 * entre "año 12" y "3 de Mes 2 del año 12" no hay días que contar, solo "mismo
 * año". Los meses del mundo no tienen por qué medir lo mismo, así que un mes es
 * la duración media de los meses del calendario.
 */

/** 2 = día, 1 = mes (o bloque fuera de mes), 0 = solo año. */
function precision(e: Extremo): number {
  return e.segmentoId == null ? 0 : e.dia == null ? 1 : 2;
}

function mesMedio(cal: Calendario): number {
  const meses = cal.segmentos.filter((s) => s.tipo === "mes").length;
  return diasPorAnio(cal) / (meses || 12);
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Una duración positiva en días, en la unidad que mejor se lee. */
function duracion(cal: Calendario, dias: number): string {
  const D = diasPorAnio(cal);
  const M = mesMedio(cal);
  if (dias < M) return plural(dias, "día", "días");
  if (dias < D) return plural(Math.max(1, Math.round(dias / M)), "mes", "meses");
  const anios = Math.floor(dias / D);
  const meses = Math.round((dias - anios * D) / M);
  return meses > 0 && meses < 12 ? `${plural(anios, "año", "años")} y ${plural(meses, "mes", "meses")}` : plural(anios, "año", "años");
}

/** Lo que pasa de `desde` a `hasta`: "+3 días", "2 meses antes", "mismo día". */
export function saltoTemporal(cal: Calendario, desde: Fecha, hasta: Fecha): string {
  const p = Math.min(precision(desde.ini), precision(hasta.ini));
  const aprox = desde.aproximada || hasta.aproximada ? "≈ " : "";

  if (p === 0) {
    const n = hasta.ini.anio - desde.ini.anio;
    if (n === 0) return `${aprox}mismo año`;
    const t = plural(Math.abs(n), "año", "años");
    return aprox + (n > 0 ? `+${t}` : `${t} antes`);
  }

  // A precisión de mes, el día del más preciso no cuenta.
  const recorte = (e: Extremo): Extremo => (p === 1 ? { ...e, dia: null } : e);
  const d = claveExtremo(cal, recorte(hasta.ini), "ini") - claveExtremo(cal, recorte(desde.ini), "ini");
  if (d === 0) return `${aprox}${p === 1 ? "mismo mes" : "mismo día"}`;
  let t: string;
  if (p === 1) {
    // A precisión de mes no se cuentan días: dos meses vecinos son "1 mes".
    const meses = Math.max(1, Math.round(Math.abs(d) / mesMedio(cal)));
    t = meses < 12 ? plural(meses, "mes", "meses") : duracion(cal, Math.abs(d));
  } else {
    t = duracion(cal, Math.abs(d));
  }
  return aprox + (d > 0 ? `+${t}` : `${t} antes`);
}
