import { segmentosOrdenados } from "./calendario.ts";
import type { Calendario, Era, Extremo, Fecha, ModoFecha } from "./tipos.ts";

/**
 * Cómo se escribe una fecha para el lector. Pura y client-safe.
 *
 * Conviven dos lecturas del mismo eje (§13): el **año absoluto** (-100, 0, 100),
 * que es como se orienta el público, y las **eras**, que es como se cuenta dentro
 * del lore. El lector elige con un conmutador; aquí solo se traduce.
 */

/** Tramo de una era ya resuelto sobre el eje absoluto. `fin` es exclusivo. */
export interface TramoEra {
  era: Era;
  /** null en la primera era: no tiene inicio. */
  inicio: number | null;
  /** Inicio de la era siguiente, o null si es la última. */
  fin: number | null;
}

/**
 * Las eras utilizables, en orden. La primera siempre entra (no necesita inicio);
 * las demás solo si tienen año de inicio y es posterior al de la anterior. Una
 * era a medio configurar se ignora en lugar de producir años absurdos.
 */
export function tramosDeEras(cal: Calendario): TramoEra[] {
  const eras = [...cal.eras].sort((a, b) => a.orden - b.orden || a.id - b.id);
  if (eras.length === 0) return [];
  const tramos: TramoEra[] = [{ era: eras[0], inicio: null, fin: null }];
  for (const era of eras.slice(1)) {
    const previo = tramos[tramos.length - 1];
    if (era.anioInicio == null) continue;
    if (previo.inicio != null && era.anioInicio <= previo.inicio) continue;
    previo.fin = era.anioInicio;
    tramos.push({ era, inicio: era.anioInicio, fin: null });
  }
  return tramos;
}

/** Era en la que cae un año, o null si no hay eras. */
export function eraDeAnio(cal: Calendario, anio: number): Era | null {
  const tramos = tramosDeEras(cal);
  for (let i = tramos.length - 1; i >= 0; i--) {
    const t = tramos[i];
    if (t.inicio == null || anio >= t.inicio) return t.era;
  }
  return null;
}

/** Nombre corto de una era: su abreviatura, o "la <nombre>". */
function nombreEra(era: Era): string {
  return era.abreviatura?.trim() || `de la ${era.nombre}`;
}

/** Nombre de una era tras "fin de": "la E.P." o "la Era Primordial". */
function finDe(era: Era): string {
  return `la ${era.abreviatura?.trim() || era.nombre}`;
}

/**
 * Un año, en eras. Null si las eras no alcanzan para situarlo (por ejemplo,
 * la primera era sin una segunda configurada no tiene fin desde el que contar).
 */
export function anioEnEras(cal: Calendario, anio: number): string | null {
  const tramos = tramosDeEras(cal);
  for (let i = tramos.length - 1; i >= 0; i--) {
    const t = tramos[i];
    if (t.inicio != null && anio >= t.inicio) return `Año ${anio - t.inicio + 1} ${nombreEra(t.era)}`;
  }
  // Antes de la segunda era: la primera, contada hacia atrás desde su fin.
  const primera = tramos[0];
  if (!primera || primera.fin == null) return null;
  return `${primera.fin - anio} antes del fin de ${finDe(primera.era)}`;
}

/** Un año en la lectura pedida. Las eras caen al absoluto si no pueden situarlo. */
export function formatoAnio(cal: Calendario, anio: number, modo: ModoFecha): string {
  if (modo === "eras") {
    const e = anioEnEras(cal, anio);
    if (e) return e;
  }
  return `Año ${anio}`;
}

/** "Mes 3" o "Noches de Ceniza". Null si el segmento ya no existe. */
function nombreSegmento(cal: Calendario, id: number): { nombre: string; intercalar: boolean } | null {
  const s = segmentosOrdenados(cal).find((x) => x.id === id);
  return s ? { nombre: s.nombre, intercalar: s.tipo === "intercalar" } : null;
}

/** Día y segmento sin el año: "12 de Mes 3", "día 2 de Noches de Ceniza", "Mes 3". */
function sinAnio(cal: Calendario, e: Extremo): string | null {
  if (e.segmentoId == null) return null;
  const seg = nombreSegmento(cal, e.segmentoId);
  if (!seg) return null;
  if (e.dia == null) return seg.nombre;
  return seg.intercalar ? `día ${e.dia} de ${seg.nombre}` : `${e.dia} de ${seg.nombre}`;
}

