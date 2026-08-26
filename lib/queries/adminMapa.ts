import "server-only";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/** Carga todo el mapa para el editor del admin (incluye no publicados; excluye eliminados). */
export async function getMapaAdmin() {
  const [naciones, regiones, locaciones, eventos] = await Promise.all([
    db
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, poligono: s.naciones.poligono, centroX: s.naciones.centroX, centroY: s.naciones.centroY, color: s.naciones.color, estadoPublicacion: s.naciones.estadoPublicacion })
      .from(s.naciones)
      .where(isNull(s.naciones.eliminadoEn))
      .orderBy(asc(s.naciones.nombre)),
    db
      .select()
      .from(s.regiones)
      .where(isNull(s.regiones.eliminadoEn))
      .orderBy(asc(s.regiones.nombre)),
    db
      .select()
      .from(s.locaciones)
      .where(isNull(s.locaciones.eliminadoEn))
      .orderBy(asc(s.locaciones.nombre)),
    db
      .select({ id: s.timelineEventos.id, titulo: s.timelineEventos.titulo, fechaLore: s.timelineEventos.fechaLore })
      .from(s.timelineEventos)
      .where(isNull(s.timelineEventos.eliminadoEn))
      .orderBy(asc(s.timelineEventos.orden)),
  ]);
  return { naciones, regiones, locaciones, eventos };
}

export type MapaAdmin = Awaited<ReturnType<typeof getMapaAdmin>>;
