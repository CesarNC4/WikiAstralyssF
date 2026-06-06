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
      habilidades: true,
      eventos: true,
      equipamiento: true,
      objetos: true,
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
