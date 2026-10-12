import { aniosEntre } from "./calendario.ts";
import type { Calendario } from "./tipos.ts";

/**
 * Edad de un personaje según el momento de lectura (spec §13, "Edad de los
 * personajes"). Pura y client-safe.
 *
 * Todo va en días absolutos (claves). Del nacimiento se toma el primer día que
 * cubre: si solo se sabe el año, se cuenta desde su comienzo. De la muerte,
 * también el primero, que es cuando ya consta que murió.
 */
export type Edad =
  | { estado: "viva"; anios: number }
  | { estado: "murio"; anios: number }
  /** El momento de lectura es anterior al nacimiento. */
  | { estado: "por-nacer" };

export function edadEn(cal: Calendario, nacimiento: number, muerte: number | null, momento: number): Edad {
  if (momento < nacimiento) return { estado: "por-nacer" };
  if (muerte != null && muerte <= momento) return { estado: "murio", anios: Math.max(0, aniosEntre(cal, nacimiento, muerte)) };
  return { estado: "viva", anios: aniosEntre(cal, nacimiento, momento) };
}

export function textoEdad(e: Edad): string {
  if (e.estado === "por-nacer") return "Aún no ha nacido";
  const n = `${e.anios} ${e.anios === 1 ? "año" : "años"}`;
  return e.estado === "murio" ? `Murió a los ${n}` : n;
}
