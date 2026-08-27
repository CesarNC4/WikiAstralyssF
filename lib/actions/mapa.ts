"use server";

import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { naciones } from "@/db/schema/mundo";
import { regiones, locaciones } from "@/db/schema/mapa";
import { assertAdmin } from "@/lib/actions/auth";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { contenedorDePoligono, contenedorDePunto, type Contenedor } from "@/lib/mapa";

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

// ── Contención automática ───────────────────────────────────────────────────
/**
 * Quién está dentro de quién, calculado a partir de la geometría.
 *
 * Los polígonos ya se guardan como pares 0..1 en `jsonb`, así que esto se
 * resuelve en JavaScript: no hace falta PostGIS ni una extensión en la base.
 *
 * La regla es no adivinar. Si algo cae a caballo entre dos contenedores o fuera
 * de todos, se deja sin asignar y se devuelve el aviso para que el panel lo
 * marque; y una asignación hecha a mano nunca se pisa, porque puede ser
 * deliberada (un enclave, un territorio en disputa).
 */
export interface AvisoContencion {
  /** Qué se detectó, para enseñarlo en el panel. */
  mensaje: string | null;
  nacionId: number | null;
  regionId?: number | null;
}

async function nacionesConPoligono(): Promise<Contenedor[]> {
  const filas = await db
    .select({ id: naciones.id, nombre: naciones.nombre, poligono: naciones.poligono })
    .from(naciones)
    .where(isNull(naciones.eliminadoEn));
  return filas.filter((n) => (n.poligono?.length ?? 0) >= 3);
}

async function regionesConPoligono(excluirId?: number): Promise<Contenedor[]> {
  const filas = await db
    .select({ id: regiones.id, nombre: regiones.nombre, poligono: regiones.poligono })
    .from(regiones)
    .where(isNull(regiones.eliminadoEn));
  return filas.filter((r) => (r.poligono?.length ?? 0) >= 3 && r.id !== excluirId);
}

/**
 * En qué nación cae una región. Solo se decide si una nación contiene la mayor
 * parte del polígono; rozar una frontera no cuenta.
 */
export async function detectarNacionDeRegion(
  poligono: Punto[] | null,
  regionId?: number,
): Promise<AvisoContencion> {
  if (!poligono || poligono.length < 3) return { mensaje: null, nacionId: null };

  const { contenedorId, solapa } = contenedorDePoligono(poligono, await nacionesConPoligono());
  void regionId;

  if (contenedorId === null) {
    return {
      nacionId: null,
      mensaje: solapa.length
        ? `Esta región queda a caballo entre ${solapa.join(" y ")}. Asigna la nación a mano.`
        : "Esta región no cae dentro de ninguna nación dibujada.",
    };
  }
  return {
    nacionId: contenedorId,
    mensaje: solapa.length ? `Asignada, pero también toca ${solapa.slice(1).join(" y ")}.` : null,
  };
}

/**
 * En qué región y nación cae una locación. La región manda: si el punto está en
 * una región, la nación se hereda de ella, que es lo coherente aunque los
 * polígonos no encajen al píxel.
 */
export async function detectarLugarDeLocacion(
  x: number | null,
  y: number | null,
  locacionId?: number,
): Promise<AvisoContencion> {
  void locacionId;
  if (x == null || y == null) return { mensaje: null, nacionId: null, regionId: null };
  const punto: Punto = [x, y];

  const enRegion = contenedorDePunto(punto, await regionesConPoligono());
  if (enRegion.contenedorId !== null) {
    const [reg] = await db
      .select({ nacionId: regiones.nacionId })
      .from(regiones)
      .where(eq(regiones.id, enRegion.contenedorId))
      .limit(1);
    return {
      regionId: enRegion.contenedorId,
      nacionId: reg?.nacionId ?? null,
      mensaje: enRegion.solapa.length
        ? `El punto cae en varias regiones (${enRegion.solapa.join(", ")}); se usó la primera.`
        : null,
    };
  }

  const enNacion = contenedorDePunto(punto, await nacionesConPoligono());
  return {
    regionId: null,
    nacionId: enNacion.contenedorId,
    mensaje:
      enNacion.contenedorId === null
        ? "Este punto no cae dentro de ninguna región ni nación dibujada."
        : null,
  };
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

  // Si no la has asignado a mano, la nación sale de la geometría. Una asignación
  // manual nunca se pisa: puede ser deliberada (un enclave, un territorio en
  // disputa) y adivinar por encima sería peor que no adivinar.
  let nacionId = input.nacionId ?? null;
  if (nacionId === null) {
    const det = await detectarNacionDeRegion(input.poligono ?? null, input.id);
    nacionId = det.nacionId;
  }

  const base = {
    nacionId,
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
  /** Del catálogo `locacion_tipo`; antes era un enum fijo de cuatro valores. */
  tipo: string | null;
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

  // Igual que con las regiones: lo que no hayas puesto tú se deduce del punto.
  let regionId = input.regionId ?? null;
  let nacionId = input.nacionId ?? null;
  if (regionId === null && nacionId === null) {
    const det = await detectarLugarDeLocacion(input.x ?? null, input.y ?? null, input.id);
    regionId = det.regionId ?? null;
    nacionId = det.nacionId;
  }

  const base = {
    regionId,
    nacionId,
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
