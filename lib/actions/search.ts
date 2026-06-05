"use server";

import { buscarGlobal } from "@/lib/queries/busqueda";
import type { SearchResult } from "@/lib/types";

/** Server Action para la búsqueda del Command Palette (§8). */
export async function buscarAction(query: string): Promise<SearchResult[]> {
  return buscarGlobal(query);
}
