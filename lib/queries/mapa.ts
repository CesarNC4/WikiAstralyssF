import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/** Datos para renderizar el mapa público (§10): naciones, regiones y locaciones publicadas. */
export async function getMapaPublico() {
  const [naciones, regiones, locaciones] = await Promise.all([
    db
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, poligono: s.naciones.poligono, centroX: s.naciones.centroX, centroY: s.naciones.centroY, color: s.naciones.color, imagenUrl: s.naciones.imagenUrl })
      .from(s.naciones)
      .where(and(eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn))),
    db
      .select({ id: s.regiones.id, nacionId: s.regiones.nacionId, nombre: s.regiones.nombre, poligono: s.regiones.poligono, centroX: s.regiones.centroX, centroY: s.regiones.centroY, color: s.regiones.color })
      .from(s.regiones)
      .where(and(eq(s.regiones.estadoPublicacion, "publicado"), isNull(s.regiones.eliminadoEn))),
    db
      .select({ id: s.locaciones.id, regionId: s.locaciones.regionId, nacionId: s.locaciones.nacionId, tipo: s.locaciones.tipo, escala: s.locaciones.escala, nombre: s.locaciones.nombre, x: s.locaciones.x, y: s.locaciones.y })
      .from(s.locaciones)
      .where(and(eq(s.locaciones.estadoPublicacion, "publicado"), isNull(s.locaciones.eliminadoEn))),
  ]);
  return { naciones, regiones, locaciones };
}

export type MapaPublico = Awaited<ReturnType<typeof getMapaPublico>>;

async function first<T>(rows: Promise<T[]>): Promise<T | undefined> {
  return (await rows)[0];
}

/** Territorio de una nación para el mini-mapa: regiones y locaciones publicadas. */
export async function getNacionTerritorio(nacionId: number) {
  const [regiones, locaciones] = await Promise.all([
    db
      .select({ id: s.regiones.id, nombre: s.regiones.nombre, poligono: s.regiones.poligono, color: s.regiones.color })
      .from(s.regiones)
      .where(and(eq(s.regiones.nacionId, nacionId), eq(s.regiones.estadoPublicacion, "publicado"), isNull(s.regiones.eliminadoEn))),
    db
      .select({ id: s.locaciones.id, nombre: s.locaciones.nombre, tipo: s.locaciones.tipo, x: s.locaciones.x, y: s.locaciones.y })
      .from(s.locaciones)
      .where(and(eq(s.locaciones.nacionId, nacionId), eq(s.locaciones.estadoPublicacion, "publicado"), isNull(s.locaciones.eliminadoEn))),
  ]);
  return { regiones, locaciones };
}

/** Ficha de región: la región + su nación + sus locaciones publicadas. */
export async function getRegionFicha(id: number) {
  const region = await first(
    db.select().from(s.regiones).where(and(eq(s.regiones.id, id), eq(s.regiones.estadoPublicacion, "publicado"), isNull(s.regiones.eliminadoEn))).limit(1),
  );
  if (!region) return null;

  const [nacion] = region.nacionId
    ? await db.select({ id: s.naciones.id, nombre: s.naciones.nombre, poligono: s.naciones.poligono, color: s.naciones.color }).from(s.naciones).where(eq(s.naciones.id, region.nacionId)).limit(1)
    : [undefined];

  const locaciones = await db
    .select({ id: s.locaciones.id, nombre: s.locaciones.nombre, tipo: s.locaciones.tipo, imagenUrl: s.locaciones.imagenUrl, subtitulo: s.locaciones.subtitulo, x: s.locaciones.x, y: s.locaciones.y })
    .from(s.locaciones)
    .where(and(eq(s.locaciones.regionId, id), eq(s.locaciones.estadoPublicacion, "publicado"), isNull(s.locaciones.eliminadoEn)))
    .orderBy(asc(s.locaciones.nombre));

  return { region, nacion: nacion ?? null, locaciones };
}

/** Ficha de locación: la locación + su región + su nación + evento de cronología. */
export async function getLocacionFicha(id: number) {
  const locacion = await first(
    db.select().from(s.locaciones).where(and(eq(s.locaciones.id, id), eq(s.locaciones.estadoPublicacion, "publicado"), isNull(s.locaciones.eliminadoEn))).limit(1),
  );
  if (!locacion) return null;

  const [region] = locacion.regionId
    ? await db.select({ id: s.regiones.id, nombre: s.regiones.nombre, poligono: s.regiones.poligono, color: s.regiones.color }).from(s.regiones).where(eq(s.regiones.id, locacion.regionId)).limit(1)
    : [undefined];
  const [nacion] = locacion.nacionId
    ? await db.select({ id: s.naciones.id, nombre: s.naciones.nombre, poligono: s.naciones.poligono, color: s.naciones.color }).from(s.naciones).where(eq(s.naciones.id, locacion.nacionId)).limit(1)
    : [undefined];
  const [evento] = locacion.eventoId
    ? await db.select({ id: s.timelineEventos.id, titulo: s.timelineEventos.titulo, fechaLore: s.timelineEventos.fechaLore }).from(s.timelineEventos).where(eq(s.timelineEventos.id, locacion.eventoId)).limit(1)
    : [undefined];

  return { locacion, region: region ?? null, nacion: nacion ?? null, evento: evento ?? null };
}

export async function getVisibleRegionIds(): Promise<number[]> {
  const rows = await db.select({ id: s.regiones.id }).from(s.regiones).where(and(eq(s.regiones.estadoPublicacion, "publicado"), isNull(s.regiones.eliminadoEn)));
  return rows.map((r) => r.id);
}

export async function getVisibleLocacionIds(): Promise<number[]> {
  const rows = await db.select({ id: s.locaciones.id }).from(s.locaciones).where(and(eq(s.locaciones.estadoPublicacion, "publicado"), isNull(s.locaciones.eliminadoEn)));
  return rows.map((r) => r.id);
}
