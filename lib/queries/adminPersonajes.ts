import "server-only";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const ADMIN_PAGE_SIZE = 25;

export interface PersonajeListItem {
  id: number;
  nombre: string;
  surname: string | null;
  titulo: string | null;
  imagenUrl: string | null;
  estado: EstadoPublicacion;
  actualizadoEn: Date;
}

export interface ListPersonajesParams {
  q?: string;
  estado?: EstadoPublicacion | "todos";
  page?: number;
}

/** Tabla de gestión: personajes no eliminados, paginados, ordenados alfabéticamente. */
export async function listPersonajesAdmin(
  params: ListPersonajesParams = {},
): Promise<{ items: PersonajeListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE;

  const filtros = [isNull(s.personajes.eliminadoEn)];
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    filtros.push(or(ilike(s.personajes.nombre, term), ilike(s.personajes.surname, term))!);
  }
  if (params.estado && params.estado !== "todos") {
    filtros.push(eq(s.personajes.estadoPublicacion, params.estado));
  }
  const where = and(...filtros);

  const [items, [tot]] = await Promise.all([
    db
      .select({
        id: s.personajes.id,
        nombre: s.personajes.nombre,
        surname: s.personajes.surname,
        titulo: s.personajes.titulo,
        imagenUrl: s.personajes.imagenUrl,
        estado: s.personajes.estadoPublicacion,
        actualizadoEn: s.personajes.actualizadoEn,
      })
      .from(s.personajes)
      .where(where)
      .orderBy(asc(s.personajes.nombre))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ c: count() }).from(s.personajes).where(where),
  ]);

  return { items, total: tot?.c ?? 0, page, pageSize };
}

/** Personajes en la papelera (eliminados), más recientes primero. */
export async function listPapelera(): Promise<PersonajeListItem[]> {
  return db
    .select({
      id: s.personajes.id,
      nombre: s.personajes.nombre,
      surname: s.personajes.surname,
      titulo: s.personajes.titulo,
      imagenUrl: s.personajes.imagenUrl,
      estado: s.personajes.estadoPublicacion,
      actualizadoEn: s.personajes.actualizadoEn,
    })
    .from(s.personajes)
    .where(isNotNull(s.personajes.eliminadoEn))
    .orderBy(desc(s.personajes.eliminadoEn));
}

/** Ficha completa para edición (incluye no publicados; excluye solo lo eliminado). */
export async function getPersonajeParaEditar(id: number) {
  return db.query.personajes.findFirst({
    where: (p, { eq, and, isNull }) => and(eq(p.id, id), isNull(p.eliminadoEn)),
    with: {
      estadisticas: true,
      habilidades: { with: { fundamento: { columns: { id: true, nombre: true } } } },
      eventos: { with: { evento: { columns: { id: true, fechaLore: true, titulo: true } } } },
      objetos: { with: { objeto: { columns: { id: true, nombre: true, tipo: true } } } },
      relaciones: {
        with: {
          relacionado: { columns: { id: true, nombre: true, surname: true } },
        },
      },
      naciones: { with: { nacion: { columns: { id: true, nombre: true } } } },
      razas: { with: { raza: { columns: { id: true, nombre: true } } } },
      organizaciones: { with: { organizacion: { columns: { id: true, nombre: true } } } },
    },
  });
}

/** Nombres de las familias a las que pertenece el PJ (derivado de familia_jerarquia). */
export async function listFamiliasDePersonaje(personajeId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ nombre: s.familias.nombre })
    .from(s.familiaJerarquia)
    .innerJoin(s.familias, eq(s.familiaJerarquia.familiaId, s.familias.id))
    .where(and(eq(s.familiaJerarquia.personajeId, personajeId), isNull(s.familias.eliminadoEn)))
    .orderBy(asc(s.familias.nombre));
  return rows.map((r) => r.nombre).filter(Boolean);
}

export type PersonajeParaEditar = NonNullable<Awaited<ReturnType<typeof getPersonajeParaEditar>>>;

