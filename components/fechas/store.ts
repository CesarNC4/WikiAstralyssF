"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { ModoFecha } from "@/lib/fechas";

/**
 * Cómo lee el visitante las fechas (spec §13):
 *
 *  - `modo`: en eras o en el eje absoluto. Se recuerda en su navegador.
 *  - `momento`: el día absoluto desde el que se calculan las edades. Por defecto
 *    el año 0; lo fijan solos el capítulo y el acto al abrirse, y se puede
 *    cambiar a mano. Solo afecta a las edades: no oculta nada.
 *
 * El momento dura lo que la visita (memoria de la pestaña), a propósito: quien
 * lee el capítulo 3 y salta a un personaje quiere su edad en el capítulo 3, pero
 * mañana empieza de cero.
 */
interface Lectura {
  modo: ModoFecha;
  /** null = el año 0. */
  momento: number | null;
  /** De dónde sale el momento: "inicio del Capítulo 3". Null si es manual o el de defecto. */
  origen: string | null;
  setModo: (m: ModoFecha) => void;
  setMomento: (clave: number | null, origen?: string | null) => void;
}

const CLAVE = "astralys:modo-fecha";

export const useLectura = create<Lectura>((set) => ({
  modo: "eras",
  momento: null,
  origen: null,
  setModo: (modo) => {
    set({ modo });
    try {
      window.localStorage.setItem(CLAVE, modo);
    } catch {
      // Sin almacenamiento (modo privado, bloqueado): se recuerda solo en esta pestaña.
    }
  },
  setMomento: (momento, origen = null) => set({ momento, origen }),
}));

let cargado = false;

/**
 * Lee la preferencia guardada una vez, ya en el navegador. Se hace después de
 * hidratar (en un efecto) para que el primer render del cliente coincida con el
 * del servidor, que siempre pinta en eras.
 */
export function useModoFecha(): ModoFecha {
  const modo = useLectura((s) => s.modo);
  useEffect(() => {
    if (cargado) return;
    cargado = true;
    try {
      const v = window.localStorage.getItem(CLAVE);
      if (v === "eras" || v === "absoluto") useLectura.setState({ modo: v });
    } catch {
      // Ídem: sin almacenamiento se queda el valor por defecto.
    }
  }, []);
  return modo;
}
