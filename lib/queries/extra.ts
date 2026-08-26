import "server-only";
import { and, eq, asc, isNull, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

export interface TimelineEventoPublico {
  id: number;
  fechaLore: string;
  titulo: string;
  descripcion: string | null;
  importancia: string | null;
  categoria: string | null;
  era: string | null;
  capitulo: { id: number; numero: string; titulo: string } | null;
  locacion: { id: number; nombre: string } | null;
  personajes: { id: number; nombre: string; surname: string | null; imagenUrl: string | null }[];
}

/** Eventos de la cronología visibles (§ punto 13), con era, capítulo y locación vinculados. */
export async function getTimeline(): Promise<TimelineEventoPublico[]> {
  const eventos = await db
    .select({
      id: s.timelineEventos.id,
      fechaLore: s.timelineEventos.fechaLore,
      titulo: s.timelineEventos.titulo,
      descripcion: s.timelineEventos.descripcion,
      importancia: s.timelineEventos.importancia,
      categoria: s.timelineEventos.categoria,
      era: s.timelineEventos.era,
      capituloId: s.timelineEventos.capituloId,
    })
    .from(s.timelineEventos)
    .where(and(eq(s.timelineEventos.estadoPublicacion, "publicado"), isNull(s.timelineEventos.eliminadoEn)))
    .orderBy(asc(s.timelineEventos.orden), asc(s.timelineEventos.id));

  if (eventos.length === 0) return [];

  const capIds = [...new Set(eventos.map((e) => e.capituloId).filter((x): x is number => x != null))];
  const evIds = eventos.map((e) => e.id);

  const [caps, locs, pjs] = await Promise.all([
    capIds.length
      ? db.select({ id: s.capitulos.id, numero: s.capitulos.numero, titulo: s.capitulos.titulo }).from(s.capitulos).where(inArray(s.capitulos.id, capIds))
      : Promise.resolve([] as { id: number; numero: string; titulo: string }[]),
    db
      .select({ id: s.locaciones.id, nombre: s.locaciones.nombre, eventoId: s.locaciones.eventoId })
      .from(s.locaciones)
      .where(and(inArray(s.locaciones.eventoId, evIds), eq(s.locaciones.estadoPublicacion, "publicado"), isNull(s.locaciones.eliminadoEn))),
    // Personajes vinculados a cada evento (vía personaje_evento).
    db
      .select({
        eventoId: s.personajeEvento.timelineEventoId,
        orden: s.personajeEvento.orden,
        id: s.personajes.id,
        nombre: s.personajes.nombre,
        surname: s.personajes.surname,
        imagenUrl: s.personajes.imagenUrl,
      })
      .from(s.personajeEvento)
      .innerJoin(s.personajes, eq(s.personajeEvento.personajeId, s.personajes.id))
      .where(and(inArray(s.personajeEvento.timelineEventoId, evIds), eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn)))
      .orderBy(asc(s.personajeEvento.orden)),
  ]);

  const capMap = new Map(caps.map((c) => [c.id, c]));
  const locMap = new Map<number, { id: number; nombre: string }>();
  for (const l of locs) if (l.eventoId != null && !locMap.has(l.eventoId)) locMap.set(l.eventoId, { id: l.id, nombre: l.nombre });
  const pjMap = new Map<number, { id: number; nombre: string; surname: string | null; imagenUrl: string | null }[]>();
  for (const p of pjs) {
    (pjMap.get(p.eventoId) ?? pjMap.set(p.eventoId, []).get(p.eventoId)!).push({ id: p.id, nombre: p.nombre, surname: p.surname, imagenUrl: p.imagenUrl });
  }

  return eventos.map((e) => ({
    id: e.id,
    fechaLore: e.fechaLore,
    titulo: e.titulo,
    descripcion: e.descripcion,
    importancia: e.importancia,
    categoria: e.categoria,
    era: e.era,
    capitulo: e.capituloId != null ? capMap.get(e.capituloId) ?? null : null,
    locacion: locMap.get(e.id) ?? null,
    personajes: pjMap.get(e.id) ?? [],
  }));
}
