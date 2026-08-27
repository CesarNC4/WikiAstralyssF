import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { ElementoTag } from "@/components/viz/ElementoBadges";

export interface ElementosAgrupados {
  afinidad: ElementoTag[];
  debilidad: ElementoTag[];
  resistencia: ElementoTag[];
}

/** Afinidades/debilidades/resistencias de una entidad desde el catálogo unificado. */
export async function getElementosDe(entidadTipo: string, entidadId: number): Promise<ElementosAgrupados> {
  const rows = await db
    .select({
      relacion: s.entidadElemento.relacion,
      orden: s.entidadElemento.orden,
      slug: s.elementos.slug,
      nombre: s.elementos.nombre,
      color: s.elementos.color,
      icono: s.elementos.icono,
    })
    .from(s.entidadElemento)
    .innerJoin(s.elementos, eq(s.entidadElemento.elementoId, s.elementos.id))
    .where(and(eq(s.entidadElemento.entidadTipo, entidadTipo), eq(s.entidadElemento.entidadId, entidadId)))
    .orderBy(asc(s.entidadElemento.orden), asc(s.elementos.orden));

  const out: ElementosAgrupados = { afinidad: [], debilidad: [], resistencia: [] };
  for (const r of rows) {
    const tag: ElementoTag = { slug: r.slug, nombre: r.nombre, color: r.color, icono: r.icono };
    const rel = (r.relacion ?? "").toLowerCase();
    if (rel.startsWith("afin")) out.afinidad.push(tag);
    else if (rel.startsWith("debil")) out.debilidad.push(tag);
    else if (rel.startsWith("resist")) out.resistencia.push(tag);
  }
  return out;
}

/**
 * Afinidades de varias fichas de golpe, para índices y comparadores.
 *
 * Razas y minerales guardaban su afinidad en una columna suelta además de en
 * `entidad_elemento`; al quedarse solo con la tabla pueden tener varias, pero
 * una lista no puede permitirse una consulta por fila. Esto las trae todas en
 * una y devuelve el mapa por id.
 */
export async function getAfinidadesDe(
  entidadTipo: string,
  ids: number[],
): Promise<Map<number, ElementoTag[]>> {
  const out = new Map<number, ElementoTag[]>();
  if (ids.length === 0) return out;

  const rows = await db
    .select({
      entidadId: s.entidadElemento.entidadId,
      orden: s.entidadElemento.orden,
      slug: s.elementos.slug,
      nombre: s.elementos.nombre,
      color: s.elementos.color,
      icono: s.elementos.icono,
    })
    .from(s.entidadElemento)
    .innerJoin(s.elementos, eq(s.entidadElemento.elementoId, s.elementos.id))
    .where(
      and(
        eq(s.entidadElemento.entidadTipo, entidadTipo),
        eq(s.entidadElemento.relacion, "afinidad"),
        inArray(s.entidadElemento.entidadId, ids),
      ),
    )
    .orderBy(asc(s.entidadElemento.orden), asc(s.elementos.orden));

  for (const r of rows) {
    const lista = out.get(r.entidadId) ?? [];
    lista.push({ slug: r.slug, nombre: r.nombre, color: r.color, icono: r.icono });
    out.set(r.entidadId, lista);
  }
  return out;
}

// ── Bestias ─────────────────────────────────────────────────────────────────
export async function getBestiaRelaciones(bestiaId: number) {
  const [naciones, regiones, drops, relacionadas, elementos] = await Promise.all([
    db
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, imagenUrl: s.naciones.imagenUrl, nota: s.bestiaNacion.nota })
      .from(s.bestiaNacion)
      .innerJoin(s.naciones, eq(s.bestiaNacion.nacionId, s.naciones.id))
      .where(and(eq(s.bestiaNacion.bestiaId, bestiaId), eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn))),
    db
      .select({ id: s.regiones.id, nombre: s.regiones.nombre, color: s.regiones.color, poligono: s.regiones.poligono, centroX: s.regiones.centroX, centroY: s.regiones.centroY, nota: s.bestiaRegion.nota })
      .from(s.bestiaRegion)
      .innerJoin(s.regiones, eq(s.bestiaRegion.regionId, s.regiones.id))
      .where(and(eq(s.bestiaRegion.bestiaId, bestiaId), eq(s.regiones.estadoPublicacion, "publicado"), isNull(s.regiones.eliminadoEn))),
    db
      .select({ id: s.minerales.id, nombre: s.minerales.nombre, imagenUrl: s.minerales.imagenUrl, rarezaMineral: s.minerales.rareza, rareza: s.bestiaDrop.rareza, nota: s.bestiaDrop.nota, orden: s.bestiaDrop.orden })
      .from(s.bestiaDrop)
      .innerJoin(s.minerales, eq(s.bestiaDrop.mineralId, s.minerales.id))
      .where(and(eq(s.bestiaDrop.bestiaId, bestiaId), eq(s.minerales.estadoPublicacion, "publicado"), isNull(s.minerales.eliminadoEn)))
      .orderBy(asc(s.bestiaDrop.orden)),
    db
      .select({ id: s.bestias.id, nombre: s.bestias.nombre, imagenUrl: s.bestias.imagenUrl, tipo: s.bestiaRelacion.tipo, nota: s.bestiaRelacion.nota })
      .from(s.bestiaRelacion)
      .innerJoin(s.bestias, eq(s.bestiaRelacion.relacionadaId, s.bestias.id))
      .where(and(eq(s.bestiaRelacion.bestiaId, bestiaId), eq(s.bestias.estadoPublicacion, "publicado"), isNull(s.bestias.eliminadoEn))),
    getElementosDe("bestias", bestiaId),
  ]);
  return { naciones, regiones, drops, relacionadas, elementos };
}

