/**
 * Tipos del sistema de fechas del lore (spec del taller §13). Client-safe.
 *
 * Todo se apoya en un **eje absoluto** de años enteros con el año 0 en el inicio
 * de la trama principal: antes, negativos; después, positivos; el 0 existe. Las
 * eras y el calendario son formas de *leer* ese eje, no de guardarlo, así que
 * reconfigurarlos nunca cambia cuándo pasó algo.
 */

/** Un mes normal o un bloque de días que no pertenece a ningún mes. */
export type TipoSegmento = "mes" | "intercalar";

/** Un tramo del año, en orden: los meses y los bloques de días fuera de mes. */
export interface Segmento {
  id: number;
  orden: number;
  nombre: string;
  dias: number;
  tipo: TipoSegmento;
}

export interface Era {
  id: number;
  orden: number;
  nombre: string;
  abreviatura: string | null;
  /**
   * Año absoluto en que empieza. La primera era no lo tiene: se extiende sin
   * límite hacia atrás y se cuenta hacia atrás desde su fin. En las demás, null
   * significa "aún sin configurar" y la era se ignora al formatear.
   */
  anioInicio: number | null;
}

/** Uno para todo el mundo. */
export interface Calendario {
  segmentos: Segmento[];
  /** Nombres de los días de la semana, en orden. Su número es la longitud. */
  diasSemana: string[];
  eras: Era[];
}

/**
 * Un extremo de una fecha. La precisión la da qué hay relleno:
 * solo año · año + segmento · año + segmento + día.
 */
export interface Extremo {
  anio: number;
  segmentoId: number | null;
  dia: number | null;
}

/** Una fecha del lore: un punto (sin `fin`) o un rango. */
export interface Fecha {
  ini: Extremo;
  fin: Extremo | null;
  aproximada: boolean;
}

/** Cómo quiere leer las fechas el lector (§13, conmutador). */
export type ModoFecha = "eras" | "absoluto";
