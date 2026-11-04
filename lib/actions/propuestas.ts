"use server";

import { assertAdmin } from "@/lib/actions/auth";
import { aplicarPropuesta, aplicarSuelto } from "@/lib/propuestas/aplicar";
import type { Analisis, EntradaFicha, ResultadoFicha } from "@/lib/propuestas/tipos";
import { analizarArchivos } from "@/lib/queries/propuestas";

/**
 * La bandeja de propuestas (docs/area-ia.md, Fase 5). El texto de los archivos vive en
 * el navegador del autor: aquí solo se analiza y se aplica, y no se guarda en ningún
 * sitio. `assertAdmin` en cada export: al ser "use server", son endpoints públicos.
 */

export async function analizarPropuestas(archivos: { nombre: string; texto: string }[], destinos: Record<string, number | "crear"> = {}): Promise<Analisis> {
  await assertAdmin();
  return analizarArchivos(archivos, destinos);
}

export async function aplicarFichaPropuesta(entrada: EntradaFicha): Promise<ResultadoFicha> {
  await assertAdmin();
  return aplicarPropuesta(entrada);
}

export type DestinoSuelto = Parameters<typeof aplicarSuelto>[0];

/** Manda un texto suelto a una hoja de trama nueva o a las notas de una ficha. */
export async function aplicarTextoSuelto(destino: DestinoSuelto): Promise<{ ok: true; ruta: string | null } | { ok: false; error: string }> {
  await assertAdmin();
  try {
    const { ruta } = await aplicarSuelto(destino);
    return { ok: true, ruta };
  } catch (e) {
    console.error("[aplicarTextoSuelto]", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}
