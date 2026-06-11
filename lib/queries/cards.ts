import "server-only";
import { and, eq, asc, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { EntityKey } from "@/lib/entities";
import type { EntityCard } from "@/lib/types";

/**
 * Listado de cards por sección (§5.3). Normaliza cada tabla a EntityCard.
 * El filtro de visibilidad pública (visible = true) se aplica aquí de forma
 * centralizada para evitar fugas de borradores.
 */
export async function listEntityCards(key: EntityKey): Promise<EntityCard[]> {
  switch (key) {
    case "personajes": {
      const rows = await db
        .select({
          id: s.personajes.id,
          titulo: s.personajes.nombre,
          subtitulo: s.personajes.subtitulo,
          titulo2: s.personajes.titulo,
          imagenUrl: s.personajes.imagenUrl,
          badge: s.personajes.rangoAventurero,
        })
        .from(s.personajes)
        .where(and(eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn)))
        .orderBy(asc(s.personajes.nombre));
      return rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        subtitulo: r.subtitulo ?? r.titulo2 ?? null,
        imagenUrl: r.imagenUrl,
        href: `/personajes/${r.id}`,
        badge: r.badge,
      }));
    }
    case "naciones": {
      const rows = await db
        .select({ id: s.naciones.id, titulo: s.naciones.nombre, subtitulo: s.naciones.subtitulo, imagenUrl: s.naciones.imagenUrl })
        .from(s.naciones)
        .where(and(eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn)))
        .orderBy(asc(s.naciones.nombre));
      return rows.map((r) => ({ ...r, href: `/naciones/${r.id}` }));
    }
    case "organizaciones": {
      const rows = await db
        .select({ id: s.organizaciones.id, titulo: s.organizaciones.nombre, subtitulo: s.organizaciones.subtitulo, imagenUrl: s.organizaciones.imagenUrl, badge: s.organizaciones.tipo })
        .from(s.organizaciones)
        .where(eq(s.organizaciones.estadoPublicacion, "publicado"))
        .orderBy(asc(s.organizaciones.nombre));
      return rows.map((r) => ({ ...r, href: `/organizaciones/${r.id}` }));
    }
    case "familias": {
      const rows = await db
        .select({ id: s.familias.id, titulo: s.familias.nombre, subtitulo: s.familias.subtitulo, imagenUrl: s.familias.imagenUrl, badge: s.familias.origen })
        .from(s.familias)
        .where(eq(s.familias.estadoPublicacion, "publicado"))
        .orderBy(asc(s.familias.nombre));
      return rows.map((r) => ({ ...r, href: `/familias/${r.id}` }));
    }
    case "razas": {
      const rows = await db
        .select({
          id: s.razas.id,
          titulo: s.razas.nombre,
          subtitulo: s.razas.subtitulo,
          imagenUrl: s.razas.imagenUrl,
          badge: s.razas.clasificacion,
          afinidad: s.razas.afinidad,
          vida: s.razas.esperanzaVida,
        })
        .from(s.razas)
        .where(and(eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn)))
        .orderBy(asc(s.razas.nombre));
      return rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        subtitulo: r.subtitulo,
        imagenUrl: r.imagenUrl,
        badge: r.badge,
        href: `/razas/${r.id}`,
        facets: { clasificacion: r.badge, afinidad: r.afinidad, vida: r.vida },
      }));
    }
    case "bestias": {
      const rows = await db
        .select({
          id: s.bestias.id,
          titulo: s.bestias.nombre,
          subtitulo: s.bestias.subtitulo,
          imagenUrl: s.bestias.imagenUrl,
          amenaza: s.bestias.nivelAmenaza,
          habitat: s.bestias.habitat,
        })
        .from(s.bestias)
        .where(and(eq(s.bestias.estadoPublicacion, "publicado"), isNull(s.bestias.eliminadoEn)))
        .orderBy(asc(s.bestias.nombre));
      return rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        subtitulo: r.subtitulo,
        imagenUrl: r.imagenUrl,
        href: `/bestias/${r.id}`,
        badge: r.amenaza ? `Amenaza ${r.amenaza}` : null,
        facets: { amenaza: r.amenaza, habitat: r.habitat },
      }));
    }
    case "minerales": {
      const rows = await db
        .select({ id: s.minerales.id, titulo: s.minerales.nombre, subtitulo: s.minerales.tipo, imagenUrl: s.minerales.imagenUrl, badge: s.minerales.rareza })
        .from(s.minerales)
        .where(and(eq(s.minerales.estadoPublicacion, "publicado"), isNull(s.minerales.eliminadoEn)))
        .orderBy(asc(s.minerales.nombre));
      return rows.map((r) => ({ ...r, href: `/minerales/${r.id}` }));
    }
    case "conceptos": {
      const rows = await db
        .select({ id: s.conceptos.id, titulo: s.conceptos.nombre, subtitulo: s.conceptos.categoria, imagenUrl: s.conceptos.imagenUrl })
        .from(s.conceptos)
        .where(and(eq(s.conceptos.estadoPublicacion, "publicado"), isNull(s.conceptos.eliminadoEn)))
        .orderBy(asc(s.conceptos.orden), asc(s.conceptos.nombre));
      return rows.map((r) => ({ ...r, href: `/conceptos/${r.id}` }));
    }
    case "magia": {
      const rows = await db
        .select({ id: s.magiaFundamentos.id, titulo: s.magiaFundamentos.nombre, subtitulo: s.magiaFundamentos.categoria, imagenUrl: s.magiaFundamentos.imagenUrl })
        .from(s.magiaFundamentos)
        .where(and(eq(s.magiaFundamentos.estadoPublicacion, "publicado"), isNull(s.magiaFundamentos.eliminadoEn)))
        .orderBy(asc(s.magiaFundamentos.orden), asc(s.magiaFundamentos.nombre));
      return rows.map((r) => ({ ...r, href: `/magia/${r.id}` }));
    }
    case "lore": {
      const rows = await db
        .select({ id: s.paginasLore.id, slug: s.paginasLore.slug, titulo: s.paginasLore.titulo, subtitulo: s.paginasLore.subtitulo, imagenUrl: s.paginasLore.imagenUrl })
        .from(s.paginasLore)
        .where(eq(s.paginasLore.estadoPublicacion, "publicado"))
        .orderBy(asc(s.paginasLore.titulo));
      return rows.map((r) => ({
        id: r.slug,
        titulo: r.titulo ?? r.slug,
        subtitulo: r.subtitulo,
        imagenUrl: r.imagenUrl,
        href: `/lore/${r.slug}`,
      }));
    }
    case "misiones": {
      const rows = await db
        .select({ id: s.misiones.id, titulo: s.misiones.nombre, subtitulo: s.misiones.tipo, badge: s.misiones.nivelRiesgo, estado: s.misiones.estado })
        .from(s.misiones)
        .where(and(eq(s.misiones.estadoPublicacion, "publicado"), isNull(s.misiones.eliminadoEn)))
        .orderBy(asc(s.misiones.nombre));
      return rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        subtitulo: r.estado ?? r.subtitulo,
        imagenUrl: null,
        href: `/misiones/${r.id}`,
        badge: r.badge ? `Riesgo ${r.badge}` : null,
      }));
    }
    case "demonios": {
      const rows = await db
        .select({ id: s.lordDemonio.id, titulo: s.lordDemonio.nombre, subtitulo: s.lordDemonio.titulo, imagenUrl: s.lordDemonio.imagenUrl, badge: s.lordDemonio.estado })
        .from(s.lordDemonio)
        .where(and(eq(s.lordDemonio.estadoPublicacion, "publicado"), isNull(s.lordDemonio.eliminadoEn)))
        .orderBy(asc(s.lordDemonio.nombre));
      return rows.map((r) => ({ ...r, href: `/demonios/${r.id}` }));
    }
    case "artefactos": {
      const rows = await db
        .select({ id: s.armasArtefactos.id, titulo: s.armasArtefactos.nombre, subtitulo: s.armasArtefactos.tipo, imagenUrl: s.armasArtefactos.imagenUrl, badge: s.armasArtefactos.tipo })
        .from(s.armasArtefactos)
        .where(and(eq(s.armasArtefactos.estadoPublicacion, "publicado"), isNull(s.armasArtefactos.eliminadoEn)))
        .orderBy(asc(s.armasArtefactos.nombre));
      return rows.map((r) => ({ ...r, href: `/artefactos/${r.id}` }));
    }
    default:
      return [];
  }
}

/** Conteo de elementos visibles de una sección (para cabeceras de índice). */
export async function countEntity(key: EntityKey): Promise<number> {
  const cards = await listEntityCards(key);
  return cards.length;
}

export { sql };
