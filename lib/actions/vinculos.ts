"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, ilike, isNull, or, sql, getTableColumns } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { infoDe } from "@/lib/relaciones/tablas";
import { CUALQUIERA, getRelacion } from "@/lib/relaciones/registro";
import {
  leerFilas,
  crearVinculo as crear,
  actualizarVinculo as actualizar,
  borrarVinculo as borrar,
  reordenarVinculos as reordenar,
  type Campos,
  contarBloques,
  type DestinoNuevo,
} from "@/lib/relaciones/consultas";
import type { FilaVinculo } from "@/lib/relaciones/tipos";

/**
 * Acciones del editor de relaciones. Todas exigen sesión de administrador: al
 * ser un módulo "use server", cada export es un endpoint alcanzable desde el
 * navegador y no basta con que el panel sólo se pinte dentro de /admin.
 */

/** Una ficha candidata en el selector, con contexto para distinguir homónimos. */
export interface OpcionFicha {
  id: number;
  label: string;
  /** Título, número de capítulo, artista… lo que ayude a no confundirse. */
  detalle: string | null;
  imagenUrl: string | null;
  estado: string | null;
  /** Entidad de la ficha. Importa en los selectores que aceptan cualquier tipo. */
  entidad: string;
}

type Cols = Record<string, PgColumn>;
const cols = (t: PgTable) => getTableColumns(t) as unknown as Cols;

export async function resumenConexiones(entidad: string, ownerId: number): Promise<Record<string, number>> {
  await assertAdmin();
  return contarBloques(entidad, ownerId);
}

export async function listarVinculos(relId: string, lado: "a" | "b", ownerId: number): Promise<FilaVinculo[]> {
  await assertAdmin();
  return leerFilas(relId, lado, ownerId);
}

/**
 * Busca fichas para vincular. Con 210 personajes una lista desplegable no sirve:
 * se filtra por texto y se devuelve contexto suficiente para elegir bien.
 */
export async function buscarFichas(entidad: string, q: string, limite = 20): Promise<OpcionFicha[]> {
  await assertAdmin();
  const texto = q.trim();

  // Selector universal: se apoya en el índice de búsqueda, que ya cubre todas
  // las entidades y es lo que alimenta la paleta ⌘K.
  if (entidad === CUALQUIERA) {
    const filas = await db
      .select({
        entidad: s.searchIndex.entidadTipo,
        id: s.searchIndex.entidadId,
        label: s.searchIndex.titulo,
        detalle: s.searchIndex.subtitulo,
        imagenUrl: s.searchIndex.imagenUrl,
        estado: s.searchIndex.estadoPublicacion,
      })
      .from(s.searchIndex)
      .where(texto ? ilike(s.searchIndex.titulo, `%${texto}%`) : sql`true`)
      .orderBy(asc(s.searchIndex.titulo))
      .limit(limite);
    return filas.map((f) => ({ ...f, id: Number(f.id) }));
  }

  const info = infoDe(entidad);
  if (!info) return [];
  const c = cols(info.tabla);
  const sel: Record<string, PgColumn> = { id: c.id, label: c[info.label] };
  if (info.detalle) sel.detalle = c[info.detalle];
  if (info.imagen) sel.imagen = c[info.imagen];
  if (info.estado) sel.estado = c.estadoPublicacion;

  const filtros = [];
  // Se buscan también los borradores: vincular es trabajo de autor, no de lectura.
  if (info.papelera) filtros.push(isNull(c.eliminadoEn));
  if (texto) {
    const porNombre = ilike(c[info.label], `%${texto}%`);
    filtros.push(info.detalle ? or(porNombre, ilike(c[info.detalle], `%${texto}%`))! : porNombre);
  }

  const filas = (await db
    .select(sel)
    .from(info.tabla)
    .where(filtros.length ? and(...filtros) : undefined)
    .orderBy(asc(c[info.label]))
    .limit(limite)) as unknown as Record<string, unknown>[];

  return filas.map((f) => ({
    id: f.id as number,
    label: (f.label as string) ?? `#${f.id}`,
    detalle: (f.detalle as string) ?? null,
    imagenUrl: (f.imagen as string) ?? null,
    estado: (f.estado as string) ?? null,
    entidad,
  }));
}

