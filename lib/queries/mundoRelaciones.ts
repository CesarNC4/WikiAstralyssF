import "server-only";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { ElementoTag } from "@/components/viz/ElementoBadges";
import { camposOcultos, ocultarEnLista, ocultarFilas, ocultarPorReferencia } from "@/lib/queries/visibilidad";
import { MARCA_OCULTO } from "@/lib/visibilidad";

/** Una conexión oculta sale como marca aunque la otra ficha no sea pública; si no, solo las públicas. */
const visibleConMarca = (oculto: PgColumn, t: { estadoPublicacion: PgColumn; eliminadoEn: PgColumn }) =>
  or(eq(oculto, true), and(eq(t.estadoPublicacion, "publicado"), isNull(t.eliminadoEn)));

/** Filas de una lista de conexiones, ya con la marca y sin lo oculto de la ficha de al lado. */
const lista =
  (entidad: string) =>
  <T extends { oculto: boolean; id: number }>(filas: T[]) =>
    ocultarEnLista(entidad, ocultarFilas(filas));

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
      oculto: s.entidadElemento.oculto,
    })
    .from(s.entidadElemento)
    .innerJoin(s.elementos, eq(s.entidadElemento.elementoId, s.elementos.id))
    .where(and(eq(s.entidadElemento.entidadTipo, entidadTipo), eq(s.entidadElemento.entidadId, entidadId)))
    .orderBy(asc(s.entidadElemento.orden), asc(s.elementos.orden));

  const out: ElementosAgrupados = { afinidad: [], debilidad: [], resistencia: [] };
  for (const r of rows) {
    const tag: ElementoTag = r.oculto
      ? { slug: "oculto", nombre: MARCA_OCULTO, color: "#9aa3b2", icono: "HelpCircle" }
      : { slug: r.slug, nombre: r.nombre, color: r.color, icono: r.icono };
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
        eq(s.entidadElemento.oculto, false),
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
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, imagenUrl: s.naciones.imagenUrl, nota: s.bestiaNacion.nota, oculto: s.bestiaNacion.oculto })
      .from(s.bestiaNacion)
      .innerJoin(s.naciones, eq(s.bestiaNacion.nacionId, s.naciones.id))
      .where(and(eq(s.bestiaNacion.bestiaId, bestiaId), visibleConMarca(s.bestiaNacion.oculto, s.naciones)))
      .then(lista("naciones")),
    db
      .select({ id: s.regiones.id, nombre: s.regiones.nombre, color: s.regiones.color, poligono: s.regiones.poligono, centroX: s.regiones.centroX, centroY: s.regiones.centroY, nota: s.bestiaRegion.nota, oculto: s.bestiaRegion.oculto })
      .from(s.bestiaRegion)
      .innerJoin(s.regiones, eq(s.bestiaRegion.regionId, s.regiones.id))
      .where(and(eq(s.bestiaRegion.bestiaId, bestiaId), visibleConMarca(s.bestiaRegion.oculto, s.regiones)))
      .then(lista("regiones")),
    db
      .select({ id: s.minerales.id, nombre: s.minerales.nombre, imagenUrl: s.minerales.imagenUrl, rarezaMineral: s.minerales.rareza, rareza: s.bestiaDrop.rareza, nota: s.bestiaDrop.nota, orden: s.bestiaDrop.orden, oculto: s.bestiaDrop.oculto })
      .from(s.bestiaDrop)
      .innerJoin(s.minerales, eq(s.bestiaDrop.mineralId, s.minerales.id))
      .where(and(eq(s.bestiaDrop.bestiaId, bestiaId), visibleConMarca(s.bestiaDrop.oculto, s.minerales)))
      .orderBy(asc(s.bestiaDrop.orden))
      .then(lista("minerales")),
    db
      .select({ id: s.bestias.id, nombre: s.bestias.nombre, imagenUrl: s.bestias.imagenUrl, tipo: s.bestiaRelacion.tipo, nota: s.bestiaRelacion.nota, oculto: s.bestiaRelacion.oculto })
      .from(s.bestiaRelacion)
      .innerJoin(s.bestias, eq(s.bestiaRelacion.relacionadaId, s.bestias.id))
      .where(and(eq(s.bestiaRelacion.bestiaId, bestiaId), visibleConMarca(s.bestiaRelacion.oculto, s.bestias)))
      .then(lista("bestias")),
    getElementosDe("bestias", bestiaId),
  ]);
  return { naciones, regiones, drops, relacionadas, elementos };
}

