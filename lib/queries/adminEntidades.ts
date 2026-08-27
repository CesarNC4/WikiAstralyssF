import "server-only";
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogos } from "@/db/schema/admin";
import { elementos } from "@/db/schema/elementos";
import type { OpcionCatalogo } from "@/components/admin/fields";
import { capitulos } from "@/db/schema/narrativa";
import { naciones, razas, sistemaMonetario } from "@/db/schema/mundo";
import { regiones, locaciones } from "@/db/schema/mapa";
import { getEntidadTable } from "@/lib/admin/tables";
import { getEntidadConfig, type EntidadConfig, type RefTarget } from "@/lib/admin/fields";
import { listPersonajesOpciones } from "@/lib/queries/adminPersonajes";
import { listMagiaOpciones } from "@/lib/queries/magia";
import type { EstadoPublicacion } from "@/db/schema/enums";

export interface OpcionRef {
  id: number;
  label: string;
}

/** Opciones para un campo de tipo 'reference'. */
export async function getOpcionesReferencia(target: RefTarget): Promise<OpcionRef[]> {
  if (target === "personajes") return listPersonajesOpciones();
  if (target === "magia") return listMagiaOpciones();
  if (target === "capitulos") {
    const rows = await db
      .select({ id: capitulos.id, numero: capitulos.numero, titulo: capitulos.titulo })
      .from(capitulos)
      .orderBy(asc(capitulos.numero));
    return rows.map((r) => ({ id: r.id, label: `Cap. ${r.numero} — ${r.titulo}` }));
  }
  if (target === "naciones") {
    const rows = await db.select({ id: naciones.id, label: naciones.nombre }).from(naciones).where(isNull(naciones.eliminadoEn)).orderBy(asc(naciones.nombre));
    return rows.map((r) => ({ id: r.id, label: r.label ?? `#${r.id}` }));
  }
  if (target === "razas") {
    const rows = await db.select({ id: razas.id, label: razas.nombre }).from(razas).where(isNull(razas.eliminadoEn)).orderBy(asc(razas.nombre));
    return rows.map((r) => ({ id: r.id, label: r.label ?? `#${r.id}` }));
  }
  if (target === "regiones") {
    const rows = await db.select({ id: regiones.id, label: regiones.nombre }).from(regiones).where(isNull(regiones.eliminadoEn)).orderBy(asc(regiones.nombre));
    return rows.map((r) => ({ id: r.id, label: r.label ?? `#${r.id}` }));
  }
  if (target === "locaciones") {
    const rows = await db.select({ id: locaciones.id, label: locaciones.nombre }).from(locaciones).where(isNull(locaciones.eliminadoEn)).orderBy(asc(locaciones.nombre));
    return rows.map((r) => ({ id: r.id, label: r.label ?? `#${r.id}` }));
  }
  if (target === "monedas") {
    const rows = await db.select({ id: sistemaMonetario.id, label: sistemaMonetario.nombre }).from(sistemaMonetario).where(isNull(sistemaMonetario.eliminadoEn)).orderBy(asc(sistemaMonetario.nombre));
    return rows.map((r) => ({ id: r.id, label: r.label ?? `#${r.id}` }));
  }
  return [];
}

/**
 * El catálogo elemental, en forma de opciones agrupadas por familia.
 *
 * Los elementos no viven en `catalogos` sino en su propia tabla, porque son más
 * que una etiqueta: tienen color, icono y ficha, y las fichas se vinculan a
 * ellos. Aquí se traducen a la misma forma que el resto de desplegables.
 */
export async function getElementosCatalogo(): Promise<OpcionCatalogo[]> {
  const rows = await db
    .select({ nombre: elementos.nombre, familia: elementos.familia, orden: elementos.orden })
    .from(elementos)
    .where(isNull(elementos.eliminadoEn))
    .orderBy(asc(elementos.orden), asc(elementos.nombre));
  return rows.map((r) => ({ valor: r.nombre, grupo: r.familia }));
}

/** Carga las opciones de todos los campos reference de una entidad. */
export async function getReferenciasDeConfig(
  config: EntidadConfig,
): Promise<Partial<Record<RefTarget, OpcionRef[]>>> {
  const targets = new Set(
    config.fields.filter((f) => f.type === "reference" && f.refTarget).map((f) => f.refTarget!),
  );
  const out: Partial<Record<RefTarget, OpcionRef[]>> = {};
  for (const t of targets) out[t] = await getOpcionesReferencia(t);
  return out;
}

