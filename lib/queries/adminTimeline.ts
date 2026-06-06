import "server-only";
import { and, asc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { EstadoPublicacion } from "@/db/schema/enums";

export interface TimelineEvento {
  id: number;
  titulo: string;
  fechaLore: string | null;
  importancia: string | null;
  categoria: string | null;
  capituloId: number | null;
  estado: EstadoPublicacion;
}

/** Todos los eventos no eliminados, en su orden manual (para el gestor drag-and-drop). */
export async function listTimelineEventos(): Promise<TimelineEvento[]> {
  const rows = await db
    .select({
      id: s.timelineEventos.id,
      titulo: s.timelineEventos.titulo,
      fechaLore: s.timelineEventos.fechaLore,
      importancia: s.timelineEventos.importancia,
      categoria: s.timelineEventos.categoria,
      capituloId: s.timelineEventos.capituloId,
      estado: s.timelineEventos.estadoPublicacion,
    })
    .from(s.timelineEventos)
    .where(isNull(s.timelineEventos.eliminadoEn))
    .orderBy(asc(s.timelineEventos.orden), asc(s.timelineEventos.id));
  return rows.map((r) => ({ ...r, titulo: r.titulo ?? "" }));
}
