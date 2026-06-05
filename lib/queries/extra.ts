import "server-only";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/** Eventos de la cronología visibles (§10.2). */
export async function getTimeline() {
  return db
    .select({
      id: s.timelineEventos.id,
      fechaLore: s.timelineEventos.fechaLore,
      titulo: s.timelineEventos.titulo,
      descripcion: s.timelineEventos.descripcion,
      importancia: s.timelineEventos.importancia,
      categoria: s.timelineEventos.categoria,
    })
    .from(s.timelineEventos)
    .where(eq(s.timelineEventos.estadoPublicacion, "publicado"))
    .orderBy(asc(s.timelineEventos.id));
}

/** Naciones para el mapa (§10.1). */
export async function getNacionesMapa() {
  return db
    .select({
      id: s.naciones.id,
      nombre: s.naciones.nombre,
      subtitulo: s.naciones.subtitulo,
      imagenUrl: s.naciones.imagenUrl,
      elemento: s.naciones.elementoFundamental,
    })
    .from(s.naciones)
    .where(eq(s.naciones.estadoPublicacion, "publicado"))
    .orderBy(asc(s.naciones.nombre));
}