// ── Minerales ────────────────────────────────────────────────────────────────
export async function getMineralRelaciones(mineralId: number) {
  const [artefactos, usos, soltadoPor, moneda, elementos] = await Promise.all([
    db
      .select({ id: s.armasArtefactos.id, nombre: s.armasArtefactos.nombre, imagenUrl: s.armasArtefactos.imagenUrl, tipo: s.armasArtefactos.tipo, nota: s.mineralArtefacto.nota, oculto: s.mineralArtefacto.oculto })
      .from(s.mineralArtefacto)
      .innerJoin(s.armasArtefactos, eq(s.mineralArtefacto.artefactoId, s.armasArtefactos.id))
      .where(and(eq(s.mineralArtefacto.mineralId, mineralId), visibleConMarca(s.mineralArtefacto.oculto, s.armasArtefactos)))
      .then(lista("artefactos")),
    db
      .select({ id: s.mineralUso.id, nombre: s.mineralUso.nombre, detalle: s.mineralUso.detalle })
      .from(s.mineralUso)
      .where(eq(s.mineralUso.mineralId, mineralId))
      .orderBy(asc(s.mineralUso.orden)),
    db
      .select({ id: s.bestias.id, nombre: s.bestias.nombre, imagenUrl: s.bestias.imagenUrl, rareza: s.bestiaDrop.rareza, oculto: s.bestiaDrop.oculto })
      .from(s.bestiaDrop)
      .innerJoin(s.bestias, eq(s.bestiaDrop.bestiaId, s.bestias.id))
      .where(and(eq(s.bestiaDrop.mineralId, mineralId), visibleConMarca(s.bestiaDrop.oculto, s.bestias)))
      .then(lista("bestias")),
    getMonedaDeMineral(mineralId),
    getElementosDe("minerales", mineralId),
  ]);
  return { artefactos, usos, soltadoPor, moneda, elementos };
}

async function getMonedaDeMineral(mineralId: number) {
  const ocultos = await camposOcultos("minerales", mineralId);
  if (ocultos.has("valorMonedaId") || ocultos.has("valorCantidad")) return null;
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
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, imagenUrl: s.naciones.imagenUrl, tipo: s.nacionRaza.tipo, oculto: s.nacionRaza.oculto })
      .from(s.nacionRaza)
      .innerJoin(s.naciones, eq(s.nacionRaza.nacionId, s.naciones.id))
      .where(and(eq(s.nacionRaza.razaId, razaId), visibleConMarca(s.nacionRaza.oculto, s.naciones)))
      .then(lista("naciones")),
    db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre, imagenUrl: s.personajes.imagenUrl, titulo: s.personajes.titulo, oculto: s.personajeRaza.oculto })
      .from(s.personajeRaza)
      .innerJoin(s.personajes, eq(s.personajeRaza.personajeId, s.personajes.id))
      .where(and(eq(s.personajeRaza.razaId, razaId), visibleConMarca(s.personajeRaza.oculto, s.personajes)))
      .limit(24)
      .then(lista("personajes")),
    db
      .select({ id: s.razas.id, nombre: s.razas.nombre, imagenUrl: s.razas.imagenUrl, subtitulo: s.razas.subtitulo })
      .from(s.razas)
      .where(and(eq(s.razas.razaPadreId, razaId), eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn)))
      .then((filas) => ocultarPorReferencia("razas", filas, ["razaPadreId"]))
      .then((filas) => ocultarEnLista("razas", filas)),
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
      .select({ id: s.bestias.id, nombre: s.bestias.nombre, imagenUrl: s.bestias.imagenUrl, nivel: s.bestias.nivelAmenaza, oculto: s.bestiaNacion.oculto })
      .from(s.bestiaNacion)
      .innerJoin(s.bestias, eq(s.bestiaNacion.bestiaId, s.bestias.id))
      .where(and(eq(s.bestiaNacion.nacionId, nacionId), visibleConMarca(s.bestiaNacion.oculto, s.bestias)))
      .then((filas) => ocultarEnLista("bestias", ocultarFilas(filas), { alias: { nivel: "nivelAmenaza" } })),
    db
      .select({ id: s.naciones.id, nombre: s.naciones.nombre, imagenUrl: s.naciones.imagenUrl, color: s.naciones.color, tipo: s.nacionDiplomacia.tipo, nota: s.nacionDiplomacia.nota, oculto: s.nacionDiplomacia.oculto })
      .from(s.nacionDiplomacia)
      .innerJoin(s.naciones, eq(s.nacionDiplomacia.otraNacionId, s.naciones.id))
      .where(and(eq(s.nacionDiplomacia.nacionId, nacionId), visibleConMarca(s.nacionDiplomacia.oculto, s.naciones)))
      .then(lista("naciones")),
  ]);
  return { bestias, diplomacia };
}
