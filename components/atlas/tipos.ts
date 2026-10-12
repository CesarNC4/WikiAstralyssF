import type { AristaMapa, NodoMapa } from "@/lib/queries/mapaRelaciones";

/** Lo que reciben las dos vistas del Atlas (3D y 2D). Client-safe. */
export type NodoGrafo = NodoMapa & { grado: number };

export interface PropsGrafo {
  nodos: NodoGrafo[];
  aristas: AristaMapa[];
  estilo: (a: AristaMapa) => { color: string; patron: number[] | null };
  /** Ficha elegida y sus vecinas: se resaltan y el resto se apaga. */
  seleccion: string | null;
  vecinos: Set<string> | null;
  /** Cambia `n` para volver a centrar aunque sea la misma ficha. */
  foco: { id: string; n: number } | null;
  onNodo: (id: string | null) => void;
}

export interface EnlaceGrafo {
  id: string;
  source: string;
  target: string;
  arista: AristaMapa;
}
