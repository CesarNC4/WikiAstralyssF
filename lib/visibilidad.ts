/**
 * Reglas de lo oculto al público (docs/area-ia.md, Fase 4). Client-safe: las usan
 * las consultas públicas, las fichas y el panel. La lectura de la base está en
 * `lib/queries/visibilidad.ts`.
 *
 * Hay tres formas de ocultar, y las tres dejan la misma marca (se nota que hay
 * algo, pero no qué):
 *  - un campo entero de una ficha (`campo_visibilidad`),
 *  - una fila de conexión o una fecha (columna `oculto`),
 *  - un trozo dentro de un texto largo (`[[oculto]]…[[/oculto]]`).
 *
 * Todo se quita en el servidor: lo oculto no llega nunca al navegador.
 */

export const MARCA_OCULTO = "???";

export const ABRE_TROZO = "[[oculto]]";
export const CIERRA_TROZO = "[[/oculto]]";

/** Misma regla que `censurar_oculto` en la base: sin cierre, se oculta hasta el final. */
const TROZO = /\[\[oculto\]\][\s\S]*?(?:\[\[\/oculto\]\]|$)/gi;

export function censurarTexto(texto: string): string {
  return texto.includes("[[") ? texto.replace(TROZO, MARCA_OCULTO) : texto;
}

function esPlano(v: object): boolean {
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

/** Quita los trozos ocultos de todos los textos de un valor, por profundo que estén. */
export function censurar<T>(valor: T): T {
  if (typeof valor === "string") return censurarTexto(valor) as T;
  if (Array.isArray(valor)) return valor.map(censurar) as T;
  if (valor && typeof valor === "object" && esPlano(valor)) {
    const copia: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) copia[k] = censurar(v);
    return copia as T;
  }
  return valor;
}

/**
 * Campos que nacen ocultos: sin marca están ocultos, y revelarlos guarda una fila
 * con `visible = true`. Vacíos no dejan marca, o saldría en todas las fichas.
 */
export const OCULTOS_POR_DEFECTO: Record<string, string[]> = {
  personajes: ["nombreReal"],
};

export function ocultoPorDefecto(entidad: string, campo: string): boolean {
  return OCULTOS_POR_DEFECTO[entidad]?.includes(campo) ?? false;
}

/**
 * Campos que se ocultan juntos: el lugar de nacimiento es un texto y tres
 * referencias, y ocultar solo el texto dejaría a la persona en "Nacidos aquí".
 */
export const CAMPOS_LIGADOS: Record<string, Record<string, string[]>> = {
  personajes: {
    lugarNacimiento: ["lugarNacimientoNacionId", "lugarNacimientoRegionId", "lugarNacimientoLocacionId"],
    magiaPrincipalTipo: ["tipoMagiaPrincipal"],
    magiaPrincipalVariante: ["tipoMagiaPrincipal"],
    magiaSecundariaTipo: ["magiaSecundaria"],
    magiaSecundariaVariante: ["magiaSecundaria"],
  },
};

/** Campo de una ficha que no es una columna: un bloque que se oculta entero. */
export const BLOQUES_OCULTABLES: Record<string, { name: string; label: string }[]> = {
  personajes: [{ name: "estadisticas", label: "Atributos y combate" }],
};

/** Una fila ya enmascarada lleva los nombres de sus campos ocultos, para poder marcarlos. */
export interface ConOcultos {
  _ocultos?: string[];
}

export function campoOculto(fila: object | null | undefined, campo: string): boolean {
  return (fila as ConOcultos | null | undefined)?._ocultos?.includes(campo) ?? false;
}

/** El valor de un dato de la ficha, o la marca si está oculto (para números y referencias). */
export function conMarca<T>(fila: object | null | undefined, campo: string, valor: T): T | string {
  return campoOculto(fila, campo) ? MARCA_OCULTO : valor;
}
