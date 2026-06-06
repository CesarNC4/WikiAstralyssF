"use server";

import { db } from "@/db/client";
import { catalogos } from "@/db/schema/admin";
import { assertAdmin } from "@/lib/actions/auth";

/**
 * Inserta un valor nuevo en un catálogo de combobox (idempotente).
 * Se llama cuando el autor escribe un valor que no existía.
 */
export async function agregarValorCatalogo(
  campo: string,
  valor: string,
  grupo?: string | null,
): Promise<{ ok: boolean }> {
  await assertAdmin();
  const v = valor.trim();
  if (!campo.trim() || !v) return { ok: false };
  await db
    .insert(catalogos)
    .values({ campo: campo.trim(), valor: v, grupo: grupo?.trim() || null, orden: 999 })
    .onConflictDoNothing();
  return { ok: true };
}
