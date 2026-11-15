/**
 * Rejillas de datos sin casillas vacías. Las casillas se separan con 1 px del fondo de la rejilla
 * (`gap-px` sobre `bg-border-base`), así que un hueco al final de la última fila se veía como una
 * casilla rellena del color del borde (pasaba en «Fechas» con dos datos en tres columnas).
 *
 * Las clases van escritas enteras para que Tailwind las encuentre.
 */

const COLUMNAS_SM = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const;
const SPAN = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3" } as const;
const SPAN_SM = { 1: "sm:col-span-1", 2: "sm:col-span-2", 3: "sm:col-span-3" } as const;

type Cols = 1 | 2 | 3;

/** En pantallas anchas, tantas columnas como datos, hasta tres. */
export function columnasSm(n: number): string {
  return COLUMNAS_SM[Math.min(Math.max(n, 1), 3) as Cols];
}

/**
 * La última casilla se estira hasta el final de su fila, en el móvil (`movil` columnas) y en
 * pantallas anchas (las de `columnasSm`). Las demás no llevan nada.
 */
export function estirarUltima(i: number, n: number, movil: 1 | 2): string {
  if (i !== n - 1) return "";
  const sm = Math.min(n, 3) as Cols;
  const restoMovil = n % movil;
  const restoSm = n % sm;
  const enMovil = (restoMovil ? movil - restoMovil + 1 : 1) as Cols;
  const enSm = (restoSm ? sm - restoSm + 1 : 1) as Cols;
  if (enMovil === 1 && enSm === 1) return "";
  return `${SPAN[enMovil]} ${SPAN_SM[enSm]}`;
}
