import { etiquetaInversa } from "@/lib/catalogos";

/**
 * Relaciones entre personajes: cada una se guarda en DOS filas de `relaciones`, una por
 * ficha (A→B y B→A), y las dos dicen lo mismo visto desde cada lado. Este módulo sabe
 * dar la vuelta a una fila y emparejar las dos mitades. Lo usan el formulario del
 * personaje (para enseñar todas sus relaciones) y el guardado (para escribir la otra
 * mitad), así que no toca la base: es seguro en el cliente.
 *
 * Una fila A→B describe a B visto por A: «A → B, Salvador» dice que B salvó a A. Su
 * vuelta, B → A, dice «Salvado»: describe a A.
 */

export interface ValoresRelacion {
  tipoRelacion: string;
  subtipoRelacion: string;
  /** Lo que siente quien es dueño de la fila por el otro. */
  afecto: string;
  /** Lo que siente el otro por el dueño de la fila. */
  afectoReciproco: string;
  descripcion: string;
}

/** Una fila de `relaciones` tal como la lee Drizzle (solo lo que hace falta aquí). */
export interface FilaRelacion {
  idRr: number;
  tipoRelacion: string | null;
  subtipoRelacion: string | null;
  afecto: string | null;
  afectoReciproco: string | null;
  descripcion: string | null;
  oculto: boolean;
}

/** Las dos mitades de una relación con el mismo personaje. Puede faltar una. */
export interface Pareja<F extends FilaRelacion = FilaRelacion> {
  /** La fila de esta ficha (yo → otro). */
  propia?: F;
  /** La del otro (otro → yo). */
  vuelta?: F;
}

const t = (v: string | null | undefined) => (v ?? "").trim();

export function valoresDe(f: Partial<Record<keyof ValoresRelacion, string | null>>): ValoresRelacion {
  return {
    tipoRelacion: t(f.tipoRelacion),
    subtipoRelacion: t(f.subtipoRelacion),
    afecto: t(f.afecto),
    afectoReciproco: t(f.afectoReciproco),
    descripcion: t(f.descripcion),
  };
}

export function mismosValores(a: ValoresRelacion, b: ValoresRelacion): boolean {
  return (
    a.tipoRelacion === b.tipoRelacion &&
    a.subtipoRelacion === b.subtipoRelacion &&
    a.afecto === b.afecto &&
    a.afectoReciproco === b.afectoReciproco &&
    a.descripcion === b.descripcion
  );
}

/** Parentescos: cada matiz con su inverso, en masculino y femenino. */
const PARENTESCO: Record<string, [string, string]> = {
  Padre: ["Hijo", "Hija"],
  Madre: ["Hijo", "Hija"],
  Hijo: ["Padre", "Madre"],
  Hija: ["Padre", "Madre"],
  Hermano: ["Hermano", "Hermana"],
  Hermana: ["Hermano", "Hermana"],
  Abuelo: ["Nieto", "Nieta"],
  Abuela: ["Nieto", "Nieta"],
  Nieto: ["Abuelo", "Abuela"],
  Nieta: ["Abuelo", "Abuela"],
  Tío: ["Sobrino", "Sobrina"],
  Tía: ["Sobrino", "Sobrina"],
  Sobrino: ["Tío", "Tía"],
  Sobrina: ["Tío", "Tía"],
  Primo: ["Primo", "Prima"],
  Prima: ["Primo", "Prima"],
};

/**
 * El matiz de la fila de vuelta. «Padre» en la fila de A (B es su padre) es «Hija» en la
 * de B si A es mujer: para elegir entre «Hijo» e «Hija» hace falta el género de quien
 * queda descrito. Si no es masculino ni femenino, el matiz se deja vacío para
 * que lo elija el autor: los parentescos del catálogo solo tienen esas dos formas. Lo
 * que no es un parentesco («Mejor amigo», «Adoptivo») se copia tal cual.
 */
export function subtipoInverso(subtipo: string, generoDelDescrito: string | null | undefined): string {
  const formas = PARENTESCO[subtipo];
  if (!formas) return subtipo;
  if (generoDelDescrito === "Masculino") return formas[0];
  if (generoDelDescrito === "Femenino") return formas[1];
  return "";
}

/**
 * La misma relación vista desde el otro lado: término inverso (Salvador ↔ Salvado), matiz
 * inverso y los afectos cruzados (lo que siente uno es lo que le devuelve al otro). La
 * descripción es la misma en las dos fichas.
 *
 * `generoDelDescrito` es el del dueño de la fila original: en la vuelta pasa a ser el otro.
 */
export function reflejar(v: ValoresRelacion, generoDelDescrito: string | null | undefined): ValoresRelacion {
  return {
    tipoRelacion: etiquetaInversa(v.tipoRelacion) ?? "",
    subtipoRelacion: subtipoInverso(v.subtipoRelacion, generoDelDescrito),
    afecto: v.afectoReciproco,
    afectoReciproco: v.afecto,
    descripcion: v.descripcion,
  };
}

/**
 * Junta las filas propias con un personaje y las suyas hacia este en parejas. Primero por
 * término (la vuelta de «Salvador» es «Salvado»); lo que sobra, por orden, porque una
 * vuelta con el término mal puesto sigue siendo la misma relación.
 */
export function emparejar<F extends FilaRelacion>(propias: F[], vueltas: F[]): Pareja<F>[] {
  const libres = [...vueltas].sort((a, b) => a.idRr - b.idRr);
  const parejas: Pareja<F>[] = [...propias]
    .sort((a, b) => a.idRr - b.idRr)
    .map((propia) => {
      const i = libres.findIndex((v) => t(v.tipoRelacion) === (etiquetaInversa(t(propia.tipoRelacion)) ?? ""));
      return i >= 0 ? { propia, vuelta: libres.splice(i, 1)[0] } : { propia };
    });
  for (const p of parejas) if (!p.vuelta && libres.length) p.vuelta = libres.shift();
  for (const vuelta of libres) parejas.push({ vuelta });
  return parejas;
}

/**
 * Lo que la ficha enseña de una pareja: su fila si la tiene y, si solo existe la del otro,
 * esa dada la vuelta. `generoDelOtro` sirve para el matiz en ese segundo caso.
 */
export function vistaDe(p: Pareja, generoDelOtro: string | null | undefined): ValoresRelacion {
  if (p.propia) return valoresDe(p.propia);
  return reflejar(valoresDe(p.vuelta!), generoDelOtro);
}
