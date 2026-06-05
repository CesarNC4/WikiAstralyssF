import "server-only";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/** Ficha completa de personaje con todas sus relaciones (§5.2). */
export async function getPersonajeFicha(id: number) {
  return db.query.personajes.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, id), eq(p.estadoPublicacion, "publicado")),
    with: {
      estadisticas: true,
      habilidades: true,
      eventos: true,
      narrativa: true,
      equipamiento: true,
      objetos: true,
      relaciones: {
        with: {
          relacionado: {
            columns: { id: true, nombre: true, surname: true, imagenUrl: true, titulo: true },
          },
        },
      },
      canciones: { with: { cancion: true } },
      naciones: {
        with: { nacion: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
      razas: {
        with: { raza: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
      organizaciones: {
        with: { organizacion: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
    },
  });
}

export type PersonajeFicha = NonNullable<Awaited<ReturnType<typeof getPersonajeFicha>>>;

/** Personajes asociados a una nación (para la ficha de nación). */
export async function getPersonajesDeNacion(nacionId: number) {
  return db
    .select({
      id: s.personajes.id,
      nombre: s.personajes.nombre,
      imagenUrl: s.personajes.imagenUrl,
      titulo: s.personajes.titulo,
      tipo: s.personajeNacion.tipo,
    })
    .from(s.personajeNacion)
    .innerJoin(s.personajes, eq(s.personajeNacion.personajeId, s.personajes.id))
    .where(and(eq(s.personajeNacion.nacionId, nacionId), eq(s.personajes.estadoPublicacion, "publicado")))
    .limit(24);
}

// ── Getters simples por id (prosa) ───────────────────────
async function firstVisible<T extends { id: unknown }>(
  rows: Promise<T[]>,
): Promise<T | undefined> {
  return (await rows)[0];
}

export async function getNacion(id: number) {
  return firstVisible(
    db.select().from(s.naciones).where(and(eq(s.naciones.id, id), eq(s.naciones.estadoPublicacion, "publicado"))).limit(1),
  );
}
export async function getRaza(id: number) {
  return firstVisible(
    db.select().from(s.razas).where(and(eq(s.razas.id, id), eq(s.razas.estadoPublicacion, "publicado"))).limit(1),
  );
}
export async function getBestia(id: number) {
  return firstVisible(
    db.select().from(s.bestias).where(and(eq(s.bestias.id, id), eq(s.bestias.estadoPublicacion, "publicado"))).limit(1),
  );
}
export async function getMineral(id: number) {
  return firstVisible(
    db.select().from(s.minerales).where(and(eq(s.minerales.id, id), eq(s.minerales.estadoPublicacion, "publicado"))).limit(1),
  );
}
export async function getConcepto(id: number) {
  return firstVisible(
    db.select().from(s.conceptos).where(and(eq(s.conceptos.id, id), eq(s.conceptos.estadoPublicacion, "publicado"))).limit(1),
  );
}
export async function getMagia(id: number) {
  return firstVisible(
    db.select().from(s.magiaFundamentos).where(and(eq(s.magiaFundamentos.id, id), eq(s.magiaFundamentos.estadoPublicacion, "publicado"))).limit(1),
  );
}
export async function getMision(id: number) {
  return firstVisible(
    db.select().from(s.misiones).where(and(eq(s.misiones.id, id), eq(s.misiones.estadoPublicacion, "publicado"))).limit(1),
  );
}
export async function getPaginaLore(slug: string) {
  return firstVisible(
    db.select().from(s.paginasLore).where(and(eq(s.paginasLore.slug, slug), eq(s.paginasLore.estadoPublicacion, "publicado"))).limit(1),
  );
}

/** Página de lore con sus secciones ordenadas (§1, problema 2). */
export async function getPaginaLoreConSecciones(slug: string) {
  const pagina = await getPaginaLore(slug);
  if (!pagina) return null;
  const secciones = await db
    .select({
      id: s.paginaSecciones.id,
      orden: s.paginaSecciones.orden,
      titulo: s.paginaSecciones.titulo,
      contenido: s.paginaSecciones.contenido,
      tipo: s.paginaSecciones.tipo,
    })
    .from(s.paginaSecciones)
    .where(and(eq(s.paginaSecciones.paginaId, pagina.id), eq(s.paginaSecciones.estadoPublicacion, "publicado")))
    .orderBy(asc(s.paginaSecciones.orden));
  return { pagina, secciones };
}

// ── Organización (con jerarquía y facciones) ─────────────
export async function getOrganizacionFicha(id: number) {
  const org = await firstVisible(
    db.select().from(s.organizaciones).where(and(eq(s.organizaciones.id, id), eq(s.organizaciones.estadoPublicacion, "publicado"))).limit(1),
  );
  if (!org) return null;

  const [jerarquia, facciones, historial] = await Promise.all([
    db
      .select({
        id: s.orgJerarquia.id,
        tituloApodo: s.orgJerarquia.tituloApodo,
        orden: s.orgJerarquia.orden,
        personajeId: s.personajes.id,
        personajeNombre: s.personajes.nombre,
        personajeImg: s.personajes.imagenUrl,
        rango: s.orgRangos.nombre,
        rangoPeso: s.orgRangos.peso,
      })
      .from(s.orgJerarquia)
      .leftJoin(s.personajes, eq(s.orgJerarquia.personajeId, s.personajes.id))
      .leftJoin(s.orgRangos, eq(s.orgJerarquia.rangoId, s.orgRangos.id))
      .where(eq(s.orgJerarquia.organizacionId, id))
      .orderBy(asc(s.orgJerarquia.orden)),
    db.select().from(s.orgFacciones).where(eq(s.orgFacciones.organizacionId, id)),
    db.select().from(s.orgHistorial).where(eq(s.orgHistorial.organizacionId, id)),
  ]);

  return { org, jerarquia, facciones, historial };
}

// ── Familia (con árbol y jerarquía) ──────────────────────
export async function getFamiliaFicha(id: number) {
  const familia = await firstVisible(
    db.select().from(s.familias).where(and(eq(s.familias.id, id), eq(s.familias.estadoPublicacion, "publicado"))).limit(1),
  );
  if (!familia) return null;

  const [arbol, jerarquia, facciones] = await Promise.all([
    db
      .select({
        id: s.familiaArbol.id,
        nombre: s.familiaArbol.nombre,
        generacion: s.familiaArbol.generacion,
        padreId: s.familiaArbol.padreId,
        madreId: s.familiaArbol.madreId,
        estado: s.familiaArbol.estado,
        destacado: s.familiaArbol.destacado,
        personajeId: s.familiaArbol.personajeId,
      })
      .from(s.familiaArbol)
      .where(eq(s.familiaArbol.familiaId, id))
      .orderBy(asc(s.familiaArbol.generacion)),
    db
      .select({
        id: s.familiaJerarquia.id,
        tituloNobiliario: s.familiaJerarquia.tituloNobiliario,
        tituloFamilia: s.familiaJerarquia.tituloFamilia,
        orden: s.familiaJerarquia.orden,
        personajeId: s.personajes.id,
        personajeNombre: s.personajes.nombre,
        personajeImg: s.personajes.imagenUrl,
      })
      .from(s.familiaJerarquia)
      .leftJoin(s.personajes, eq(s.familiaJerarquia.personajeId, s.personajes.id))
      .where(eq(s.familiaJerarquia.familiaId, id))
      .orderBy(asc(s.familiaJerarquia.orden)),
    db.select().from(s.familiaFacciones).where(eq(s.familiaFacciones.familiaId, id)),
  ]);

  return { familia, arbol, jerarquia, facciones };
}

// ── generateStaticParams helpers (ids visibles) ──────────
export async function getVisibleIds(
  key: "personajes" | "naciones" | "organizaciones" | "familias" | "razas" | "bestias" | "minerales" | "conceptos" | "magia" | "misiones",
): Promise<number[]> {
  const table = {
    personajes: s.personajes,
    naciones: s.naciones,
    organizaciones: s.organizaciones,
    familias: s.familias,
    razas: s.razas,
    bestias: s.bestias,
    minerales: s.minerales,
    conceptos: s.conceptos,
    magia: s.magiaFundamentos,
    misiones: s.misiones,
  }[key];
  const rows = await db.select({ id: table.id }).from(table).where(eq(table.estadoPublicacion, "publicado"));
  return rows.map((r) => r.id);
}

export async function getLoreSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: s.paginasLore.slug })
    .from(s.paginasLore)
    .where(eq(s.paginasLore.estadoPublicacion, "publicado"));
  return rows.map((r) => r.slug);
}