/** Un extremo completo: "12 de Mes 3, año 312 E.A.", "Mes 3, año -5", "Año -100". */
export function formatoExtremo(cal: Calendario, e: Extremo, modo: ModoFecha): string {
  const anio = formatoAnio(cal, e.anio, modo);
  const parte = sinAnio(cal, e);
  if (!parte) return anio;
  return `${mayuscula(parte)}, ${minuscula(anio)}`;
}

/**
 * Una fecha completa, punto o rango, compactando lo que se repite:
 *   "Del 3 al 9 de Mes 3, año -100"
 *   "De Mes 2 a Mes 6, año 20"
 *   "Del año -10000 al año -6000"
 *   "12 de Mes 3, año -100 – Mes 5, año -98"
 */
export function formatoFecha(cal: Calendario, f: Fecha, modo: ModoFecha): string {
  const texto = f.fin ? formatoRango(cal, f.ini, f.fin, modo) : formatoExtremo(cal, f.ini, modo);
  return f.aproximada ? `${texto} (aprox.)` : texto;
}

function formatoRango(cal: Calendario, a: Extremo, b: Extremo, modo: ModoFecha): string {
  const pa = sinAnio(cal, a);
  const pb = sinAnio(cal, b);

  if (a.anio === b.anio && pa && pb) {
    const anio = minuscula(formatoAnio(cal, a.anio, modo));
    // Mismo mes y los dos con día: "Del 3 al 9 de Mes 3".
    if (a.segmentoId === b.segmentoId && a.dia != null && b.dia != null) {
      const seg = nombreSegmento(cal, a.segmentoId!);
      return `Del ${a.dia} al ${b.dia} de ${seg?.nombre ?? ""}, ${anio}`;
    }
    return `${desde(pa, a.dia != null)} ${hasta(pb, b.dia != null)}, ${anio}`;
  }

  // Dos años sin más precisión: "Del año -10000 al año -6000".
  if (!pa && !pb) {
    return `Del ${minuscula(formatoAnio(cal, a.anio, modo))} al ${minuscula(formatoAnio(cal, b.anio, modo))}`;
  }

  return `${formatoExtremo(cal, a, modo)} – ${formatoExtremo(cal, b, modo)}`;
}

/** "Del 3 de Mes 2" / "De Mes 2". */
function desde(parte: string, conDia: boolean): string {
  return conDia ? `Del ${parte}` : `De ${parte}`;
}

/** "al 5 de Mes 4" / "a Mes 6". */
function hasta(parte: string, conDia: boolean): string {
  return conDia ? `al ${parte}` : `a ${parte}`;
}

/**
 * Versión corta para insignias y listas densas: solo años.
 * "-10000 a -6000", "312 E.A.", "≈ -1000".
 */
export function formatoCorto(cal: Calendario, f: Fecha, modo: ModoFecha): string {
  const uno = (anio: number) => {
    const largo = formatoAnio(cal, anio, modo);
    return largo.startsWith("Año ") ? largo.slice(4) : largo;
  };
  const base = f.fin && f.fin.anio !== f.ini.anio ? `${uno(f.ini.anio)} a ${uno(f.fin.anio)}` : uno(f.ini.anio);
  return f.aproximada ? `≈ ${base}` : base;
}

/**
 * Una fecha escrita en las dos lecturas. El servidor las calcula y el navegador
 * enseña la que haya elegido el lector, así el cliente no necesita el calendario
 * para pintar una fecha.
 */
export interface TextosFecha {
  eras: string;
  absoluto: string;
}

export function textosFecha(cal: Calendario, f: Fecha, corto = false): TextosFecha {
  const fmt = corto ? formatoCorto : formatoFecha;
  return { eras: fmt(cal, f, "eras"), absoluto: fmt(cal, f, "absoluto") };
}

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Solo baja "Año" a "año"; no toca nombres propios de meses ni eras. */
function minuscula(s: string): string {
  return s.startsWith("Año ") ? `año ${s.slice(4)}` : s;
}
