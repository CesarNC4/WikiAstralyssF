import "server-only";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const ADMIN_PAGE_SIZE = 25;

export interface LoreListItem {
  id: number;
  titulo: string;
  slug: string;
  imagenUrl: string | null;
  estado: EstadoPublicacion;
  actualizadoEn: Date;
}

const listSel = {
  id: s.paginasLore.id,
  titulo: s.paginasLore.titulo,
  slug: s.paginasLore.slug,
  imagenUrl: s.paginasLore.imagenUrl,
  estado: s.paginasLore.estadoPublicacion,
  actualizadoEn: s.paginasLore.actualizadoEn,
};

function mapItem(r: { id: number; titulo: string | null; slug: string; imagenUrl: string | null; estado: EstadoPublicacion; actualizadoEn: Date }): LoreListItem {
  return { id: r.id, titulo: r.titulo ?? r.slug, slug: r.slug, imagenUrl: r.imagenUrl, estado: r.estado, actualizadoEn: r.actualizadoEn };
}

export async function listLoreAdmin(
  params: { q?: string; estado?: EstadoPublicacion | "todos"; page?: number } = {},
): Promise<{ items: LoreListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE;
  const filtros = [isNull(s.paginasLore.eliminadoEn)];
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    filtros.push(or(ilike(s.paginasLore.titulo, term), ilike(s.paginasLore.slug, term))!);
  }
  if (params.estado && params.estado !== "todos") filtros.push(eq(s.paginasLore.estadoPublicacion, params.estado));
  const where = and(...filtros);

  const [rows, [tot]] = await Promise.all([
    db.select(listSel).from(s.paginasLore).where(where).orderBy(asc(s.paginasLore.titulo)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ c: count() }).from(s.paginasLore).where(where),
  ]);
  return { items: rows.map(mapItem), total: tot?.c ?? 0, page, pageSize };
}

export async function listPapeleraLore(): Promise<LoreListItem[]> {
  const rows = await db.select(listSel).from(s.paginasLore).where(isNotNull(s.paginasLore.eliminadoEn)).orderBy(desc(s.paginasLore.eliminadoEn));
  return rows.map(mapItem);
}

async function seccionesDe(paginaId: number) {
  return db
    .select({
      id: s.paginaSecciones.id,
      orden: s.paginaSecciones.orden,
      titulo: s.paginaSecciones.titulo,
      contenido: s.paginaSecciones.contenido,
      tipo: s.paginaSecciones.tipo,
      estadoPublicacion: s.paginaSecciones.estadoPublicacion,
    })
    .from(s.paginaSecciones)
    .where(eq(s.paginaSecciones.paginaId, paginaId))
    .orderBy(asc(s.paginaSecciones.orden));
}

/** Página + secciones para edición (incluye no publicadas; excluye eliminada). */
export async function getLoreParaEditar(id: number) {
  const [pagina] = await db.select().from(s.paginasLore).where(and(eq(s.paginasLore.id, id), isNull(s.paginasLore.eliminadoEn))).limit(1);
  if (!pagina) return null;
  const secciones = await seccionesDe(id);
  return { pagina, secciones };
}

/** Preview (todas las secciones, sin filtro de estado). */
export async function getLorePreview(id: number) {
  return getLoreParaEditar(id);
}
