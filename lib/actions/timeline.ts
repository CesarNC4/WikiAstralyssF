"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";

function revalidar() {
  revalidatePath("/admin/timeline");
  revalidatePath("/timeline");
  revalidatePath("/");
}

/** Persiste el nuevo orden (lista de ids en la secuencia deseada). */
export async function reordenarTimeline(ids: number[]): Promise<void> {
  await assertAdmin();
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(s.timelineEventos).set({ orden: i }).where(eq(s.timelineEventos.id, ids[i]));
    }
  });
  revalidar();
}

/** Edición rápida inline de un evento. */
export async function actualizarEventoInline(
  id: number,
  patch: { titulo?: string; fechaLore?: string; era?: string | null; estado?: "borrador" | "publicado" | "oculto"; capituloId?: number | null },
): Promise<void> {
  await assertAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set: any = {};
  if (patch.titulo !== undefined) set.titulo = patch.titulo.trim() || "Sin título";
  if (patch.fechaLore !== undefined) set.fechaLore = patch.fechaLore;
  if (patch.era !== undefined) set.era = patch.era?.trim() || null;
  if (patch.capituloId !== undefined) set.capituloId = patch.capituloId;
  if (patch.estado !== undefined) {
    set.estadoPublicacion = patch.estado;
    if (patch.estado === "publicado") {
      const [ex] = await db.select({ ppv: s.timelineEventos.publicadoPrimeraVezEn }).from(s.timelineEventos).where(eq(s.timelineEventos.id, id)).limit(1);
      if (!ex?.ppv) set.publicadoPrimeraVezEn = new Date();
    }
  }
  if (Object.keys(set).length === 0) return;
  await db.update(s.timelineEventos).set(set).where(eq(s.timelineEventos.id, id));
  revalidar();
}

/** Crea un evento en blanco al final de la cronología y devuelve su id. */
export async function crearEventoRapido(): Promise<number> {
  await assertAdmin();
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${s.timelineEventos.orden}), -1)` }).from(s.timelineEventos);
  const [row] = await db
    .insert(s.timelineEventos)
    .values({ titulo: "Nuevo evento", fechaLore: "—", orden: (max ?? -1) + 1, estadoPublicacion: "borrador" })
    .returning({ id: s.timelineEventos.id });
  revalidar();
  return row.id;
}
