/**
 * Sub-listas de texto libre de una entidad. NO son relaciones entre fichas: para
 * eso está el registro de `lib/relaciones/registro.ts`, que genera los bloques
 * en los dos sentidos. Aquí sólo queda lo que es una lista propia de la ficha y
 * no apunta a ninguna otra.
 */

export interface RelacionDef {
  /** Key única del bloque dentro de la entidad (coincide con la tabla). */
  key: string;
  titulo: string;
  icon: string;
  hint?: string;
  /** Cada fila es texto libre, sin enlace a otra ficha. */
  libre: { col: string; label: string; detalleCol?: string; detalleLabel?: string };
  reorder?: boolean;
}

export const RELACIONES_POR_ENTIDAD: Record<string, RelacionDef[]> = {
  minerales: [
    {
      key: "mineral_uso",
      titulo: "Usos / aplicaciones",
      icon: "Layers",
      libre: { col: "nombre", label: "Uso", detalleCol: "detalle", detalleLabel: "Detalle" },
      reorder: true,
    },
  ],
};

export function getRelacionesDe(entidad: string): RelacionDef[] {
  return RELACIONES_POR_ENTIDAD[entidad] ?? [];
}

/** Fila uniforme que viaja entre cliente y servidor. */
export interface RelacionRow {
  /** Valores de las columnas de texto por nombre. */
  campos: Record<string, string>;
}
