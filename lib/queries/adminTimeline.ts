import "server-only";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { textosFecha, type TextosFecha } from "@/lib/fechas";
import { fechasDeEntidades, getCalendario } from "@/lib/queries/fechas";

export interface TimelineEvento {
  id: number;
  titulo: string;
  /** La fecha en las dos lecturas; null si el evento aún no tiene fecha. */
  fecha: TextosFecha | null;
  importante: boolean;
  categoria: string | null;
  capituloId: number | null;
  estado: EstadoPublicacion;
}

/**
 * Todos los eventos no eliminados, en orden cronológico (spec §14): primero los
 * que aún no tienen fecha, para que se vean, y luego por día absoluto. El orden
 * manual solo desempata los del mismo día.
 */
export async function listTimelineEventos(): Promise<TimelineEvento[]> {
  const rows = await db
    .select({
      id: s.timelineEventos.id,
      titulo: s.timelineEventos.titulo,
      categoria: s.timelineEventos.categoria,
      capituloId: s.timelineEventos.capituloId,
      estado: s.timelineEventos.estadoPublicacion,
    })
    .from(s.timelineEventos)
    .where(isNull(s.timelineEventos.eliminadoEn))
    .orderBy(asc(s.timelineEventos.orden), asc(s.timelineEventos.id));
  const [cal, fechas] = await Promise.all([getCalendario(), fechasDeEntidades("timeline", rows.map((r) => r.id))]);

  const clave = (id: number) => fechas.get(id)?.claveIni ?? Number.NEGATIVE_INFINITY;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => clave(a.r.id) - clave(b.r.id) || a.i - b.i)
    .map(({ r }) => {
      const f = fechas.get(r.id);
      return {
        ...r,
        titulo: r.titulo ?? "",
        fecha: f ? textosFecha(cal, f.fecha) : null,
        importante: f?.importante ?? false,
      };
    });
}