export const ADMIN_PAGE_SIZE = 25;

export interface EntidadListItem {
  id: number;
  nombre: string;
  imagenUrl: string | null;
  estado: EstadoPublicacion;
  actualizadoEn: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cols = Record<string, any>;

function colsOf(key: string) {
  const table = getEntidadTable(key);
  const config = getEntidadConfig(key);
  if (!table || !config) throw new Error(`Entidad no registrada: ${key}`);
  return { table, config, c: getTableColumns(table) as Cols };
}

export async function listEntidadAdmin(
  key: string,
  params: { q?: string; estado?: EstadoPublicacion | "todos"; page?: number } = {},
): Promise<{ items: EntidadListItem[]; total: number; page: number; pageSize: number }> {
  const { table, config, c } = colsOf(key);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = ADMIN_PAGE_SIZE;

  const filtros = [isNull(c.eliminadoEn)];
  if (params.q?.trim()) filtros.push(ilike(c[config.nameField], `%${params.q.trim()}%`));
  if (params.estado && params.estado !== "todos") filtros.push(eq(c.estadoPublicacion, params.estado));
  const where = and(...filtros);

  const sel: Cols = {
    id: c.id,
    nombre: c[config.nameField],
    estado: c.estadoPublicacion,
    actualizadoEn: c.actualizadoEn,
    imagenUrl: config.hasImage ? c.imagenUrl : c.id, // placeholder si no hay imagen
  };

  const [rows, [tot]] = await Promise.all([
    db.select(sel).from(table).where(where).orderBy(asc(c[config.orderBy ?? config.nameField])).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ c: count() }).from(table).where(where),
  ]);

  const items: EntidadListItem[] = (rows as Cols[]).map((r) => ({
    id: r.id as number,
    nombre: String(r.nombre ?? ""),
    imagenUrl: config.hasImage ? ((r.imagenUrl as string) ?? null) : null,
    estado: r.estado as EstadoPublicacion,
    actualizadoEn: r.actualizadoEn as Date,
  }));

  return { items, total: tot?.c ?? 0, page, pageSize };
}

export async function listPapeleraEntidad(key: string): Promise<EntidadListItem[]> {
  const { table, config, c } = colsOf(key);
  const sel: Cols = {
    id: c.id,
    nombre: c[config.nameField],
    estado: c.estadoPublicacion,
    actualizadoEn: c.actualizadoEn,
    imagenUrl: config.hasImage ? c.imagenUrl : c.id,
  };
  const rows = await db.select(sel).from(table).where(isNotNull(c.eliminadoEn)).orderBy(desc(c.eliminadoEn));
  return (rows as Cols[]).map((r) => ({
    id: r.id as number,
    nombre: String(r.nombre ?? ""),
    imagenUrl: config.hasImage ? ((r.imagenUrl as string) ?? null) : null,
    estado: r.estado as EstadoPublicacion,
    actualizadoEn: r.actualizadoEn as Date,
  }));
}

/** Fila completa para edición (incluye no publicados; excluye eliminados). */
export async function getEntidadParaEditar(key: string, id: number): Promise<Record<string, unknown> | null> {
  const { table, c } = colsOf(key);
  const [row] = await db.select().from(table).where(and(eq(c.id, id), isNull(c.eliminadoEn))).limit(1);
  return (row as Record<string, unknown>) ?? null;
}

/**
 * Carga las opciones de catálogo de una lista de campos.
 *
 * Devuelve también el , que antes se descartaba. Ese descarte era un
 * fallo con consecuencias visibles: en la ficha de Magia salían las variantes de
 * todas las escuelas mezcladas, porque la dependencia vive justo en el grupo.
 */
export async function getCatalogosPorCampos(campos: string[]): Promise<Record<string, OpcionCatalogo[]>> {
  const out: Record<string, OpcionCatalogo[]> = {};
  for (const campo of campos) out[campo] = [];
  if (campos.length === 0) return out;
  const rows = await db
    .select({ campo: catalogos.campo, valor: catalogos.valor, grupo: catalogos.grupo })
    .from(catalogos)
    .where(inArray(catalogos.campo, campos))
    .orderBy(asc(catalogos.grupo), asc(catalogos.orden), asc(catalogos.valor));
  for (const r of rows) (out[r.campo] ??= []).push({ valor: r.valor, grupo: r.grupo });
  return out;
}
