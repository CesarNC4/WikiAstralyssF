/**
 * Numeración automática de capítulos y actos (spec del taller §3 y §4).
 * Pura y sin dependencias: la usan el servidor y la migración, que Node ejecuta
 * como .ts directamente.
 *
 * - Los capítulos se numeran por su posición **dentro de su libro**, y el
 *   contador se reinicia en cada libro.
 * - Los tipos marcados como "no numerados" en el catálogo `capitulo_tipo`
 *   (Prólogo, Interludio…) no consumen número: se rotulan con el nombre de su
 *   tipo y, si ese tipo se repite en el libro, con un ordinal romano
 *   ("Interludio I", "Interludio II").
 * - Los actos se numeran en romanos por su posición dentro del capítulo.
 */

export interface CapituloNumerable {
  id: number;
  libro: string | null;
  tipo: string | null;
  orden: number;
}

const ROMANOS: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function romano(n: number): string {
  if (!Number.isInteger(n) || n < 1) return String(n);
  let resto = n;
  let out = "";
  for (const [valor, letras] of ROMANOS) {
    while (resto >= valor) {
      out += letras;
      resto -= valor;
    }
  }
  return out;
}

/** Rótulo de un acto por su posición (0, 1, 2…): "Acto I", "Acto II"… */
export function etiquetaActo(posicion: number): string {
  return `Acto ${romano(posicion + 1)}`;
}

/**
 * Quita el número que antes se escribía a mano dentro del nombre del acto:
 * "Acto I: Despertar de Aqua" → "Despertar de Aqua". Si el nombre es solo el
 * número ("Acto II"), lo deja tal cual para no dejar un acto sin nombre.
 */
export function quitarPrefijoActo(nombre: string): string {
  const limpio = nombre.replace(/^\s*acto\s+(?:[ivxlcdm]+|\d+)\s*[:.\-–—]\s*/i, "").trim();
  return limpio || nombre.trim();
}

/**
 * El rótulo de cada capítulo ("Capítulo 3", "Prólogo", "Interludio II").
 * `noNumerados` son los valores de `capitulo_tipo` que no consumen número.
 */
export function numerarCapitulos(caps: CapituloNumerable[], noNumerados: Set<string>): Map<number, string> {
  const porLibro = new Map<string, CapituloNumerable[]>();
  for (const c of caps) {
    const k = c.libro ?? "";
    if (!porLibro.has(k)) porLibro.set(k, []);
    porLibro.get(k)!.push(c);
  }

  const out = new Map<number, string>();
  for (const lista of porLibro.values()) {
    lista.sort((a, b) => a.orden - b.orden || a.id - b.id);
    // Cuántos hay de cada tipo sin número, para saber si hace falta el ordinal.
    const total = new Map<string, number>();
    for (const c of lista) if (c.tipo && noNumerados.has(c.tipo)) total.set(c.tipo, (total.get(c.tipo) ?? 0) + 1);

    let n = 0;
    const visto = new Map<string, number>();
    for (const c of lista) {
      if (c.tipo && noNumerados.has(c.tipo)) {
        const i = (visto.get(c.tipo) ?? 0) + 1;
        visto.set(c.tipo, i);
        out.set(c.id, total.get(c.tipo)! > 1 ? `${c.tipo} ${romano(i)}` : c.tipo);
      } else {
        out.set(c.id, `Capítulo ${++n}`);
      }
    }
  }
  return out;
}
