"use server";

import { revalidatePath } from "next/cache";
import { eq, getTableColumns } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { actos, capitulos, discordCanal } from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { canalSugerido, canalesDelServidor, enviarPrueba, type CanalDiscord } from "@/lib/discord";
import { ES_TIPO_CON_AVISO } from "@/lib/discord-tipos";
import { infoDe } from "@/lib/relaciones/tablas";

export interface OpcionesAviso {
  /** Discord configurado y respondiendo. */
  activo: boolean;
  canales: CanalDiscord[];
  /** El canal que se ofrece: el de la ficha si ya se avisó de ella, si no el de su tipo. */
  sugerido: string | null;
  /** La ficha ya se publicó alguna vez: lo que toca es avisar de un cambio, no de un estreno. */
  yaPublicada: boolean;
  /** Por qué no se verá aunque se publique (un acto de un capítulo sin publicar); entonces no avisa. */
  noSeVe: string | null;
}

/** Lo que necesita el selector de aviso de un formulario. */
export async function opcionesAviso(tipo: string, id?: number | null): Promise<OpcionesAviso> {
  await assertAdmin();
  const canales = await canalesDelServidor();
  let yaPublicada = false;
  const info = infoDe(tipo);
  if (id && info) {
    const c = getTableColumns(info.tabla) as unknown as Record<string, PgColumn>;
    if (c.publicadoPrimeraVezEn) {
      const [f] = (await db.select({ ppv: c.publicadoPrimeraVezEn }).from(info.tabla).where(eq(c.id, id)).limit(1)) as { ppv: Date | null }[];
      yaPublicada = Boolean(f?.ppv);
    } else {
      // Sin estado de publicación (el gremio): siempre está a la vista.
      yaPublicada = true;
    }
  }
  const sugerido = canales ? await canalSugerido(tipo, id) : null;
  let noSeVe: string | null = null;
  if (tipo === "actos" && id) {
    const [f] = await db
      .select({ estado: capitulos.estadoPublicacion })
      .from(actos)
      .leftJoin(capitulos, eq(capitulos.id, actos.capituloId))
      .where(eq(actos.id, id))
      .limit(1);
    if (f?.estado !== "publicado") noSeVe = "Su capítulo no está publicado: el acto no se verá ni se avisará hasta que lo esté.";
  }
  return {
    noSeVe,
    activo: canales !== null,
    canales: canales ?? [],
    // Un canal que ya no existe o donde el bot no puede escribir no se ofrece.
    sugerido: sugerido && canales?.some((c) => c.id === sugerido) ? sugerido : null,
    yaPublicada,
  };
}

/**
 * Guarda el canal por defecto de cada tipo de ficha. `null` = ese tipo no avisa, y
 * se guarda como `""` para distinguirlo de un tipo que aún no se ha configurado.
 */
export async function guardarCanalesPorDefecto(mapa: Record<string, string | null>): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  const canales = await canalesDelServidor();
  if (!canales) return { ok: false, error: "No se pudo hablar con Discord. Inténtalo de nuevo." };
  const validos = new Set(canales.map((c) => c.id));
  const poner: { entidadTipo: string; canalId: string }[] = [];
  for (const [tipo, canal] of Object.entries(mapa)) {
    if (!ES_TIPO_CON_AVISO.has(tipo)) continue;
    if (canal === null || canal === "") poner.push({ entidadTipo: tipo, canalId: "" });
    else if (validos.has(canal)) poner.push({ entidadTipo: tipo, canalId: canal });
    else return { ok: false, error: "Uno de los canales ya no existe o el bot no puede escribir en él." };
  }
  await db.transaction(async (tx) => {
    for (const p of poner) {
      await tx
        .insert(discordCanal)
        .values({ ...p, actualizadoEn: new Date() })
        .onConflictDoUpdate({ target: discordCanal.entidadTipo, set: { canalId: p.canalId, actualizadoEn: new Date() } });
    }
  });
  revalidatePath("/admin/discord");
  return { ok: true };
}

/** Manda un mensaje de prueba al canal, para ver que el bot escribe ahí. */
export async function probarCanal(canal: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  const canales = await canalesDelServidor();
  if (!canales?.some((c) => c.id === canal)) return { ok: false, error: "El bot no puede escribir en ese canal." };
  try {
    await enviarPrueba(canal);
    revalidatePath("/admin/discord");
    return { ok: true };
  } catch (e) {
    console.error("[probarCanal]", e);
    return { ok: false, error: "Discord no aceptó el mensaje." };
  }
}
