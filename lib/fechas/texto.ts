/**
 * Interpreta las fechas que se escribieron a mano antes de que existiera la
 * fecha estructurada (`fecha_lore`, `fundacion`, `era_aparicion`…). Lo usa la
 * migración, que primero enseña qué entiende y solo escribe con visto bueno.
 *
 * Es deliberadamente estrecho: entiende años y rangos de años, que es todo lo
 * que hay en la base ("-10000 a -6000", "Año -1", "Año -1000 aproximadamente.",
 * "-500 años"). Lo demás devuelve null para que una persona lo revise, porque
 * adivinar una fecha es peor que dejarla vacía.
 */

export interface FechaTexto {
  iniAnio: number;
  finAnio: number | null;
  aproximada: boolean;
}

const APROXIMADA = /\b(aproximadamente|aprox\.?|hacia|circa|ca\.)/;

/** Duraciones ("19 días", "3 meses"): no son fechas y no se convierten. */
const DURACION = /\b\d+\s*(d[ií]as?|semanas?|meses|mes)\b/;

export function interpretarFechaTexto(texto: string | null | undefined): FechaTexto | null {
  if (!texto) return null;
  let t = texto
    .toLowerCase()
    .replace(/[−–—]/g, (c) => (c === "−" ? "-" : " a "))
    .trim();
  if (DURACION.test(t)) return null;

  const aproximada = APROXIMADA.test(t);
  t = t
    .replace(APROXIMADA, " ")
    .replace(/\baños?\b/g, " ")
    .replace(/[.:;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rango = t.match(/^(-?\d+)\s+(?:a|al|hasta)\s+(-?\d+)$/);
  if (rango) {
    const ini = Number(rango[1]);
    const fin = Number(rango[2]);
    // Un rango al revés es más probable que sea una errata que una fecha.
    if (fin < ini) return null;
    return { iniAnio: ini, finAnio: fin === ini ? null : fin, aproximada };
  }

  const punto = t.match(/^(-?\d+)$/);
  if (punto) return { iniAnio: Number(punto[1]), finAnio: null, aproximada };

  return null;
}
