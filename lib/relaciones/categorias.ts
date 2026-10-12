/**
 * Categorías de las relaciones entre personajes (spec del taller §11,
 * "Categorías de relación"). Client-safe.
 *
 * Agrupan los tipos de `tipo_relacion` (Aliado, Rival, Mentor…) para pintar el
 * mapa: cada categoría tiene nombre, color, icono y estilo de línea. Se guardan
 * como opciones del catálogo `relacion_categoria`, con lo visual en `meta`; cada
 * opción de `tipo_relacion` apunta a su categoría con `meta.categoriaId`. Al ir
 * por id, renombrar una categoría o un tipo no rompe la asignación.
 *
 * Solo afectan a las aristas personaje–personaje: el resto conserva su color.
 */

export const CAMPO_CATEGORIA = "relacion_categoria";

export type EstiloLinea = "continua" | "discontinua" | "punteada";

export const ESTILOS_LINEA: { id: EstiloLinea; etiqueta: string }[] = [
  { id: "continua", etiqueta: "Continua" },
  { id: "discontinua", etiqueta: "Discontinua" },
  { id: "punteada", etiqueta: "Punteada" },
];

/** Patrón de trazo para canvas y SVG; null = continua. */
export const PATRON_LINEA: Record<EstiloLinea, number[] | null> = {
  continua: null,
  discontinua: [6, 4],
  punteada: [1.5, 3],
};

export interface CategoriaRelacion {
  id: number;
  nombre: string;
  color: string;
  icono: string;
  estilo: EstiloLinea;
}

/** Un tipo de relación (opción de `tipo_relacion`) y la categoría a la que va. */
export interface TipoRelacionAsignado {
  id: number;
  valor: string;
  categoriaId: number | null;
}

export const COLOR_CATEGORIA_POR_DEFECTO = "#9aa3b2";

/** Lee el `meta` de una opción del catálogo de categorías con valores seguros. */
export function aCategoria(fila: { id: number; valor: string; meta: Record<string, unknown> | null }): CategoriaRelacion {
  const m = fila.meta ?? {};
  const estilo = ESTILOS_LINEA.some((e) => e.id === m.estilo) ? (m.estilo as EstiloLinea) : "continua";
  const color = typeof m.color === "string" && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : COLOR_CATEGORIA_POR_DEFECTO;
  return { id: fila.id, nombre: fila.valor, color, icono: typeof m.icono === "string" ? m.icono : "Circle", estilo };
}
