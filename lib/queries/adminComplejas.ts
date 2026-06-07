import "server-only";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { EstadoPublicacion } from "@/db/schema/enums";
import type { RangoRow, FaccionRow, JerarquiaRow, HistorialRow, ArbolRow } from "@/lib/admin/complejas";

export const ADMIN_PAGE_SIZE = 25;

export interface ComplejaListItem {
  id: number;
  nombre: string;
  imagenUrl: string | null;
  estado: EstadoPublicacion;
  actualizadoEn: Date;
}

const dbKey = (id: number) => `db_${id}`;

// ── Listados (org y familia comparten forma) ────────────────────────────────
type ListTable = typeof s.organizaciones | typeof s.familias;

async function listComplejaAdmin(
  table: ListTable,
  params: { q?: string; estado?: EstadoPublicacion | "todos"; page?: number },
): Promise<{ items: ComplejaListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE;
  const filtros = [isNull(table.eliminadoEn)];
  if (params.q?.trim()) filtros.push(ilike(table.nombre, `%${params.q.trim()}%`));
  if (params.estado && params.estado !== "todos") filtros.push(eq(table.estadoPublicacion, params.estado));
  const where = and(...filtros);

  const sel = {
    id: table.id,
    nombre: table.nombre,
    imagenUrl: table.imagenUrl,
    estado: table.estadoPublicacion,
    actualizadoEn: table.actualizadoEn,
  };
  const [rows, [tot]] = await Promise.all([
    db.select(sel).from(table).where(where).orderBy(asc(table.nombre)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ c: count() }).from(table).where(where),
  ]);
  const items = rows.map((r) => ({ ...r, nombre: r.nombre ?? "" }));
  return { items, total: tot?.c ?? 0, page, pageSize };
}

async function listPapelera(table: ListTable): Promise<ComplejaListItem[]> {
  const sel = {
    id: table.id,
    nombre: table.nombre,
    imagenUrl: table.imagenUrl,
    estado: table.estadoPublicacion,
    actualizadoEn: table.actualizadoEn,
  };
  const rows = await db.select(sel).from(table).where(isNotNull(table.eliminadoEn)).orderBy(desc(table.eliminadoEn));
  return rows.map((r) => ({ ...r, nombre: r.nombre ?? "" }));
}

export const listOrgAdmin = (p: Parameters<typeof listComplejaAdmin>[1] = {}) => listComplejaAdmin(s.organizaciones, p);
export const listFamiliaAdmin = (p: Parameters<typeof listComplejaAdmin>[1] = {}) => listComplejaAdmin(s.familias, p);
export const listPapeleraOrg = () => listPapelera(s.organizaciones);
export const listPapeleraFamilia = () => listPapelera(s.familias);

// ── Mapeo de sub-tablas → filas de cliente (con key estable) ────────────────
function mapRangos(rows: { id: number; nombre: string; peso: number | null }[]): RangoRow[] {
  return rows.map((r) => ({ key: dbKey(r.id), id: r.id, nombre: r.nombre, peso: r.peso ?? 0 }));
}
function mapFacciones(rows: { id: number; nombre: string; color: string | null }[]): FaccionRow[] {
  return rows.map((r) => ({ key: dbKey(r.id), id: r.id, nombre: r.nombre, color: r.color ?? "" }));
}

// ── Organización para editar ────────────────────────────────────────────────
export async function getOrgParaEditar(id: number) {
  const [org] = await db
    .select()
    .from(s.organizaciones)
    .where(and(eq(s.organizaciones.id, id), isNull(s.organizaciones.eliminadoEn)))
    .limit(1);
  if (!org) return null;

  const [rangosRaw, faccionesRaw, jerRaw, histRaw] = await Promise.all([
    db.select().from(s.orgRangos).where(eq(s.orgRangos.organizacionId, id)).orderBy(desc(s.orgRangos.peso)),
    db.select().from(s.orgFacciones).where(eq(s.orgFacciones.organizacionId, id)).orderBy(asc(s.orgFacciones.id)),
    db.select().from(s.orgJerarquia).where(eq(s.orgJerarquia.organizacionId, id)).orderBy(asc(s.orgJerarquia.orden)),
    db.select().from(s.orgHistorial).where(eq(s.orgHistorial.organizacionId, id)).orderBy(asc(s.orgHistorial.orden)),
  ]);

  const rangos = mapRangos(rangosRaw);
  const facciones = mapFacciones(faccionesRaw);
  const rangoKeyDe = (rid: number | null) => (rid != null ? dbKey(rid) : null);
  const faccionKeyDe = (fid: number | null) => (fid != null ? dbKey(fid) : null);

  const jerarquia: JerarquiaRow[] = jerRaw.map((r) => ({
    key: dbKey(r.id),
    id: r.id,
    personajeId: r.personajeId ?? null,
    nombre: r.nombre ?? "",
    rangoKey: rangoKeyDe(r.rangoId),
    faccionKey: faccionKeyDe(r.faccionId),
    tituloApodo: r.tituloApodo ?? "",
    tituloNobiliario: "",
    tituloFamilia: "",
  }));

  const historial: HistorialRow[] = histRaw.map((r) => ({
    key: dbKey(r.id),
    id: r.id,
    nombre: r.nombre,
    personajeId: r.personajeId ?? null,
    estado: r.estado ?? "",
    rol: r.rol ?? "",
    periodo: r.periodo ?? "",
    destacado: r.destacado ?? false,
    motivoDestacado: r.motivoDestacado ?? "",
    notas: r.notas ?? "",
  }));

  return { org, rangos, facciones, jerarquia, historial };
}

