"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";

function revalidar() {
  revalidatePath("/admin/timeline");
  revalidatePath("/timeline", "layout");
  revalidatePath("/");
}

/** Edición rápida inline de un evento. */
export async function actualizarEventoInline(
  id: number,
  patch: { titulo?: string; estado?: "borrador" | "publicado" | "oculto"; capituloId?: number | null },
): Promise<void> {
  await assertAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set: any = {};
  if (patch.titulo !== undefined) set.titulo = patch.titulo.trim() || "Sin título";
  // Cambiar de capítulo suelta el acto: era un acto del capítulo anterior.
  if (patch.capituloId !== undefined) {
    set.capituloId = patch.capituloId;
    set.actoId = null;
  }
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

/** Crea un evento en blanco y devuelve su id. La fecha se le pone en su editor. */
export async function crearEventoRapido(): Promise<number> {
  await assertAdmin();
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${s.timelineEventos.orden}), -1)` }).from(s.timelineEventos);
  const [row] = await db
    .insert(s.timelineEventos)
    .values({ titulo: "Nuevo evento", orden: (max ?? -1) + 1, estadoPublicacion: "borrador" })
    .returning({ id: s.timelineEventos.id });
  revalidar();
  return row.id;
}
