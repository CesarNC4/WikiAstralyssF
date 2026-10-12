"use server";

import { and, eq, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { CAMPO_CATEGORIA, ESTILOS_LINEA } from "@/lib/relaciones/categorias";

/**
 * Escrituras de las categorías de relación (spec §11). Viven en `catalogos`:
 * la categoría es una opción de `relacion_categoria` y su aspecto va en `meta`.
 *
 * `assertAdmin` en cada export: al ser "use server", son endpoints públicos.
 */

export type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/admin/catalogos");
  revalidatePath("/admin/taller/universo/mapa");
}

const Aspecto = z.object({
  nombre: z.string().trim().min(1, "La categoría necesita un nombre."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido."),
  icono: z.string().trim().min(1).max(40),
  estilo: z.enum(ESTILOS_LINEA.map((e) => e.id) as [string, ...string[]]),
});

export async function crearCategoria(nombre: string): Promise<Resultado<{ id: number }>> {
  await assertAdmin();
  const n = nombre.trim();
  if (!n) return { ok: false, error: "La categoría necesita un nombre." };
  const [ya] = await db
    .select({ id: s.catalogos.id })
    .from(s.catalogos)
    .where(and(eq(s.catalogos.campo, CAMPO_CATEGORIA), eq(s.catalogos.valor, n)))
    .limit(1);
  if (ya) return { ok: false, error: `Ya hay una categoría «${n}».` };
  const [{ m }] = await db.select({ m: max(s.catalogos.orden) }).from(s.catalogos).where(eq(s.catalogos.campo, CAMPO_CATEGORIA));
  const [fila] = await db
    .insert(s.catalogos)
    .values({ campo: CAMPO_CATEGORIA, valor: n, orden: (m ?? -1) + 1, meta: { color: "#8b7bff", icono: "Circle", estilo: "continua" } })
    .returning({ id: s.catalogos.id });
  revalidar();
  return { ok: true, data: { id: fila.id } };
}

export async function guardarCategoria(id: number, aspecto: z.input<typeof Aspecto>): Promise<Resultado> {
  await assertAdmin();
  const p = Aspecto.safeParse(aspecto);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const [fila] = await db.select().from(s.catalogos).where(eq(s.catalogos.id, id)).limit(1);
  if (!fila || fila.campo !== CAMPO_CATEGORIA) return { ok: false, error: "La categoría ya no existe." };
  const { nombre, ...meta } = p.data;
  await db
    .update(s.catalogos)
    .set({ valor: nombre, meta: { ...(fila.meta ?? {}), ...meta } })
    .where(eq(s.catalogos.id, id));
  revalidar();
  return { ok: true, data: undefined };
}

/** Borra la categoría. Sus tipos quedan sin categoría, no se borran. */
export async function borrarCategoria(id: number): Promise<Resultado> {
  await assertAdmin();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update catalogos set meta = meta - 'categoriaId'
       where campo = 'tipo_relacion' and (meta->>'categoriaId')::int = ${id}`);
    await tx.delete(s.catalogos).where(and(eq(s.catalogos.id, id), eq(s.catalogos.campo, CAMPO_CATEGORIA)));
  });
  revalidar();
  return { ok: true, data: undefined };
}

/** Asigna un tipo de relación a una categoría (o lo deja sin ella con null). */
export async function asignarCategoria(tipoId: number, categoriaId: number | null): Promise<Resultado> {
  await assertAdmin();
  const [tipo] = await db.select().from(s.catalogos).where(eq(s.catalogos.id, tipoId)).limit(1);
  if (!tipo || tipo.campo !== "tipo_relacion") return { ok: false, error: "Ese tipo de relación ya no existe." };
  if (categoriaId != null) {
    const [cat] = await db.select({ campo: s.catalogos.campo }).from(s.catalogos).where(eq(s.catalogos.id, categoriaId)).limit(1);
    if (cat?.campo !== CAMPO_CATEGORIA) return { ok: false, error: "Esa categoría ya no existe." };
  }
  const meta = { ...(tipo.meta ?? {}) };
  if (categoriaId == null) delete meta.categoriaId;
  else meta.categoriaId = categoriaId;
  await db.update(s.catalogos).set({ meta }).where(eq(s.catalogos.id, tipoId));
  revalidar();
  return { ok: true, data: undefined };
}
