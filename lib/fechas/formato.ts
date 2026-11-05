import { segmentosOrdenados } from "./calendario.ts";
import type { Calendario, Era, Extremo, Fecha, ModoFecha } from "./tipos.ts";

/**
 * Cómo se escribe una fecha para el lector. Pura y client-safe.
 *
 * Hay tres formas de escribir el mismo eje:
 *  - **eras**: la fecha real, la que se cuenta dentro del lore.
 *  - **relativo**: la distancia al inicio del rol (el año 0 del eje), como guía.
 *  - **absoluto**: el número del eje, con negativos. Es interno: lo usan las
 *    propuestas y las herramientas, y no se le enseña al lector.
 */

/** Tramo de una era ya resuelto sobre el eje. `fin` es exclusivo. */
export interface TramoEra {
  era: Era;
  /** null si la primera era no tiene inicio: se cuenta hacia atrás desde su fin. */
  inicio: number | null;
  /** Inicio de la era siguiente, o null si es la última. */
  fin: number | null;
}

/**
 * Las eras utilizables, en orden. La primera siempre entra, con o sin inicio; las
 * demás solo si tienen año de inicio y es posterior al de la anterior. Una era a
 * medio configurar se ignora en lugar de producir años absurdos.
 */
export function tramosDeEras(cal: Calendario): TramoEra[] {
  const eras = [...cal.eras].sort((a, b) => a.orden - b.orden || a.id - b.id);
  if (eras.length === 0) return [];
  const tramos: TramoEra[] = [{ era: eras[0], inicio: eras[0].anioInicio, fin: null }];
  for (const era of eras.slice(1)) {
    const previo = tramos[tramos.length - 1];
    if (era.anioInicio == null) continue;
    if (previo.inicio != null && era.anioInicio <= previo.inicio) continue;
    previo.fin = era.anioInicio;
    tramos.push({ era, inicio: era.anioInicio, fin: null });
  }
  return tramos;
}

/** Tramo en el que cae un año: la primera era recoge lo anterior. Null si no hay eras. */
export function tramoDeAnio(cal: Calendario, anio: number): TramoEra | null {
  const tramos = tramosDeEras(cal);
  for (let i = tramos.length - 1; i >= 0; i--) {
    const t = tramos[i];
    if (t.inicio != null && anio >= t.inicio) return t;
  }
  return tramos[0] ?? null;
}

/** Era en la que cae un año, o null si no hay eras. */
export function eraDeAnio(cal: Calendario, anio: number): Era | null {
  return tramoDeAnio(cal, anio)?.era ?? null;
}

/** El número de un año dentro de su era, el que se teclea. Sin era que lo sitúe, el del eje. */
export function numeroEnEra(cal: Calendario, anio: number): number {
  const t = tramoDeAnio(cal, anio);
  return t?.inicio != null && anio >= t.inicio ? anio - t.inicio + 1 : anio;
}

/** "de la Era Post-Ishkoria"; en corto, su abreviatura si la tiene. */
function nombreEra(era: Era, corto: boolean): string {
  const abreviatura = era.abreviatura?.trim();
  return corto && abreviatura ? abreviatura : `de la ${era.nombre}`;
}

/** Nombre de una era tras "fin de": "la Era de Paz" o, en corto, "la E.P.". */
function finDe(era: Era, corto: boolean): string {
  const abreviatura = era.abreviatura?.trim();
  return `la ${corto && abreviatura ? abreviatura : era.nombre}`;
}

/**
 * Un año, en eras. Null si las eras no alcanzan para situarlo (por ejemplo,
 * la primera era sin inicio y sin una segunda configurada).
 */
export function anioEnEras(cal: Calendario, anio: number, corto = false): string | null {
  const t = tramoDeAnio(cal, anio);
  if (!t) return null;
  if (t.inicio != null && anio >= t.inicio) return `Año ${anio - t.inicio + 1} ${nombreEra(t.era, corto)}`;
  // Antes de la segunda era, con la primera sin inicio: hacia atrás desde su fin.
  if (t.inicio != null || t.fin == null) return null;
  return `${t.fin - anio} antes del fin de ${finDe(t.era, corto)}`;
}

/** 1000 → "1.000": sin depender del idioma del navegador, para no romper la hidratación. */
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const cuantos = (n: number) => `${miles(n)} ${n === 1 ? "año" : "años"}`;

/** La distancia de un año al inicio del rol. */
function anioRelativo(anio: number): string {
  if (anio === 0) return "Año del inicio del rol";
  return `${cuantos(Math.abs(anio))} ${anio < 0 ? "antes" : "después"} del inicio del rol`;
}

function rangoRelativo(a: number, b: number): string {
  if (a === b) return anioRelativo(a);
  if (a === 0) return `Del inicio del rol a ${cuantos(b)} después`;
  if (b === 0) return `De ${cuantos(-a)} antes al inicio del rol`;
  if (a < 0 && b < 0) return `De ${miles(-a)} a ${cuantos(-b)} antes del inicio del rol`;
  if (a > 0 && b > 0) return `De ${miles(a)} a ${cuantos(b)} después del inicio del rol`;
  return `De ${cuantos(-a)} antes a ${cuantos(b)} después del inicio del rol`;
}

