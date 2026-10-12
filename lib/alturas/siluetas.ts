/**
 * Siluetas del comparador de alturas (spec §12). Client-safe.
 *
 * Una lista fija dibujada aquí: los personajes van siempre con la humana y las
 * criaturas con la que se elija en su ficha. Cada silueta es un trazado SVG en
 * su propia caja de `ancho` × `alto` unidades, de perfil salvo la humana. Al
 * dibujarla se escala para que mida lo que dice la ficha: su alto en la vista
 * de alturas y su ancho (la longitud) en la de longitudes.
 */

export interface Silueta {
  id: string;
  etiqueta: string;
  ancho: number;
  alto: number;
  d: string;
  /** Estira el trazado en horizontal (la humanoide es la humana más corpulenta). */
  escalaX?: number;
}

const HUMANA =
  "M20 1 A8 8 0 1 1 19.99 1 Z " +
  "M13 19 L27 19 Q32 19 33 25 L36 52 Q36.5 55 34 55.5 Q31.5 56 31 53 L28.5 33 L28.5 60 L27.5 97 Q27.3 99.5 24.5 99.5 " +
  "Q22 99.5 21.8 97 L20.6 62 L19.4 62 L18.2 97 Q18 99.5 15.5 99.5 Q12.7 99.5 12.5 97 L11.5 60 L11.5 33 L9 53 " +
  "Q8.5 56 6 55.5 Q3.5 55 4 52 L7 25 Q8 19 13 19 Z";

export const SILUETAS: Silueta[] = [
  { id: "humana", etiqueta: "Humana", ancho: 40, alto: 100, d: HUMANA },
  { id: "humanoide", etiqueta: "Humanoide", ancho: 40, alto: 100, d: HUMANA, escalaX: 1.35 },
  {
    id: "cuadrupedo",
    etiqueta: "Cuadrúpedo",
    ancho: 100,
    alto: 60,
    d:
      "M18 22 Q20 14 32 14 L70 14 Q80 14 84 20 L86 10 Q87 4 92 4 L97 6 Q100 8 97 11 L92 12 L90 24 Q88 30 84 30 " +
      "L82 56 Q82 59 79 59 Q76 59 76 56 L74 34 L36 34 L33 56 Q33 59 30 59 Q27 59 27 56 L25 33 Q19 31 18 26 " +
      "L8 20 Q5 18 7 16 Q9 15 11 17 Z",
  },
  {
    id: "alado",
    etiqueta: "Alado",
    ancho: 100,
    alto: 70,
    d:
      "M10 50 Q30 42 45 44 L50 20 Q52 6 60 2 Q62 14 60 30 L64 44 Q78 42 86 36 L94 32 Q99 32 97 36 L90 44 " +
      "Q86 50 76 52 L70 54 L68 68 L64 68 L64 55 L48 56 L46 68 L42 68 L42 56 Q26 56 10 50 Z",
  },
  {
    id: "serpentino",
    etiqueta: "Serpentino",
    ancho: 100,
    alto: 30,
    d:
      "M2 18 Q14 4 26 16 Q38 28 50 16 Q62 4 74 16 Q82 24 88 18 Q92 12 98 14 Q100 18 96 20 Q92 21 90 24 " +
      "Q82 32 72 22 Q62 12 52 24 Q40 36 26 24 Q16 14 6 24 Q2 26 2 18 Z",
  },
  {
    id: "acuatico",
    etiqueta: "Acuático",
    ancho: 100,
    alto: 40,
    d: "M4 20 Q20 2 52 4 Q76 6 84 18 L98 6 Q100 20 98 34 L84 22 Q76 34 52 36 Q20 38 4 20 Z",
  },
  {
    id: "amorfo",
    etiqueta: "Amorfo",
    ancho: 80,
    alto: 60,
    d: "M10 40 Q0 20 20 12 Q30 0 48 8 Q70 2 76 22 Q84 40 70 50 Q60 60 40 56 Q16 60 10 40 Z",
  },
];

/** Las que se pueden elegir para una criatura (la humana es solo de personajes). */
export const SILUETAS_DE_CRIATURA = SILUETAS.filter((s) => s.id !== "humana");

export function siluetaDe(id: string | null | undefined, porDefecto = "humanoide"): Silueta {
  return SILUETAS.find((s) => s.id === id) ?? SILUETAS.find((s) => s.id === porDefecto)!;
}

/** Ancho real de la caja, contando el estiramiento. */
export const anchoDe = (s: Silueta) => s.ancho * (s.escalaX ?? 1);
