"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { rolDe, type Fecha } from "@/lib/fechas";
import { escribirFecha } from "@/lib/queries/fechas";
import { FechaSchema } from "@/lib/validation/fecha";

/**
 * Escrituras de fechas de cualquier ficha (spec §13) y alta de eventos desde el
 * calendario del taller (§13, "Vista de calendario en el taller").
 *
 * `assertAdmin` en cada export: al ser "use server", son endpoints públicos.
 */

export type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Ruta pública de una ficha, para revalidarla. Null si no tiene ficha propia. */
function rutaFicha(entidad: string, id: number): { ruta: string; tipo?: "page" } | null {
  switch (entidad) {
    case "timeline":
      return null;
    case "gremio":
      return { ruta: "/gremio" };
    // La ficha de lore va por slug: se revalidan todas, que son pocas.
    case "lore":
      return { ruta: "/lore/[slug]", tipo: "page" };
    case "actos":
      return { ruta: "/capitulos/[id]/actos/[actoId]", tipo: "page" };
    case "demonios":
    case "personajes":
    case "naciones":
    case "organizaciones":
    case "familias":
    case "regiones":
    case "locaciones":
    case "artefactos":
    case "razas":
    case "bestias":
    case "misiones":
      return { ruta: `/${entidad}/${id}` };
    default:
      return null;
  }
}

function revalidarCronologia() {
  revalidatePath("/timeline", "layout");
  revalidatePath("/admin/taller/universo/calendario");
}

/** Guarda o borra (con null) la fecha de una ficha para uno de sus roles. */
export async function guardarFechaFicha(
  entidadTipo: string,
  entidadId: number,
  rol: string,
  fecha: Fecha | null,
  importante = false,
): Promise<Resultado> {
  await assertAdmin();
  if (!rolDe(entidadTipo, rol)) return { ok: false, error: "Esa ficha no tiene ese tipo de fecha." };
  if (!Number.isInteger(entidadId) || entidadId <= 0) return { ok: false, error: "Ficha no válida." };
  const f = fecha === null ? null : FechaSchema.safeParse(fecha);
  if (f && !f.success) return { ok: false, error: "Fecha inválida." };
  try {
    const error = await escribirFecha(db, { entidadTipo, entidadId, rol }, f ? f.data : null, importante);
    if (error) return { ok: false, error };
  } catch (e) {
    console.error("[guardarFechaFicha]", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
  revalidarCronologia();
  const r = rutaFicha(entidadTipo, entidadId);
  if (r) revalidatePath(r.ruta, r.tipo);
  return { ok: true, data: undefined };
}

const EventoNuevo = z.object({
  titulo: z.string().trim().min(1, "El evento necesita un título."),
  fecha: FechaSchema,
  importante: z.boolean(),
});

/**
 * Crea un evento de la cronología ya fechado, en borrador. Lo usa el calendario
 * del taller: se pulsa un día y se escribe qué pasó.
 */
export async function crearEventoEnFecha(entrada: z.input<typeof EventoNuevo>): Promise<Resultado<{ id: number }>> {
  await assertAdmin();
  const p = EventoNuevo.safeParse(entrada);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const { titulo, fecha, importante } = p.data;
  class Rechazo extends Error {}
  try {
    const id = await db.transaction(async (tx) => {
      const [ev] = await tx
        .insert(s.timelineEventos)
        .values({ titulo, estadoPublicacion: "borrador" })
        .returning({ id: s.timelineEventos.id });
      const error = await escribirFecha(tx, { entidadTipo: "timeline", entidadId: ev.id, rol: "principal" }, fecha, importante);
      if (error) throw new Rechazo(error);
      return ev.id;
    });
    revalidarCronologia();
    revalidatePath("/admin/timeline");
    return { ok: true, data: { id } };
  } catch (e) {
    if (e instanceof Rechazo) return { ok: false, error: e.message };
    console.error("[crearEventoEnFecha]", e);
    return { ok: false, error: "No se pudo crear el evento." };
  }
}
