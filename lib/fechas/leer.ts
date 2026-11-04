import { segmentosOrdenados } from "./calendario.ts";
import { tramosDeEras } from "./formato.ts";
import type { Calendario, Extremo, Fecha, Segmento } from "./tipos.ts";

/**
 * Lee una fecha escrita como la escribe `formatoFecha`: "Año 1203", "Mes 3, año 1203",
 * "20 de Mes 3, año 1203", "Del año 10 al año 15", "Del 3 al 9 de Mes 3, año -100",
 * "12 de Mes 3, año -100 – Mes 5, año -98", con "(aprox.)" al final si lo es. Es el
 * camino inverso, para las fechas de las propuestas (docs/propuestas-formato.md).
 *
 * También entiende el año en eras cuando puede situarlo ("Año 312 E.A.") y la salida
 * de `pnpm lore ficha` ("Año 312 E.A. (absoluto: Año 5)"). Lo demás devuelve null: una
 * fecha adivinada es peor que una pregunta. Pura y client-safe.
 */

const NUMERO_ANIO = String.raw`(-?\d+)(?:\s+(.+))?`;

function segmentoPorNombre(cal: Calendario, nombre: string): Segmento | null {
  const n = nombre.trim().toLowerCase();
  return segmentosOrdenados(cal).find((s) => s.nombre.toLowerCase() === n) ?? null;
}

/** El año absoluto de "1203" o de "312 E.A.". */
function anioDe(cal: Calendario, numero: string, era: string | undefined): number | null {
  const n = Number(numero);
  if (!Number.isInteger(n)) return null;
  if (!era) return n;
  const e = era.trim().toLowerCase().replace(/^de la\s+/, "");
  const tramo = tramosDeEras(cal).find((t) => t.era.nombre.toLowerCase() === e || t.era.abreviatura?.trim().toLowerCase() === e);
  return tramo?.inicio == null ? null : tramo.inicio + n - 1;
}

/** "20 de Mes 3", "día 2 de Noches" o "Mes 3", sin el año. */
function parteDelAnio(cal: Calendario, texto: string): { segmentoId: number; dia: number | null } | null {
  const t = texto.trim();
  const conDia = t.match(/^(?:d[ií]a\s+)?(\d+)\s+de\s+(.+)$/i);
  if (conDia) {
    const seg = segmentoPorNombre(cal, conDia[2]);
    if (seg) return { segmentoId: seg.id, dia: Number(conDia[1]) };
  }
  const seg = segmentoPorNombre(cal, t);
  return seg ? { segmentoId: seg.id, dia: null } : null;
}

function extremoCompleto(cal: Calendario, texto: string): Extremo | null {
  const t = texto.trim();
  const soloAnio = t.match(new RegExp(`^año\\s+${NUMERO_ANIO}$`, "i"));
  if (soloAnio) {
    const anio = anioDe(cal, soloAnio[1], soloAnio[2]);
    return anio == null ? null : { anio, segmentoId: null, dia: null };
  }
  const conParte = t.match(new RegExp(`^(.+),\\s*año\\s+${NUMERO_ANIO}$`, "i"));
  if (!conParte) return null;
  const anio = anioDe(cal, conParte[2], conParte[3]);
  const parte = parteDelAnio(cal, conParte[1]);
  return anio == null || !parte ? null : { anio, ...parte };
}

/** "Del 3 al 9 de Mes 3", "De Mes 2 a Mes 6", "Del 3 de Mes 2 al 5 de Mes 4" dentro de un año. */
function rangoEnUnAnio(cal: Calendario, cuerpo: string, anio: number): Fecha | null {
  // El nombre de un mes puede llevar " a " dentro: se prueba cada corte posible.
  const cortes = [...cuerpo.matchAll(/\s+al?\s+/gi)];
  for (const c of cortes) {
    const izq = cuerpo.slice(0, c.index);
    const der = cuerpo.slice(c.index + c[0].length);
    const fin = parteDelAnio(cal, der);
    if (!fin) continue;
    const ini = /^\d+$/.test(izq.trim()) ? { segmentoId: fin.segmentoId, dia: Number(izq) } : parteDelAnio(cal, izq);
    if (!ini) continue;
    return { ini: { anio, ...ini }, fin: { anio, ...fin }, aproximada: false };
  }
  return null;
}

function sinAproximar(cal: Calendario, texto: string): Fecha | null {
  const aniosRango = texto.match(new RegExp(`^del\\s+año\\s+(-?\\d+)(?:\\s+(.+?))?\\s+al\\s+año\\s+${NUMERO_ANIO}$`, "i"));
  if (aniosRango) {
    const a = anioDe(cal, aniosRango[1], aniosRango[2]);
    const b = anioDe(cal, aniosRango[3], aniosRango[4]);
    if (a == null || b == null) return null;
    return { ini: { anio: a, segmentoId: null, dia: null }, fin: { anio: b, segmentoId: null, dia: null }, aproximada: false };
  }

  const conGuion = texto.split(/\s+[–—]\s+/);
  if (conGuion.length === 2) {
    const ini = extremoCompleto(cal, conGuion[0]);
    const fin = extremoCompleto(cal, conGuion[1]);
    return ini && fin ? { ini, fin, aproximada: false } : null;
  }

  const rango = texto.match(new RegExp(`^del?\\s+(.+),\\s*año\\s+${NUMERO_ANIO}$`, "i"));
  if (rango) {
    const anio = anioDe(cal, rango[2], rango[3]);
    return anio == null ? null : rangoEnUnAnio(cal, rango[1], anio);
  }

  const ini = extremoCompleto(cal, texto);
  return ini ? { ini, fin: null, aproximada: false } : null;
}

export function leerFecha(cal: Calendario, texto: string | null | undefined): Fecha | null {
  if (!texto) return null;
  const absoluto = texto.match(/\(absoluto:\s*([^)]*(?:\([^)]*\)[^)]*)*)\)/i);
  let t = (absoluto ? absoluto[1] : texto).replace(/[★🔒]/gu, "").replace(/importante/i, "").trim();
  const aproximada = /\(aprox\.?\)\s*$/i.test(t);
  t = t.replace(/\s*\(aprox\.?\)\s*$/i, "").trim();
  const fecha = sinAproximar(cal, t);
  return fecha && { ...fecha, aproximada };
}
