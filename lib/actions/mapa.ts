"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { naciones } from "@/db/schema/mundo";
import { regiones, locaciones } from "@/db/schema/mapa";
import { assertAdmin } from "@/lib/actions/auth";
import type { EstadoPublicacion, TipoLocacion } from "@/db/schema/enums";

type Punto = [number, number];

function revalidarMapa(extra?: string) {
  revalidatePath("/mapa");
  if (extra) revalidatePath(extra);
}

/** Calcula publicado_primera_vez_en respetando la primera publicación. */
function primeraVez(estado: EstadoPublicacion, previa: Date | null): Date | null {
  if (estado === "publicado") return previa ?? new Date();
  return previa ?? null;
}

// ── Naciones: solo geometría (el contenido se edita en su propio formulario) ──
export async function guardarNacionGeometria(input: {
  id: number;
  poligono: Punto[] | null;
  centroX: number | null;
  centroY: number | null;
  color: string | null;
}) {
  await assertAdmin();
  await db
    .update(naciones)
    .set({ poligono: input.poligono, centroX: input.centroX, centroY: input.centroY, color: input.color })
    .where(eq(naciones.id, input.id));
  revalidarMapa(`/naciones/${input.id}`);
}

// ── Regiones ──
export interface RegionInput {
  id?: number;
  nacionId: number | null;
  nombre: string;
  subtitulo?: string | null;
  descripcion?: string | null;
  historia?: string | null;
  poligono?: Punto[] | null;
  centroX?: number | null;
  centroY?: number | null;
  color?: string | null;
  estadoPublicacion?: EstadoPublicacion;
}

export async function guardarRegion(input: RegionInput): Promise<number> {
  await assertAdmin();
  const estado = input.estadoPublicacion ?? "borrador";
  const base = {
    nacionId: input.nacionId ?? null,
    nombre: input.nombre,
    subtitulo: input.subtitulo ?? null,
    descripcion: input.descripcion ?? null,
    historia: input.historia ?? null,
    poligono: input.poligono ?? null,
    centroX: input.centroX ?? null,
    centroY: input.centroY ?? null,
    color: input.color ?? null,
    estadoPublicacion: estado,
  };
  if (input.id) {
    const [prev] = await db.select({ ppv: regiones.publicadoPrimeraVezEn }).from(regiones).where(eq(regiones.id, input.id)).limit(1);
    await db.update(regiones).set({ ...base, publicadoPrimeraVezEn: primeraVez(estado, prev?.ppv ?? null) }).where(eq(regiones.id, input.id));
    revalidarMapa(`/regiones/${input.id}`);
    return input.id;
  }
  const [row] = await db.insert(regiones).values({ ...base, publicadoPrimeraVezEn: primeraVez(estado, null) }).returning({ id: regiones.id });
  revalidarMapa(`/regiones/${row.id}`);
  return row.id;
}

export async function eliminarRegion(id: number) {
  await assertAdmin();
  await db.update(regiones).set({ eliminadoEn: new Date() }).where(eq(regiones.id, id));
  revalidarMapa();
}

// ── Locaciones ──
export interface LocacionInput {
  id?: number;
  regionId: number | null;
  nacionId: number | null;
  tipo: TipoLocacion;
  nombre: string;
  subtitulo?: string | null;
  descripcion?: string | null;
  historia?: string | null;
  x?: number | null;
  y?: number | null;
  eventoId?: number | null;
  estadoPublicacion?: EstadoPublicacion;
}

export async function guardarLocacion(input: LocacionInput): Promise<number> {
  await assertAdmin();
  const estado = input.estadoPublicacion ?? "borrador";
  const base = {
    regionId: input.regionId ?? null,
    nacionId: input.nacionId ?? null,
    tipo: input.tipo,
    nombre: input.nombre,
    subtitulo: input.subtitulo ?? null,
    descripcion: input.descripcion ?? null,
    historia: input.historia ?? null,
    x: input.x ?? null,
    y: input.y ?? null,
    eventoId: input.eventoId ?? null,
    estadoPublicacion: estado,
  };
  if (input.id) {
    const [prev] = await db.select({ ppv: locaciones.publicadoPrimeraVezEn }).from(locaciones).where(eq(locaciones.id, input.id)).limit(1);
    await db.update(locaciones).set({ ...base, publicadoPrimeraVezEn: primeraVez(estado, prev?.ppv ?? null) }).where(eq(locaciones.id, input.id));
    revalidarMapa(`/locaciones/${input.id}`);
    return input.id;
  }
  const [row] = await db.insert(locaciones).values({ ...base, publicadoPrimeraVezEn: primeraVez(estado, null) }).returning({ id: locaciones.id });
  revalidarMapa(`/locaciones/${row.id}`);
  return row.id;
}

export async function eliminarLocacion(id: number) {
  await assertAdmin();
  await db.update(locaciones).set({ eliminadoEn: new Date() }).where(eq(locaciones.id, id));
  revalidarMapa();
}