// ── Minerales ────────────────────────────────────────────────────────────────
export async function getMineralRelaciones(mineralId: number) {
  const [artefactos, usos, soltadoPor, moneda, elementos] = await Promise.all([
    db
      .select({ id: s.armasArtefactos.id, nombre: s.armasArtefactos.nombre, imagenUrl: s.armasArtefactos.imagenUrl, tipo: s.armasArtefactos.tipo, nota: s.mineralArtefacto.nota })
      .from(s.mineralArtefacto)
      .innerJoin(s.armasArtefactos, eq(s.mineralArtefacto.artefactoId, s.armasArtefactos.id))
      .where(and(eq(s.mineralArtefacto.mineralId, mineralId), eq(s.armasArtefactos.estadoPublicacion, "publicado"), isNull(s.armasArtefactos.eliminadoEn))),
    db
      .select({ id: s.mineralUso.id, nombre: s.mineralUso.nombre, detalle: s.mineralUso.detalle })
      .from(s.mineralUso)
      .where(eq(s.mineralUso.mineralId, mineralId))
      .orderBy(asc(s.mineralUso.orden)),
    db
      .select({ id: s.bestias.id, nombre: s.bestias.nombre, imagenUrl: s.bestias.imagenUrl, rareza: s.bestiaDrop.rareza })
      .from(s.bestiaDrop)
      .innerJoin(s.bestias, eq(s.bestiaDrop.bestiaId, s.bestias.id))
      .where(and(eq(s.bestiaDrop.mineralId, mineralId), eq(s.bestias.estadoPublicacion, "publicado"), isNull(s.bestias.eliminadoEn))),
    getMonedaDeMineral(mineralId),
    getElementosDe("minerales", mineralId),
  ]);
  return { artefactos, usos, soltadoPor, moneda, elementos };
}

async function getMonedaDeMineral(mineralId: number) {
  const [m] = await db
    .select({ valorMonedaId: s.minerales.valorMonedaId, valorCantidad: s.minerales.valorCantidad })
    .from(s.minerales)
    .where(eq(s.minerales.id, mineralId))
    .limit(1);
  if (!m?.valorMonedaId || m.valorCantidad == null) return null;
  const [moneda] = await db
    .select({ id: s.sistemaMonetario.id, nombre: s.sistemaMonetario.nombre, denominacion: s.sistemaMonetario.denominacion })
    .from(s.sistemaMonetario)
    .where(eq(s.sistemaMonetario.id, m.valorMonedaId))
    .limit(1);
  if (!moneda) return null;
  return { cantidad: m.valorCantidad, nombre: moneda.nombre, denominacion: moneda.denominacion };
}

// ── Razas ────────────────────────────────────────────────────────────────────
export async function getRazaRelaciones(razaId: number, razaPadreId: number | null) {
  const [naciones, personajes, subRazas, padre, elementos] = await Promise.all([
    db
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, imagenUrl: s.naciones.imagenUrl, tipo: s.nacionRaza.tipo })
      .from(s.nacionRaza)
      .innerJoin(s.naciones, eq(s.nacionRaza.nacionId, s.naciones.id))
      .where(and(eq(s.nacionRaza.razaId, razaId), eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn))),
    db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre, imagenUrl: s.personajes.imagenUrl, titulo: s.personajes.titulo })
      .from(s.personajeRaza)
      .innerJoin(s.personajes, eq(s.personajeRaza.personajeId, s.personajes.id))
      .where(and(eq(s.personajeRaza.razaId, razaId), eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn)))
      .limit(24),
    db
      .select({ id: s.razas.id, nombre: s.razas.nombre, imagenUrl: s.razas.imagenUrl, subtitulo: s.razas.subtitulo })
      .from(s.razas)
      .where(and(eq(s.razas.razaPadreId, razaId), eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn))),
    razaPadreId
      ? db
          .select({ id: s.razas.id, nombre: s.razas.nombre, imagenUrl: s.razas.imagenUrl })
          .from(s.razas)
          .where(and(eq(s.razas.id, razaPadreId), eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn)))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    getElementosDe("razas", razaId),
  ]);
  return { naciones, personajes, subRazas, padre, elementos };
}

// ── Naciones (extra del overhaul) ────────────────────────────────────────────
export async function getNacionRelacionesExtra(nacionId: number) {
  const [bestias, diplomacia] = await Promise.all([
    db
      .select({ id: s.bestias.id, nombre: s.bestias.nombre, imagenUrl: s.bestias.imagenUrl, nivel: s.bestias.nivelAmenaza })
      .from(s.bestiaNacion)
      .innerJoin(s.bestias, eq(s.bestiaNacion.bestiaId, s.bestias.id))
      .where(and(eq(s.bestiaNacion.nacionId, nacionId), eq(s.bestias.estadoPublicacion, "publicado"), isNull(s.bestias.eliminadoEn))),
    db
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, imagenUrl: s.naciones.imagenUrl, color: s.naciones.color, tipo: s.nacionDiplomacia.tipo, nota: s.nacionDiplomacia.nota })
      .from(s.nacionDiplomacia)
      .innerJoin(s.naciones, eq(s.nacionDiplomacia.otraNacionId, s.naciones.id))
      .where(and(eq(s.nacionDiplomacia.nacionId, nacionId), eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn))),
  ]);
  return { bestias, diplomacia };
}