/** Revalida las dos fichas implicadas, para que el espejo se vea al momento. */
async function revalidarLados(relId: string, lado: "a" | "b", ownerId: number, objetivoId?: number) {
  const rel = getRelacion(relId);
  if (!rel) return;
  const mia = lado === "a" ? rel.a.entidad : rel.b.entidad;
  const suya = lado === "a" ? rel.b.entidad : rel.a.entidad;
  for (const [entidad, id] of [
    [mia, ownerId],
    [suya, objetivoId],
  ] as const) {
    if (!id || entidad === CUALQUIERA) continue;
    const info = infoDe(entidad);
    if (info?.ruta) revalidatePath(`${info.ruta}/${id}`);
  }
}

export async function crearVinculo(
  relId: string,
  lado: "a" | "b",
  ownerId: number,
  destino: DestinoNuevo,
  campos: Campos = {},
): Promise<FilaVinculo[]> {
  await assertAdmin();
  await crear(relId, lado, ownerId, destino, campos);
  await revalidarLados(relId, lado, ownerId, destino.id);
  return leerFilas(relId, lado, ownerId);
}

/**
 * Vincula varias fichas de una vez. Es la operación que hace usable poblar la
 * wiki: con 210 personajes, añadirlos de uno en uno desde cada ficha no es
 * viable.
 */
export async function crearVinculosEnLote(
  relId: string,
  lado: "a" | "b",
  ownerId: number,
  destinos: DestinoNuevo[],
  campos: Campos = {},
): Promise<FilaVinculo[]> {
  await assertAdmin();
  for (const d of destinos) await crear(relId, lado, ownerId, d, campos);
  await revalidarLados(relId, lado, ownerId);
  return leerFilas(relId, lado, ownerId);
}

export async function actualizarVinculo(
  relId: string,
  lado: "a" | "b",
  ownerId: number,
  filaId: number,
  campos: Campos,
): Promise<FilaVinculo[]> {
  await assertAdmin();
  await actualizar(relId, filaId, campos);
  await revalidarLados(relId, lado, ownerId);
  return leerFilas(relId, lado, ownerId);
}

export async function borrarVinculo(
  relId: string,
  lado: "a" | "b",
  ownerId: number,
  filaId: number,
): Promise<FilaVinculo[]> {
  await assertAdmin();
  await borrar(relId, filaId);
  await revalidarLados(relId, lado, ownerId);
  return leerFilas(relId, lado, ownerId);
}

export async function reordenarVinculos(
  relId: string,
  lado: "a" | "b",
  ownerId: number,
  filaIds: number[],
): Promise<FilaVinculo[]> {
  await assertAdmin();
  await reordenar(relId, filaIds);
  await revalidarLados(relId, lado, ownerId);
  return leerFilas(relId, lado, ownerId);
}

/**
 * Crea una ficha nueva con sólo el nombre y la deja en borrador, para no tener
 * que abandonar lo que estás escribiendo cuando falta la ficha del otro lado.
 */
export async function crearBorradorRapido(entidad: string, nombre: string): Promise<OpcionFicha | null> {
  await assertAdmin();
  const limpio = nombre.trim();
  const info = infoDe(entidad);
  if (!limpio || !info) return null;
  // Las entidades sin estado de publicación propia (gremio) no se crean así.
  if (!info.estado) return null;

  const valores: Record<string, unknown> = { [info.label]: limpio, estadoPublicacion: "borrador" };
  const c = cols(info.tabla);
  const [fila] = (await db
    .insert(info.tabla)
    .values(valores as never)
    .returning({ id: c.id })) as unknown as { id: number }[];
  if (!fila) return null;

  return { id: fila.id, label: limpio, detalle: null, imagenUrl: null, estado: "borrador", entidad };
}

/** Fichas creadas al vuelo que siguen sin contenido, para no olvidarlas. */
export async function fichasEsbozadas(entidad: string): Promise<OpcionFicha[]> {
  await assertAdmin();
  const info = infoDe(entidad);
  if (!info?.estado) return [];
  const c = cols(info.tabla);
  const filtros = [eq(c.estadoPublicacion, "borrador")];
  if (info.papelera) filtros.push(isNull(c.eliminadoEn));
  const filas = (await db
    .select({ id: c.id, label: c[info.label] })
    .from(info.tabla)
    .where(and(...filtros))
    .orderBy(asc(c[info.label]))
    .limit(50)) as unknown as Record<string, unknown>[];
  return filas.map((f) => ({
    id: f.id as number,
    label: (f.label as string) ?? `#${f.id}`,
    detalle: null,
    imagenUrl: null,
    estado: "borrador",
    entidad,
  }));
}
