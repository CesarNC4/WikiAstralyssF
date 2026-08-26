"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";

/**
 * Notas privadas del autor y visibilidad por campo. Las dos tablas existían en
 * el esquema desde el principio pero nunca se llegaron a usar: no había pantalla
 * para escribir una nota ni para ocultar un campo.
 *
 * Nada de esto sale nunca al público. `assertAdmin` en cada export porque, al
 * ser un módulo "use server", todos son endpoints alcanzables por POST.
 */

/** Nota del autor sobre una ficha. Se guarda una por ficha, como un cuaderno. */
export async function leerNota(entidadTipo: string, entidadId: number): Promise<string> {
  await assertAdmin();
  if (!entidadId) return "";
  const [fila] = await db
    .select({ contenido: s.notaPrivada.contenido })
    .from(s.notaPrivada)
    .where(and(eq(s.notaPrivada.entidadTipo, entidadTipo), eq(s.notaPrivada.entidadId, entidadId)))
    .orderBy(asc(s.notaPrivada.id))
    .limit(1);
  return fila?.contenido ?? "";
}

export async function guardarNota(entidadTipo: string, entidadId: number, contenido: string): Promise<void> {
  await assertAdmin();
  if (!entidadId) return;
  const texto = contenido.trim();

  const [existente] = await db
    .select({ id: s.notaPrivada.id })
    .from(s.notaPrivada)
    .where(and(eq(s.notaPrivada.entidadTipo, entidadTipo), eq(s.notaPrivada.entidadId, entidadId)))
    .orderBy(asc(s.notaPrivada.id))
    .limit(1);

  // Vaciar la nota la borra: no tiene sentido guardar filas en blanco.
  if (texto === "") {
    if (existente) await db.delete(s.notaPrivada).where(eq(s.notaPrivada.id, existente.id));
    return;
  }

  if (existente) {
    await db
      .update(s.notaPrivada)
      .set({ contenido: texto, actualizadoEn: new Date() })
      .where(eq(s.notaPrivada.id, existente.id));
    return;
  }
  await db.insert(s.notaPrivada).values({ entidadTipo, entidadId, contenido: texto });
}

/** Campos que el autor ha marcado como ocultos en una ficha concreta. */
export async function leerCamposOcultos(entidadTipo: string, entidadId: number): Promise<string[]> {
  await assertAdmin();
  if (!entidadId) return [];
  const filas = await db
    .select({ campo: s.campoVisibilidad.campo })
    .from(s.campoVisibilidad)
    .where(
      and(
        eq(s.campoVisibilidad.entidadTipo, entidadTipo),
        eq(s.campoVisibilidad.entidadId, entidadId),
        eq(s.campoVisibilidad.visible, false),
      ),
    );
  return filas.map((f) => f.campo);
}

/**
 * Oculta o vuelve a mostrar un campo de una ficha. La ausencia de fila significa
 * visible, así que volver a mostrarlo simplemente borra la marca.
 */
export async function marcarCampo(
  entidadTipo: string,
  entidadId: number,
  campo: string,
  visible: boolean,
): Promise<string[]> {
  await assertAdmin();
  if (!entidadId || !campo) return [];

  const filtro = and(
    eq(s.campoVisibilidad.entidadTipo, entidadTipo),
    eq(s.campoVisibilidad.entidadId, entidadId),
    eq(s.campoVisibilidad.campo, campo),
  );

  if (visible) {
    await db.delete(s.campoVisibilidad).where(filtro);
  } else {
    const [ya] = await db.select({ id: s.campoVisibilidad.id }).from(s.campoVisibilidad).where(filtro).limit(1);
    if (ya) {
      await db.update(s.campoVisibilidad).set({ visible: false }).where(eq(s.campoVisibilidad.id, ya.id));
    } else {
      await db.insert(s.campoVisibilidad).values({ entidadTipo, entidadId, campo, visible: false });
    }
  }
  return leerCamposOcultos(entidadTipo, entidadId);
}

/** Fichas de una entidad que tienen nota, para señalarlas en la lista del admin. */
export async function fichasConNota(entidadTipo: string, ids: number[]): Promise<number[]> {
  await assertAdmin();
  if (ids.length === 0) return [];
  const filas = await db
    .select({ id: s.notaPrivada.entidadId })
    .from(s.notaPrivada)
    .where(and(eq(s.notaPrivada.entidadTipo, entidadTipo), inArray(s.notaPrivada.entidadId, ids)));
  return [...new Set(filas.map((f) => f.id))];
}