// ── Opciones para selectores con buscador (pickers) ────────────────────────
export interface Opcion {
  id: number;
  label: string;
}

export async function listPersonajesOpciones(excluirId?: number): Promise<Opcion[]> {
  const rows = await db
    .select({ id: s.personajes.id, nombre: s.personajes.nombre, surname: s.personajes.surname })
    .from(s.personajes)
    .where(
      excluirId
        ? and(isNull(s.personajes.eliminadoEn), ne(s.personajes.id, excluirId))
        : isNull(s.personajes.eliminadoEn),
    )
    .orderBy(asc(s.personajes.nombre));
  return rows.map((r) => ({ id: r.id, label: [r.nombre, r.surname].filter(Boolean).join(" ") }));
}

export async function listNacionesOpciones(): Promise<Opcion[]> {
  const rows = await db
    .select({ id: s.naciones.id, nombre: s.naciones.nombre })
    .from(s.naciones)
    .orderBy(asc(s.naciones.nombre));
  return rows.map((r) => ({ id: r.id, label: r.nombre }));
}

export async function listRazasOpciones(): Promise<Opcion[]> {
  const rows = await db
    .select({ id: s.razas.id, nombre: s.razas.nombre })
    .from(s.razas)
    .orderBy(asc(s.razas.nombre));
  return rows.map((r) => ({ id: r.id, label: r.nombre }));
}

export async function listOrganizacionesOpciones(): Promise<Opcion[]> {
  const rows = await db
    .select({ id: s.organizaciones.id, nombre: s.organizaciones.nombre })
    .from(s.organizaciones)
    .orderBy(asc(s.organizaciones.nombre));
  return rows.map((r) => ({ id: r.id, label: r.nombre }));
}

/** Técnicas reutilizables del catálogo Magia (excluye la teoría: Fundamento y Concepto). */
export async function listMagiaHechizosOpciones(): Promise<Opcion[]> {
  const rows = await db
    .select({
      id: s.magiaFundamentos.id,
      nombre: s.magiaFundamentos.nombre,
      tipo: s.magiaFundamentos.tipo,
      subcategoria: s.magiaFundamentos.subcategoria,
      naturaleza: s.magiaFundamentos.naturaleza,
    })
    .from(s.magiaFundamentos)
    .where(isNull(s.magiaFundamentos.eliminadoEn))
    .orderBy(asc(s.magiaFundamentos.nombre));
  const excluidas = new Set(["fundamento", "concepto"]);
  return rows
    .filter((r) => !excluidas.has((r.naturaleza ?? "").trim().toLowerCase()))
    .map((r) => ({
      id: r.id,
      label: [r.nombre, [r.tipo, r.subcategoria].filter(Boolean).join(" · ")].filter(Boolean).join(" — "),
    }));
}

/** Eventos de la cronología global (para vincular eventos clave del PJ). */
export async function listTimelineOpciones(): Promise<Opcion[]> {
  const rows = await db
    .select({ id: s.timelineEventos.id, fechaLore: s.timelineEventos.fechaLore, titulo: s.timelineEventos.titulo })
    .from(s.timelineEventos)
    .where(isNull(s.timelineEventos.eliminadoEn))
    .orderBy(asc(s.timelineEventos.orden), asc(s.timelineEventos.titulo));
  return rows.map((r) => ({ id: r.id, label: [r.fechaLore, r.titulo].filter(Boolean).join(" · ") }));
}

/** Armas/artefactos/objetos del catálogo global (para vincular objetos del PJ). */
export async function listArtefactosOpciones(): Promise<Opcion[]> {
  const rows = await db
    .select({ id: s.armasArtefactos.id, nombre: s.armasArtefactos.nombre, tipo: s.armasArtefactos.tipo })
    .from(s.armasArtefactos)
    .where(isNull(s.armasArtefactos.eliminadoEn))
    .orderBy(asc(s.armasArtefactos.nombre));
  return rows.map((r) => ({ id: r.id, label: r.tipo ? `${r.nombre} (${r.tipo})` : r.nombre }));
}