// ── Familia para editar ─────────────────────────────────────────────────────
export async function getFamiliaParaEditar(id: number) {
  const [familia] = await db
    .select()
    .from(s.familias)
    .where(and(eq(s.familias.id, id), isNull(s.familias.eliminadoEn)))
    .limit(1);
  if (!familia) return null;

  const [faccionesRaw, jerRaw, arbolRaw] = await Promise.all([
    db.select().from(s.familiaFacciones).where(eq(s.familiaFacciones.familiaId, id)).orderBy(asc(s.familiaFacciones.id)),
    db.select().from(s.familiaJerarquia).where(eq(s.familiaJerarquia.familiaId, id)).orderBy(asc(s.familiaJerarquia.orden)),
    db.select().from(s.familiaArbol).where(eq(s.familiaArbol.familiaId, id)).orderBy(asc(s.familiaArbol.generacion), asc(s.familiaArbol.id)),
  ]);

  const facciones = mapFacciones(faccionesRaw);
  const faccionKeyDe = (fid: number | null) => (fid != null ? dbKey(fid) : null);

  const jerarquia: JerarquiaRow[] = jerRaw.map((r) => ({
    key: dbKey(r.id),
    id: r.id,
    personajeId: r.personajeId ?? null,
    nombre: r.nombre ?? "",
    rangoKey: null,
    faccionKey: faccionKeyDe(r.faccionId),
    tituloApodo: "",
    tituloNobiliario: r.tituloNobiliario ?? "",
    tituloFamilia: r.tituloFamilia ?? "",
  }));

  const arbol: ArbolRow[] = arbolRaw.map((r) => ({
    key: dbKey(r.id),
    id: r.id,
    nombre: r.nombre,
    personajeId: r.personajeId ?? null,
    generacion: r.generacion ?? 0,
    padreKey: r.padreId != null ? dbKey(r.padreId) : null,
    madreKey: r.madreId != null ? dbKey(r.madreId) : null,
    estado: r.estado ?? "",
    destacado: r.destacado ?? false,
    motivoDestacado: r.motivoDestacado ?? "",
    notas: r.notas ?? "",
  }));

  return { familia, facciones, jerarquia, arbol };
}

// ── Preview (sin filtro de publicado; resuelve nombre libre vs ficha) ───────
export interface FichaJerarquia {
  id: number;
  nombre: string | null;
  tituloApodo: string | null;
  tituloNobiliario: string | null;
  tituloFamilia: string | null;
  rango: string | null;
  personajeId: number | null;
  personajeImg: string | null;
}

export async function getOrgPreview(id: number) {
  const [org] = await db.select().from(s.organizaciones).where(eq(s.organizaciones.id, id)).limit(1);
  if (!org) return null;
  const [jerRaw, facciones, historial] = await Promise.all([
    db
      .select({
        id: s.orgJerarquia.id,
        nombreLibre: s.orgJerarquia.nombre,
        tituloApodo: s.orgJerarquia.tituloApodo,
        orden: s.orgJerarquia.orden,
        personajeId: s.personajes.id,
        personajeNombre: s.personajes.nombre,
        personajeImg: s.personajes.imagenUrl,
        rango: s.orgRangos.nombre,
      })
      .from(s.orgJerarquia)
      .leftJoin(s.personajes, eq(s.orgJerarquia.personajeId, s.personajes.id))
      .leftJoin(s.orgRangos, eq(s.orgJerarquia.rangoId, s.orgRangos.id))
      .where(eq(s.orgJerarquia.organizacionId, id))
      .orderBy(asc(s.orgJerarquia.orden)),
    db.select().from(s.orgFacciones).where(eq(s.orgFacciones.organizacionId, id)).orderBy(asc(s.orgFacciones.id)),
    db.select().from(s.orgHistorial).where(eq(s.orgHistorial.organizacionId, id)).orderBy(asc(s.orgHistorial.orden)),
  ]);
  const jerarquia: FichaJerarquia[] = jerRaw.map((j) => ({
    id: j.id,
    nombre: j.personajeNombre ?? j.nombreLibre ?? null,
    tituloApodo: j.tituloApodo,
    tituloNobiliario: null,
    tituloFamilia: null,
    rango: j.rango,
    personajeId: j.personajeId,
    personajeImg: j.personajeImg,
  }));
  return { org, jerarquia, facciones, historial };
}

