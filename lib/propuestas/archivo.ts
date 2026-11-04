/**
 * Reescribe un archivo de propuestas al aplicar: cada bloque se busca por su texto
 * exacto, no por su línea, porque el archivo puede haber cambiado mientras tanto (el
 * autor lo corrige a mano, o Claude añade propuestas al final). Puro y client-safe.
 */

const COMENTARIO = /^\s*<!--.*-->\s*$/;

/** Quita los comentarios de procedencia que se quedaron sin bloque detrás, y las líneas de más. */
function limpiar(lineas: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lineas.length; i++) {
    if (COMENTARIO.test(lineas[i])) {
      let j = i + 1;
      while (j < lineas.length && !lineas[j].trim()) j++;
      if (j >= lineas.length || COMENTARIO.test(lineas[j])) continue;
    }
    if (!lineas[i].trim() && !out[out.length - 1]?.trim()) continue;
    out.push(lineas[i]);
  }
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

/**
 * Cambia un bloque por otro, o lo quita si `nuevo` es null. Devuelve null si el bloque
 * ya no está tal cual: entonces no se toca el archivo.
 */
export function reemplazarBloque(texto: string, raw: string, nuevo: string | null): string | null {
  const crlf = texto.includes("\r\n");
  const lf = texto.replace(/\r\n?/g, "\n");
  const i = lf.indexOf(raw);
  if (i < 0) return null;
  const resultado = lf.slice(0, i) + (nuevo ?? "") + lf.slice(i + raw.length);
  const limpio = limpiar(resultado.split("\n")).join("\n");
  const final = limpio ? `${limpio}\n` : "";
  return crlf ? final.replace(/\n/g, "\r\n") : final;
}

/** Sin nada más que comentarios, títulos o blancos: el archivo se puede borrar. */
export function estaVacio(texto: string): boolean {
  return texto.split(/\r?\n/).every((l) => !l.trim() || COMENTARIO.test(l) || /^#\s/.test(l));
}

/** El bloque de una ficha cuando parte de sus datos se quedan pendientes. */
export function bloquePendiente(cabecera: string, pendientes: { raw: string; seccion: string | null }[]): string {
  // Los de una misma sección (las conexiones) van juntos bajo su encabezado.
  const secciones = new Map<string, string[]>();
  const lineas: string[] = [];
  const bloques: string[] = [];
  for (const p of pendientes) {
    if (p.seccion) secciones.set(p.seccion, [...(secciones.get(p.seccion) ?? []), p.raw]);
    else if (p.raw.startsWith("- ")) lineas.push(p.raw);
    else bloques.push(p.raw);
  }
  return [[cabecera, ...lineas].join("\n"), ...bloques, ...[...secciones].map(([s, filas]) => [s, ...filas].join("\n"))].join("\n\n");
}
