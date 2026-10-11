import type { Calendario, Extremo, Fecha, Segmento } from "./tipos.ts";

/**
 * Aritmética del calendario. Pura y client-safe.
 *
 * Cada fecha se reduce a un **día absoluto** (la "clave"): el día 0 es el primer
 * día del año 0, y cuenta hacia atrás y hacia delante sin huecos. Con eso,
 * ordenar la cronología o saber si un rango contiene a otro es comparar enteros.
 *
 * Las claves dependen del calendario (cuántos días tiene cada mes), así que se
 * guardan precalculadas en la base y se recalculan **todas** cuando el
 * calendario cambia. Lo que se guarda como verdad es la fecha, nunca la clave.
 */

/** Segmentos en su orden dentro del año. */
export function segmentosOrdenados(cal: Calendario): Segmento[] {
  return [...cal.segmentos].sort((a, b) => a.orden - b.orden || a.id - b.id);
}

/**
 * Días de un año. Nunca menos de 1: un calendario aún vacío no debe producir
 * divisiones por cero ni hacer que todas las fechas caigan en el mismo día.
 */
export function diasPorAnio(cal: Calendario): number {
  return Math.max(1, cal.segmentos.reduce((n, s) => n + Math.max(0, s.dias), 0));
}

/** Días transcurridos del año antes de que empiece ese segmento. */
function desplazamiento(cal: Calendario, segmentoId: number): { desde: number; seg: Segmento } | null {
  let desde = 0;
  for (const s of segmentosOrdenados(cal)) {
    if (s.id === segmentoId) return { desde, seg: s };
    desde += Math.max(0, s.dias);
  }
  return null;
}

/**
 * Día absoluto de un extremo.
 *
 * Un extremo impreciso cubre varios días: "Mes 3" va del primero al último del
 * mes. `borde` dice qué día de ese tramo se quiere: el primero para el inicio
 * de un rango, el último para el final. Así "de Mes 2 a Mes 6" abarca los cinco
 * meses completos, que es lo que se lee.
 */
export function claveExtremo(cal: Calendario, e: Extremo, borde: "ini" | "fin"): number {
  const D = diasPorAnio(cal);
  const base = e.anio * D;
  const pos = e.segmentoId != null ? desplazamiento(cal, e.segmentoId) : null;
  // Sin segmento, o con uno que ya no existe: precisión de año.
  if (!pos) return borde === "ini" ? base : base + D - 1;
  if (e.dia == null) return borde === "ini" ? base + pos.desde : base + pos.desde + Math.max(1, pos.seg.dias) - 1;
  return base + pos.desde + e.dia - 1;
}

/** Primer y último día que cubre una fecha. Un punto impreciso también es un tramo. */
export function claves(cal: Calendario, f: Fecha): { ini: number; fin: number } {
  return { ini: claveExtremo(cal, f.ini, "ini"), fin: claveExtremo(cal, f.fin ?? f.ini, "fin") };
}

/** Errores de una fecha contra el calendario. Vacío = válida. */
export function validarFecha(cal: Calendario, f: Fecha): string[] {
  const errores: string[] = [];
  const revisar = (e: Extremo, quien: string) => {
    if (!Number.isInteger(e.anio)) errores.push(`El año ${quien} debe ser un número entero.`);
    if (e.dia != null && e.segmentoId == null) errores.push(`El día ${quien} necesita un mes.`);
    if (e.segmentoId != null) {
      const pos = desplazamiento(cal, e.segmentoId);
      if (!pos) errores.push(`El mes ${quien} ya no existe en el calendario.`);
      else if (e.dia != null && (!Number.isInteger(e.dia) || e.dia < 1 || e.dia > pos.seg.dias))
        errores.push(`${pos.seg.nombre} tiene ${pos.seg.dias} días; el día ${quien} no cabe.`);
    }
  };
  revisar(f.ini, "de inicio");
  if (f.fin) {
    revisar(f.fin, "de fin");
    if (errores.length === 0) {
      const k = claves(cal, f);
      if (claveExtremo(cal, f.fin, "ini") < claveExtremo(cal, f.ini, "ini") || k.fin < k.ini)
        errores.push("El final del rango es anterior a su inicio.");
    }
  }
  return errores;
}

/**
 * Día de la semana de un día absoluto, o null si no hay semana configurada.
 * El día 0 (primer día del año 0) es el primer día de la semana. Los días fuera
 * de mes cuentan para el ciclo como cualquier otro (§13).
 */
export function diaSemana(cal: Calendario, clave: number): string | null {
  const n = cal.diasSemana.length;
  if (n === 0) return null;
  return cal.diasSemana[((clave % n) + n) % n];
}

/** Año al que pertenece un día absoluto. */
export function anioDeClave(cal: Calendario, clave: number): number {
  return Math.floor(clave / diasPorAnio(cal));
}

/**
 * Años cumplidos entre dos días absolutos (nacimiento → momento). Negativo si el
 * momento es anterior al nacimiento: quien lo pinte decide qué mostrar.
 */
export function aniosEntre(cal: Calendario, desde: number, hasta: number): number {
  return Math.floor((hasta - desde) / diasPorAnio(cal));
}