export async function getFamiliaPreview(id: number) {
  const [familia] = await db.select().from(s.familias).where(eq(s.familias.id, id)).limit(1);
  if (!familia) return null;
  const [arbol, jerRaw, facciones] = await Promise.all([
    db.select().from(s.familiaArbol).where(eq(s.familiaArbol.familiaId, id)).orderBy(asc(s.familiaArbol.generacion), asc(s.familiaArbol.id)),
    db
      .select({
        id: s.familiaJerarquia.id,
        nombreLibre: s.familiaJerarquia.nombre,
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
    db.select().from(s.familiaFacciones).where(eq(s.familiaFacciones.familiaId, id)).orderBy(asc(s.familiaFacciones.id)),
  ]);
  const jerarquia: FichaJerarquia[] = jerRaw.map((j) => ({
    id: j.id,
    nombre: j.personajeNombre ?? j.nombreLibre ?? null,
    tituloApodo: null,
    tituloNobiliario: j.tituloNobiliario,
    tituloFamilia: j.tituloFamilia,
    rango: null,
    personajeId: j.personajeId,
    personajeImg: j.personajeImg,
  }));
  return { familia, arbol, jerarquia, facciones };
}

// ── Gremio (singleton) ──────────────────────────────────────────────────────
/** Devuelve el gremio; lo crea si aún no existe (singleton). */
export async function getGremioParaEditar() {
  let [gremio] = await db.select().from(s.gremio).limit(1);
  if (!gremio) {
    [gremio] = await db.insert(s.gremio).values({ nombre: "Gremio" }).returning();
  }
  const gid = gremio.id;

  const [rangosRaw, faccionesRaw, jerRaw, histRaw] = await Promise.all([
    db.select().from(s.gremioRangos).where(eq(s.gremioRangos.gremioId, gid)).orderBy(desc(s.gremioRangos.peso)),
    db.select().from(s.gremioFacciones).where(eq(s.gremioFacciones.gremioId, gid)).orderBy(asc(s.gremioFacciones.id)),
    db.select().from(s.gremioJerarquia).where(eq(s.gremioJerarquia.gremioId, gid)).orderBy(asc(s.gremioJerarquia.orden)),
    db.select().from(s.gremioHistorial).where(eq(s.gremioHistorial.gremioId, gid)).orderBy(asc(s.gremioHistorial.orden)),
  ]);

  const rangos = mapRangos(rangosRaw);
  const facciones = mapFacciones(faccionesRaw);
  const rangoKeyDe = (rid: number | null) => (rid != null ? dbKey(rid) : null);
  const faccionKeyDe = (fid: number | null) => (fid != null ? dbKey(fid) : null);

  const jerarquia: JerarquiaRow[] = jerRaw.map((r) => ({
    key: dbKey(r.id),
    id: r.id,
    personajeId: r.personajeId ?? null,
    nombre: r.nombre ?? "",
    rangoKey: rangoKeyDe(r.rangoId),
    faccionKey: faccionKeyDe(r.faccionId),
    tituloApodo: r.tituloApodo ?? "",
    tituloNobiliario: "",
    tituloFamilia: "",
  }));

  const historial: HistorialRow[] = histRaw.map((r) => ({
    key: dbKey(r.id),
    id: r.id,
    nombre: r.nombre,
    personajeId: r.personajeId ?? null,
    estado: r.estado ?? "",
    rol: r.rol ?? "",
    periodo: r.periodo ?? "",
    destacado: r.destacado ?? false,
    motivoDestacado: r.motivoDestacado ?? "",
    notas: r.notas ?? "",
  }));

  return { gremio, rangos, facciones, jerarquia, historial };
}
