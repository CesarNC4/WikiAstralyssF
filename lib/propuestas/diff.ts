/**
 * Diferencia por palabras entre dos textos, para que la bandeja resalte qué cambia.
 * Pura y client-safe. LCS de toda la vida, tras recortar el principio y el final
 * comunes: lo normal es una corrección pequeña dentro de un texto largo.
 */

export interface Tramo {
  tipo: "igual" | "quitado" | "anadido";
  texto: string;
}

/** Por encima de esto (palabras × palabras), una tabla LCS tardaría demasiado. */
const LIMITE = 4_000_000;

const trocear = (t: string) => t.match(/\s+|[^\s]+/g) ?? [];

function juntar(tramos: Tramo[]): Tramo[] {
  const out: Tramo[] = [];
  for (const t of tramos) {
    const ultimo = out[out.length - 1];
    if (ultimo?.tipo === t.tipo) ultimo.texto += t.texto;
    else if (t.texto) out.push({ ...t });
  }
  return out;
}

/** Null si los textos son demasiado distintos y largos para compararlos palabra a palabra. */
export function diferencias(antes: string, despues: string): Tramo[] | null {
  const a = trocear(antes);
  const b = trocear(despues);
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let finA = a.length;
  let finB = b.length;
  while (finA > ini && finB > ini && a[finA - 1] === b[finB - 1]) {
    finA--;
    finB--;
  }
  const n = finA - ini;
  const m = finB - ini;
  if (n * m > LIMITE) return null;

  // tabla[i][j]: la subsecuencia común más larga de a[i..] y b[j..].
  const tabla = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tabla[i][j] = a[ini + i] === b[ini + j] ? tabla[i + 1][j + 1] + 1 : Math.max(tabla[i + 1][j], tabla[i][j + 1]);
    }
  }

  const tramos: Tramo[] = [{ tipo: "igual", texto: a.slice(0, ini).join("") }];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[ini + i] === b[ini + j]) {
      tramos.push({ tipo: "igual", texto: a[ini + i] });
      i++;
      j++;
    } else if (j < m && (i === n || tabla[i][j + 1] >= tabla[i + 1][j])) {
      tramos.push({ tipo: "anadido", texto: b[ini + j] });
      j++;
    } else {
      tramos.push({ tipo: "quitado", texto: a[ini + i] });
      i++;
    }
  }
  tramos.push({ tipo: "igual", texto: a.slice(finA).join("") });
  return juntar(tramos);
}