/** Un año en la lectura pedida. Las eras caen al eje si no pueden situarlo. */
export function formatoAnio(cal: Calendario, anio: number, modo: ModoFecha): string {
  if (modo === "relativo") return anioRelativo(anio);
  if (modo === "eras") {
    const e = anioEnEras(cal, anio);
    if (e) return e;
  }
  return `Año ${anio}`;
}

/** Un año para insignias y listas densas: "1013 Post-I.", "1.000 antes". */
export function anioCorto(cal: Calendario, anio: number, modo: ModoFecha): string {
  if (modo === "relativo") return anio === 0 ? "Inicio del rol" : `${miles(Math.abs(anio))} ${anio < 0 ? "antes" : "después"}`;
  const e = modo === "eras" ? anioEnEras(cal, anio, true) : null;
  if (!e) return String(anio);
  return e.startsWith("Año ") ? e.slice(4) : e;
}

/** "la Cuarta Luna" o "los Días de Ceniza". Null si el segmento ya no existe. */
function nombreSegmento(cal: Calendario, id: number): { nombre: string; intercalar: boolean } | null {
  const s = segmentosOrdenados(cal).find((x) => x.id === id);
  return s ? { nombre: s.nombre, intercalar: s.tipo === "intercalar" } : null;
}

/** Día y segmento sin el año: "12 de la Cuarta Luna", "día 2 de los Días de Ceniza". */
function sinAnio(cal: Calendario, e: Extremo): string | null {
  if (e.segmentoId == null) return null;
  const seg = nombreSegmento(cal, e.segmentoId);
  if (!seg) return null;
  if (e.dia == null) return seg.nombre;
  return seg.intercalar ? `día ${e.dia} de ${seg.nombre}` : `${e.dia} de ${seg.nombre}`;
}

/** Un extremo completo: "12 de la Cuarta Luna, año 1013 de la Era Post-Ishkoria". */
export function formatoExtremo(cal: Calendario, e: Extremo, modo: ModoFecha): string {
  const anio = formatoAnio(cal, e.anio, modo);
  const parte = sinAnio(cal, e);
  if (!parte) return anio;
  return `${mayuscula(parte)}, ${minuscula(anio)}`;
}

/**
 * Una fecha completa, punto o rango, compactando lo que se repite:
 *   "Del 3 al 9 de la Cuarta Luna, año 1013 de la Era Post-Ishkoria"
 *   "De la Segunda Luna a la Sexta Luna, año 20 de la Era de Ishkoria"
 *   "Del año 3 de la Era Pre-Ishkoria al año 4000 de la Era Pre-Ishkoria"
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
    // Mismo mes y los dos con día: "Del 3 al 9 de la Cuarta Luna".
    if (a.segmentoId === b.segmentoId && a.dia != null && b.dia != null) {
      const seg = nombreSegmento(cal, a.segmentoId!);
      return `Del ${a.dia} al ${b.dia} de ${seg?.nombre ?? ""}, ${anio}`;
    }
    return `${desde(pa, a.dia != null)} ${hasta(pb, b.dia != null)}, ${anio}`;
  }

  // Dos años sin más precisión.
  if (!pa && !pb) {
    if (modo === "relativo") return rangoRelativo(a.anio, b.anio);
    return `Del ${minuscula(formatoAnio(cal, a.anio, modo))} al ${minuscula(formatoAnio(cal, b.anio, modo))}`;
  }

  return `${formatoExtremo(cal, a, modo)} – ${formatoExtremo(cal, b, modo)}`;
}

/** "Del 3 de la Cuarta Luna" / "De la Cuarta Luna". */
function desde(parte: string, conDia: boolean): string {
  return conDia ? `Del ${parte}` : `De ${parte}`;
}

/** "al 5 de la Sexta Luna" / "a la Sexta Luna". */
function hasta(parte: string, conDia: boolean): string {
  return conDia ? `al ${parte}` : `a ${parte}`;
}

/**
 * Versión corta para insignias y listas densas: solo años.
 * "1013 Post-I.", "3 E.I. a 40 E.I.", "≈ 1.000 antes".
 */
export function formatoCorto(cal: Calendario, f: Fecha, modo: ModoFecha): string {
  const uno = (anio: number) => anioCorto(cal, anio, modo);
  const base = f.fin && f.fin.anio !== f.ini.anio ? `${uno(f.ini.anio)} a ${uno(f.fin.anio)}` : uno(f.ini.anio);
  return f.aproximada ? `≈ ${base}` : base;
}

/**
 * Una fecha escrita en todas las lecturas. El servidor las calcula y el navegador
 * enseña la que haya elegido el lector, así el cliente no necesita el calendario
 * para pintar una fecha.
 */
export interface TextosFecha {
  eras: string;
  relativo: string;
  /** Interno: la lectura del eje, para las propuestas y las herramientas. */
  absoluto: string;
}

export function textosFecha(cal: Calendario, f: Fecha, corto = false): TextosFecha {
  const fmt = corto ? formatoCorto : formatoFecha;
  return { eras: fmt(cal, f, "eras"), relativo: fmt(cal, f, "relativo"), absoluto: fmt(cal, f, "absoluto") };
}

export function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Solo baja "Año" a "año"; no toca nombres propios de meses ni eras. */
function minuscula(s: string): string {
  return s.startsWith("Año ") ? `año ${s.slice(4)}` : s;
}
