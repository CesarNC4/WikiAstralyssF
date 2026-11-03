/**
 * Resolución de módulos para ejecutar con Node el código de la wiki fuera de
 * Next.js (registrar.mjs lo activa). Node 24 ya entiende TypeScript, pero no
 * los alias `@/…` del tsconfig ni los imports sin extensión que usa el
 * proyecto: aquí se traducen a la ruta del archivo. `server-only` (que en
 * Next.js impide importar código de servidor desde el navegador) no aplica
 * fuera de Next: se sustituye por un módulo vacío.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));
const SUFIJOS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];

function archivo(base) {
  for (const s of SUFIJOS) {
    const f = base + s;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

export async function resolve(especificador, contexto, siguiente) {
  if (especificador === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
  let base = null;
  if (especificador.startsWith("@/")) base = path.join(RAIZ, especificador.slice(2));
  else if (/^\.\.?\//.test(especificador) && contexto.parentURL?.startsWith("file:"))
    base = path.resolve(path.dirname(fileURLToPath(contexto.parentURL)), especificador);
  const f = base && archivo(base);
  return siguiente(f ? pathToFileURL(f).href : especificador, contexto);
}
