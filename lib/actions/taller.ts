"use server";

import { and, asc, count, eq, inArray, isNull, max, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { notificarNuevaPublicacion } from "@/lib/discord";
import type { Fecha } from "@/lib/fechas";
import { escribirFecha } from "@/lib/queries/fechas";
import { contarFragmentosConFecha, normalizarOrdenActos, recalcularFechaActo, renumerarCapitulos, type Ejecutor } from "@/lib/queries/narrativa";
import { getFragmentosActo, type FragmentosActo } from "@/lib/queries/taller";
import { FechaSchema } from "@/lib/validation/fecha";

/**
 * Escrituras del taller del autor: plantillas de estructura, capítulos y actos
 * (spec §3, §4 y §7). Las reglas que importan:
 *
 *  - Todo capítulo nuevo lleva plantilla (la predeterminada si no se elige).
 *  - Todo acto de un capítulo con plantilla tiene una fase **de esa plantilla**.
 *  - Cambiar la plantilla de un capítulo manda todos sus actos a la primera fase.
 *  - No se borra una fase ni una plantilla en uso.
 *  - El número de los capítulos y de los actos lo pone el servidor.
 *
 * `assertAdmin` en cada export: al ser un módulo "use server", todos son
 * endpoints alcanzables por POST directo.
 */

export type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Error pensado para enseñarse tal cual: aborta la transacción con un motivo legible. */
class Rechazo extends Error {}

/** Ejecuta una escritura y traduce los rechazos a un resultado; el resto se registra. */
async function intentar<T>(donde: string, fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof Rechazo) return { ok: false, error: e.message };
    console.error(`[taller/${donde}]`, e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}

function revalidarNarrativa(capituloId?: number) {
  revalidatePath("/admin/taller", "layout");
  revalidatePath("/capitulos");
  // Capítulos y actos también son sucesos de la cronología (§14).
  revalidatePath("/timeline", "layout");
  if (capituloId) revalidatePath(`/capitulos/${capituloId}`);
}

const ESTADOS = ["borrador", "publicado", "oculto"] as const;
const texto = z.string().trim();
const textoOpcional = z.string().trim().nullable().optional();

// ── Plantillas de estructura ───────────────────────────────────────────────

const PlantillaEntrada = z.object({
  id: z.number().int().nullable(),
  nombre: texto.min(1, "La plantilla necesita un nombre."),
  descripcion: textoOpcional,
  fases: z
    .array(
      z.object({
        id: z.number().int().nullable(),
        nombre: texto.min(1, "Cada fase necesita un nombre."),
        abreviatura: textoOpcional,
        color: textoOpcional,
        guia: textoOpcional,
      }),
    )
    .min(1, "Una plantilla necesita al menos una fase."),
});

export type PlantillaEntrada = z.input<typeof PlantillaEntrada>;

/**
 * Crea o actualiza una plantilla con sus fases, en el orden recibido. Quitar
 * una fase que usa algún acto se rechaza (§7). La primera plantilla que se crea
 * queda como predeterminada, porque sin ninguna no se podría crear un capítulo.
 */
export async function guardarPlantilla(entrada: PlantillaEntrada): Promise<Resultado<{ id: number }>> {
  await assertAdmin();
  const p = PlantillaEntrada.safeParse(entrada);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const d = p.data;

  const r = await intentar("guardarPlantilla", () =>
    db.transaction(async (tx) => {
      let id = d.id;
      if (id == null) {
        const [{ hay }] = await tx.select({ hay: count() }).from(s.estructuraPlantilla).where(eq(s.estructuraPlantilla.predeterminada, true));
        const [{ ultimo }] = await tx.select({ ultimo: max(s.estructuraPlantilla.orden) }).from(s.estructuraPlantilla);
        const [nueva] = await tx
          .insert(s.estructuraPlantilla)
          .values({ nombre: d.nombre, descripcion: d.descripcion ?? null, predeterminada: hay === 0, orden: (ultimo ?? -1) + 1 })
          .returning({ id: s.estructuraPlantilla.id });
        id = nueva.id;
      } else {
        const hecho = await tx
          .update(s.estructuraPlantilla)
          .set({ nombre: d.nombre, descripcion: d.descripcion ?? null })
          .where(eq(s.estructuraPlantilla.id, id))
          .returning({ id: s.estructuraPlantilla.id });
        if (hecho.length === 0) throw new Rechazo("La plantilla ya no existe.");
      }

      const previas = await tx.select().from(s.estructuraFase).where(eq(s.estructuraFase.plantillaId, id));
      const quedan = new Set(d.fases.map((f) => f.id).filter((x): x is number => x != null));
      const quitadas = previas.filter((f) => !quedan.has(f.id));
      if (quitadas.length) {
        const usadas = await tx
          .select({ faseId: s.actos.faseId, n: count() })
          .from(s.actos)
          .where(inArray(s.actos.faseId, quitadas.map((f) => f.id)))
          .groupBy(s.actos.faseId);
        if (usadas.length) {
          const nombres = usadas.map((u) => `«${quitadas.find((f) => f.id === u.faseId)?.nombre}» (${u.n} actos)`);
          throw new Rechazo(`No se puede quitar una fase en uso: ${nombres.join(", ")}. Mueve antes sus actos.`);
        }
        await tx.delete(s.estructuraFase).where(inArray(s.estructuraFase.id, quitadas.map((f) => f.id)));
      }

      for (const [orden, f] of d.fases.entries()) {
        const fila = { orden, nombre: f.nombre, abreviatura: f.abreviatura || null, color: f.color || null, guia: f.guia || null };
        if (f.id != null && previas.some((x) => x.id === f.id)) {
          await tx.update(s.estructuraFase).set(fila).where(eq(s.estructuraFase.id, f.id));
        } else {
          await tx.insert(s.estructuraFase).values({ ...fila, plantillaId: id });
        }
      }
      return { id };
    }),
  );
  if (r.ok) revalidarNarrativa();
  return r;
}

/** La plantilla que viene preseleccionada al crear un capítulo. */
export async function marcarPlantillaPredeterminada(id: number): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("marcarPredeterminada", () =>
    db.transaction(async (tx) => {
      // Primero se quita la anterior: el índice único admite como mucho una.
      await tx.update(s.estructuraPlantilla).set({ predeterminada: false }).where(ne(s.estructuraPlantilla.id, id));
      const hecho = await tx
        .update(s.estructuraPlantilla)
        .set({ predeterminada: true })
        .where(eq(s.estructuraPlantilla.id, id))
        .returning({ id: s.estructuraPlantilla.id });
      if (hecho.length === 0) throw new Rechazo("La plantilla ya no existe.");
      return undefined;
    }),
  );
  if (r.ok) revalidarNarrativa();
  return r;
}

/** Borra una plantilla que no use ningún capítulo (ni siquiera uno en la papelera). */
export async function borrarPlantilla(id: number): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("borrarPlantilla", () =>
    db.transaction(async (tx) => {
      const [{ n }] = await tx.select({ n: count() }).from(s.capitulos).where(eq(s.capitulos.plantillaId, id));
      if (n > 0) throw new Rechazo(`La usan ${n} capítulos: cámbiales antes la plantilla.`);
      const [p] = await tx.select({ pred: s.estructuraPlantilla.predeterminada }).from(s.estructuraPlantilla).where(eq(s.estructuraPlantilla.id, id));
      if (!p) throw new Rechazo("La plantilla ya no existe.");
      // Las fases caen con ella (on delete cascade); ningún acto las usa porque
      // ningún capítulo usa la plantilla.
      await tx.delete(s.estructuraPlantilla).where(eq(s.estructuraPlantilla.id, id));
      // Si era la predeterminada, hereda la marca la primera que quede.
      if (p.pred) {
        const [otra] = await tx.select({ id: s.estructuraPlantilla.id }).from(s.estructuraPlantilla).orderBy(asc(s.estructuraPlantilla.orden)).limit(1);
        if (otra) await tx.update(s.estructuraPlantilla).set({ predeterminada: true }).where(eq(s.estructuraPlantilla.id, otra.id));
      }
      return undefined;
    }),
  );
  if (r.ok) revalidarNarrativa();
  return r;
}

/** Primera fase (por orden) de una plantilla. */
async function primeraFase(ex: Ejecutor, plantillaId: number): Promise<number> {
  const [f] = await ex
    .select({ id: s.estructuraFase.id })
    .from(s.estructuraFase)
    .where(eq(s.estructuraFase.plantillaId, plantillaId))
    .orderBy(asc(s.estructuraFase.orden), asc(s.estructuraFase.id))
    .limit(1);
  if (!f) throw new Rechazo("La plantilla no tiene fases.");
  return f.id;
}

/** Comprueba que una fase pertenece a la plantilla del capítulo. */
async function exigirFaseDe(ex: Ejecutor, faseId: number, plantillaId: number): Promise<void> {
  const [f] = await ex.select({ plantillaId: s.estructuraFase.plantillaId }).from(s.estructuraFase).where(eq(s.estructuraFase.id, faseId));
  if (!f || f.plantillaId !== plantillaId) throw new Rechazo("Esa fase no es de la plantilla del capítulo.");
}

// ── Capítulos ──────────────────────────────────────────────────────────────

const CapituloNuevo = z.object({
  titulo: texto.min(1, "El capítulo necesita un título."),
  libro: textoOpcional,
  tipo: textoOpcional,
  plantillaId: z.number().int().nullable().optional(),
});

/** Crea un capítulo en borrador, al final de su libro. */
export async function crearCapitulo(entrada: z.input<typeof CapituloNuevo>): Promise<Resultado<{ id: number }>> {
  await assertAdmin();
  const p = CapituloNuevo.safeParse(entrada);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const d = p.data;

  const r = await intentar("crearCapitulo", () =>
    db.transaction(async (tx) => {
      let plantillaId = d.plantillaId ?? null;
      if (plantillaId == null) {
        const [pred] = await tx.select({ id: s.estructuraPlantilla.id }).from(s.estructuraPlantilla).where(eq(s.estructuraPlantilla.predeterminada, true));
        if (!pred) throw new Rechazo("Crea antes una plantilla de estructura: todo capítulo necesita una.");
        plantillaId = pred.id;
      }
      const libro = d.libro || null;
      const [{ ultimo }] = await tx
        .select({ ultimo: max(s.capitulos.orden) })
        .from(s.capitulos)
        .where(and(libro ? eq(s.capitulos.libro, libro) : isNull(s.capitulos.libro), isNull(s.capitulos.eliminadoEn)));
      const [nuevo] = await tx
        .insert(s.capitulos)
        .values({
          titulo: d.titulo,
          libro,
          tipo: d.tipo || null,
          plantillaId,
          orden: (ultimo ?? -1) + 1,
          // Provisional: renumerarCapitulos lo reescribe enseguida.
          numero: "",
        })
        .returning({ id: s.capitulos.id });
      await renumerarCapitulos(tx);
      return { id: nuevo.id };
    }),
  );
  if (r.ok) revalidarNarrativa(r.data.id);
  return r;
}

const CapituloCambios = z
  .object({
    titulo: texto.min(1, "El capítulo necesita un título."),
    libro: textoOpcional,
    tipo: textoOpcional,
    tipoTemporal: textoOpcional,
    marcoNarrativo: textoOpcional,
    narrador: textoOpcional,
    narradorPersonajeId: z.number().int().nullable(),
    narradorTipo: textoOpcional,
    paraleloACapituloId: z.number().int().nullable(),
    descripcion: textoOpcional,
    discordUrl: textoOpcional,
    notasPrivadas: textoOpcional,
    estadoPublicacion: z.enum(ESTADOS),
  })
  .partial();

/**
 * Guarda los datos propios de un capítulo. Cambiar el libro lo manda al final
 * del libro nuevo; cambiar el libro o el tipo renumera. La plantilla tiene su
 * propia acción porque mueve los actos.
 */
export async function guardarCapitulo(id: number, cambios: z.input<typeof CapituloCambios>): Promise<Resultado> {
  await assertAdmin();
  const p = CapituloCambios.safeParse(cambios);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const d = p.data;
  if (d.paraleloACapituloId === id) return { ok: false, error: "Un capítulo no puede ser paralelo a sí mismo." };

  const r = await intentar("guardarCapitulo", () =>
    db.transaction(async (tx) => {
      const [antes] = await tx.select().from(s.capitulos).where(eq(s.capitulos.id, id));
      if (!antes) throw new Rechazo("El capítulo ya no existe.");

      const set: Partial<typeof s.capitulos.$inferInsert> = {};
      for (const [k, v] of Object.entries(d)) (set as Record<string, unknown>)[k] = v === "" ? null : v;

      const libroNuevo = d.libro !== undefined ? d.libro || null : antes.libro;
      if (libroNuevo !== antes.libro) {
        const [{ ultimo }] = await tx
          .select({ ultimo: max(s.capitulos.orden) })
          .from(s.capitulos)
          .where(and(libroNuevo ? eq(s.capitulos.libro, libroNuevo) : isNull(s.capitulos.libro), isNull(s.capitulos.eliminadoEn)));
        set.orden = (ultimo ?? -1) + 1;
      }
      // Primera publicación: se apunta la fecha y, al terminar, se avisa a Discord.
      let aviso: { titulo: string; descripcion: string | null } | null = null;
      if (d.estadoPublicacion === "publicado" && !antes.publicadoPrimeraVezEn) {
        set.publicadoPrimeraVezEn = new Date();
        aviso = { titulo: d.titulo ?? antes.titulo, descripcion: d.descripcion ?? antes.descripcion };
      }

      if (Object.keys(set).length) await tx.update(s.capitulos).set(set).where(eq(s.capitulos.id, id));
      if (libroNuevo !== antes.libro || (d.tipo !== undefined && (d.tipo || null) !== antes.tipo)) await renumerarCapitulos(tx);
      return aviso;
    }),
  );
  if (!r.ok) return r;
  revalidarNarrativa(id);
  if (r.data) await notificarNuevaPublicacion({ tipo: "capitulos", idOrSlug: id, nombre: r.data.titulo, descripcion: r.data.descripcion });
  return { ok: true, data: undefined };
}

/** Cambia la plantilla de un capítulo: todos sus actos pasan a la primera fase (§7). */
export async function cambiarPlantillaCapitulo(id: number, plantillaId: number): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("cambiarPlantilla", () =>
    db.transaction(async (tx) => {
      const fase = await primeraFase(tx, plantillaId);
      const hecho = await tx.update(s.capitulos).set({ plantillaId }).where(eq(s.capitulos.id, id)).returning({ id: s.capitulos.id });
      if (hecho.length === 0) throw new Rechazo("El capítulo ya no existe.");
      await tx.update(s.actos).set({ faseId: fase }).where(eq(s.actos.capituloId, id));
      return undefined;
    }),
  );
  if (r.ok) revalidarNarrativa(id);
  return r;
}

/** Fija el orden de los capítulos de un libro con la lista de ids recibida. */
export async function reordenarCapitulos(libro: string | null, ids: number[]): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("reordenarCapitulos", () =>
    db.transaction(async (tx) => {
      const delLibro = await tx
        .select({ id: s.capitulos.id })
        .from(s.capitulos)
        .where(and(libro ? eq(s.capitulos.libro, libro) : isNull(s.capitulos.libro), isNull(s.capitulos.eliminadoEn)));
      const validos = new Set(delLibro.map((c) => c.id));
      if (ids.length !== validos.size || ids.some((x) => !validos.has(x)))
        throw new Rechazo("La lista de capítulos no coincide con la del libro. Recarga la página.");
      for (const [orden, cid] of ids.entries()) await tx.update(s.capitulos).set({ orden }).where(eq(s.capitulos.id, cid));
      await renumerarCapitulos(tx);
      return undefined;
    }),
  );
  if (r.ok) revalidarNarrativa();
  return r;
}

/** Manda un capítulo a la papelera. Sus actos se quedan con él. */
export async function borrarCapitulo(id: number): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("borrarCapitulo", () =>
    db.transaction(async (tx) => {
      await tx.update(s.capitulos).set({ eliminadoEn: new Date() }).where(eq(s.capitulos.id, id));
      await renumerarCapitulos(tx);
      return undefined;
    }),
  );
  if (r.ok) revalidarNarrativa(id);
  return r;
}

// ── Actos ──────────────────────────────────────────────────────────────────

/** Plantilla del capítulo, o null en la excepción temporal (capítulos anteriores al taller). */
async function plantillaDe(ex: Ejecutor, capituloId: number): Promise<number | null> {
  const [c] = await ex
    .select({ plantillaId: s.capitulos.plantillaId })
    .from(s.capitulos)
    .where(and(eq(s.capitulos.id, capituloId), isNull(s.capitulos.eliminadoEn)));
  if (!c) throw new Rechazo("El capítulo ya no existe.");
  return c.plantillaId;
}

const ActoNuevo = z.object({
  capituloId: z.number().int(),
  nombre: texto.min(1, "El acto necesita un nombre."),
  faseId: z.number().int().nullable(),
});

/** Crea un acto en borrador al final de su capítulo. La fase se elige al crearlo (§7). */
export async function crearActo(entrada: z.input<typeof ActoNuevo>): Promise<Resultado<{ id: number }>> {
  await assertAdmin();
  const p = ActoNuevo.safeParse(entrada);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const d = p.data;

  const r = await intentar("crearActo", () =>
    db.transaction(async (tx) => {
      const plantilla = await plantillaDe(tx, d.capituloId);
      if (plantilla != null) {
        if (d.faseId == null) throw new Rechazo("Elige la fase del acto.");
        await exigirFaseDe(tx, d.faseId, plantilla);
      }
      const [{ ultimo }] = await tx
        .select({ ultimo: max(s.actos.numeroOrden) })
        .from(s.actos)
        .where(and(eq(s.actos.capituloId, d.capituloId), isNull(s.actos.eliminadoEn)));
      const [nuevo] = await tx
        .insert(s.actos)
        .values({ capituloId: d.capituloId, nombre: d.nombre, faseId: plantilla != null ? d.faseId : null, numeroOrden: (ultimo ?? -1) + 1 })
        .returning({ id: s.actos.id });
      return { id: nuevo.id };
    }),
  );
  if (r.ok) revalidarNarrativa(d.capituloId);
  return r;
}

const ActoCambios = z
  .object({
    nombre: texto.min(1, "El acto necesita un nombre."),
    descripcion: textoOpcional,
    estado: textoOpcional,
    notasPrivadas: textoOpcional,
    discordUrl: textoOpcional,
    estadoPublicacion: z.enum(ESTADOS),
    /** Fecha de inicio y fin del acto; null la borra, ausente no la toca. */
    fecha: FechaSchema.nullable(),
    /** Si su fecha sale en la cronología destacada (§14). Va con `fecha`. */
    importante: z.boolean(),
  })
  .partial();

/**
 * Guarda los datos propios de un acto y su fecha. Las relaciones (POV,
 * personajes, lugares, arcos, canciones) van por el motor del registro
 * (`lib/actions/vinculos.ts`), como en el resto de fichas.
 */
export async function guardarActo(id: number, cambios: z.input<typeof ActoCambios>): Promise<Resultado> {
  await assertAdmin();
  const p = ActoCambios.safeParse(cambios);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const { fecha, importante, ...d } = p.data;

  const r = await intentar("guardarActo", () =>
    db.transaction(async (tx) => {
      const [antes] = await tx.select().from(s.actos).where(eq(s.actos.id, id));
      if (!antes) throw new Rechazo("El acto ya no existe.");

      const set: Partial<typeof s.actos.$inferInsert> = {};
      for (const [k, v] of Object.entries(d)) (set as Record<string, unknown>)[k] = v === "" ? null : v;
      if (d.estadoPublicacion === "publicado" && !antes.publicadoPrimeraVezEn) set.publicadoPrimeraVezEn = new Date();
      if (Object.keys(set).length) await tx.update(s.actos).set(set).where(eq(s.actos.id, id));

      // Con fragmentos fechados la fecha del acto se calcula de ellos: la del
      // formulario se ignora y solo se guarda si es importante.
      if (await contarFragmentosConFecha(tx, id)) {
        if (importante !== undefined)
          await tx
            .update(s.fechaLore)
            .set({ importante })
            .where(and(eq(s.fechaLore.entidadTipo, "actos"), eq(s.fechaLore.entidadId, id), eq(s.fechaLore.rol, "principal")));
      } else if (fecha !== undefined) {
        const error = await escribirFecha(tx, { entidadTipo: "actos", entidadId: id, rol: "principal" }, fecha as Fecha | null, importante ?? false);
        if (error) throw new Rechazo(error);
      }
      return antes.capituloId;
    }),
  );
  if (r.ok && r.data != null) revalidatePath(`/capitulos/${r.data}/actos/${id}`);
  return conCapitulo(r);
}

/** Revalida el capítulo devuelto por la transacción y no lo expone al cliente. */
function conCapitulo(r: Resultado<number | null>): Resultado {
  if (!r.ok) return r;
  revalidarNarrativa(r.data ?? undefined);
  return { ok: true, data: undefined };
}

/** Coloca un acto en otra fase de la plantilla de su capítulo (tablero de §7). */
export async function asignarFase(actoId: number, faseId: number): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("asignarFase", () =>
    db.transaction(async (tx) => {
      const [a] = await tx.select({ capituloId: s.actos.capituloId }).from(s.actos).where(eq(s.actos.id, actoId));
      if (!a?.capituloId) throw new Rechazo("El acto ya no existe.");
      const plantilla = await plantillaDe(tx, a.capituloId);
      if (plantilla == null) throw new Rechazo("El capítulo aún no tiene plantilla: elígela primero.");
      await exigirFaseDe(tx, faseId, plantilla);
      await tx.update(s.actos).set({ faseId }).where(eq(s.actos.id, actoId));
      return a.capituloId;
    }),
  );
  return conCapitulo(r);
}

/**
 * Mueve un acto a otro capítulo (o a otra posición del mismo). Si el capítulo
 * de destino usa otra plantilla, el acto cae en su primera fase (§6).
 */
export async function moverActo(actoId: number, capituloDestino: number, posicion: number): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("moverActo", () =>
    db.transaction(async (tx) => {
      const [a] = await tx.select({ capituloId: s.actos.capituloId, faseId: s.actos.faseId }).from(s.actos).where(eq(s.actos.id, actoId));
      if (!a) throw new Rechazo("El acto ya no existe.");

      let faseId = a.faseId;
      if (a.capituloId !== capituloDestino) {
        const destino = await plantillaDe(tx, capituloDestino);
        const desde = a.capituloId != null ? await plantillaDe(tx, a.capituloId).catch(() => null) : null;
        if (destino == null) faseId = null;
        else if (destino !== desde || faseId == null) faseId = await primeraFase(tx, destino);
      }

      // Hueco en la posición pedida y el acto dentro.
      const hermanos = await tx
        .select({ id: s.actos.id })
        .from(s.actos)
        .where(and(eq(s.actos.capituloId, capituloDestino), isNull(s.actos.eliminadoEn), ne(s.actos.id, actoId)))
        .orderBy(asc(s.actos.numeroOrden), asc(s.actos.id));
      const lista = hermanos.map((h) => h.id);
      lista.splice(Math.max(0, Math.min(posicion, lista.length)), 0, actoId);
      await tx.update(s.actos).set({ capituloId: capituloDestino, faseId }).where(eq(s.actos.id, actoId));
      for (const [orden, aid] of lista.entries()) await tx.update(s.actos).set({ numeroOrden: orden }).where(eq(s.actos.id, aid));
      if (a.capituloId != null && a.capituloId !== capituloDestino) await normalizarOrdenActos(tx, a.capituloId);
      return a.capituloId;
    }),
  );
  if (!r.ok) return r;
  revalidarNarrativa(capituloDestino);
  if (r.data && r.data !== capituloDestino) revalidatePath(`/capitulos/${r.data}`);
  return { ok: true, data: undefined };
}

/** Manda un acto a la papelera y cierra el hueco en la numeración. */
export async function borrarActo(id: number): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("borrarActo", () =>
    db.transaction(async (tx) => {
      const [a] = await tx.update(s.actos).set({ eliminadoEn: new Date() }).where(eq(s.actos.id, id)).returning({ capituloId: s.actos.capituloId });
      if (!a) throw new Rechazo("El acto ya no existe.");
      if (a.capituloId != null) await normalizarOrdenActos(tx, a.capituloId);
      return a.capituloId;
    }),
  );
  return conCapitulo(r);
}

// ── Trama desde el acto (§4) ───────────────────────────────────────────────

/** Capítulo de un acto vivo, o rechazo si no existe. */
async function capituloDelActo(ex: Ejecutor, actoId: number): Promise<number | null> {
  const [a] = await ex
    .select({ capituloId: s.actos.capituloId })
    .from(s.actos)
    .where(and(eq(s.actos.id, actoId), isNull(s.actos.eliminadoEn)));
  if (!a) throw new Rechazo("El acto ya no existe.");
  return a.capituloId;
}

/** Crea una hoja de trama ya ligada al acto (y a su capítulo). */
export async function crearHojaEnActo(actoId: number, titulo: string): Promise<Resultado<{ id: number }>> {
  await assertAdmin();
  const t = titulo.trim();
  if (!t) return { ok: false, error: "La hoja necesita un título." };
  const r = await intentar("crearHojaEnActo", () =>
    db.transaction(async (tx) => {
      const capituloId = await capituloDelActo(tx, actoId);
      const [h] = await tx.insert(s.tramaHojas).values({ titulo: t, actoId, capituloId }).returning({ id: s.tramaHojas.id });
      return { id: h.id };
    }),
  );
  if (r.ok) revalidatePath("/admin/taller", "layout");
  return r;
}

/**
 * Marca que un hilo se abre o se cierra en este acto (o lo desmarca con
 * `activo` false). Al marcarlo se apunta también el capítulo, que es lo que ya
 * leían las pantallas anteriores al taller.
 */
export async function marcarHiloEnActo(hiloId: number, actoId: number, cual: "apertura" | "cierre", activo: boolean): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("marcarHiloEnActo", () =>
    db.transaction(async (tx) => {
      const capituloId = await capituloDelActo(tx, actoId);
      const set =
        cual === "apertura"
          ? { actoAperturaId: activo ? actoId : null, ...(activo ? { capituloAperturaId: capituloId } : {}) }
          : { actoCierreId: activo ? actoId : null, ...(activo ? { capituloCierreId: capituloId } : {}) };
      const hecho = await tx.update(s.hiloNarrativo).set(set).where(eq(s.hiloNarrativo.id, hiloId)).returning({ id: s.hiloNarrativo.id });
      if (hecho.length === 0) throw new Rechazo("El hilo ya no existe.");
      return undefined;
    }),
  );
  if (r.ok) revalidatePath("/admin/taller", "layout");
  return r;
}

/** Crea un hilo que se abre en este acto. */
export async function crearHiloEnActo(actoId: number, nombre: string): Promise<Resultado<{ id: number }>> {
  await assertAdmin();
  const n = nombre.trim();
  if (!n) return { ok: false, error: "El hilo necesita un nombre." };
  const r = await intentar("crearHiloEnActo", () =>
    db.transaction(async (tx) => {
      const capituloId = await capituloDelActo(tx, actoId);
      const [h] = await tx
        .insert(s.hiloNarrativo)
        .values({ nombre: n, actoAperturaId: actoId, capituloAperturaId: capituloId })
        .returning({ id: s.hiloNarrativo.id });
      return { id: h.id };
    }),
  );
  if (r.ok) revalidatePath("/admin/taller", "layout");
  return r;
}

/**
 * Liga un evento de la cronología a un acto (o lo desliga con `actoId` null).
 * El evento conserva o recibe también el capítulo del acto (§14).
 */
export async function vincularEventoActo(eventoId: number, actoId: number | null): Promise<Resultado> {
  await assertAdmin();
  const r = await intentar("vincularEventoActo", () =>
    db.transaction(async (tx) => {
      const set = actoId == null ? { actoId: null } : { actoId, capituloId: await capituloDelActo(tx, actoId) };
      const hecho = await tx.update(s.timelineEventos).set(set).where(eq(s.timelineEventos.id, eventoId)).returning({ id: s.timelineEventos.id });
      if (hecho.length === 0) throw new Rechazo("El evento ya no existe.");
      return undefined;
    }),
  );
  if (r.ok) {
    revalidatePath("/admin/taller", "layout");
    revalidatePath("/timeline");
  }
  return r;
}

// ── Fragmentos del acto (docs/fragmentos-y-musica.md §2) ───────────────────
//
// Se guardan al momento, como los vínculos, y cada acción devuelve el bloque
// entero (fragmentos y fecha del acto) para que el editor lo pinte sin recargar.
// Reglas: el POV de un fragmento entra en el bloque POV del acto si no estaba
// (borrar el fragmento no lo quita), y cada cambio de fecha recalcula la del
// acto en la misma transacción.

/** Resultado de una acción de fragmentos. `povAnadido`: el bloque POV del acto ganó una ficha. */
export type ResultadoFragmentos = Resultado<FragmentosActo & { povAnadido: boolean }>;

const FragmentoCambios = z
  .object({
    personajeId: z.number().int().nullable(),
    titulo: textoOpcional,
    // Se pinta como enlace en la ficha pública: solo http(s), nada de javascript:.
    enlace: z
      .string()
      .trim()
      .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "El enlace debe empezar por http:// o https://.")
      .nullable()
      .optional(),
    /** null la borra, ausente no la toca. */
    fecha: FechaSchema.nullable(),
  })
  .partial();

export type FragmentoCambios = z.input<typeof FragmentoCambios>;

/** Añade el personaje al bloque POV del acto si aún no está. Devuelve si lo añadió. */
async function asegurarPov(ex: Ejecutor, actoId: number, personajeId: number): Promise<boolean> {
  const donde = and(
    eq(s.vinculo.origenTipo, "actos"),
    eq(s.vinculo.origenId, actoId),
    eq(s.vinculo.relacion, "acto_pov"),
    eq(s.vinculo.destinoTipo, "personajes"),
    eq(s.vinculo.destinoId, personajeId),
  );
  const [ya] = await ex.select({ id: s.vinculo.id }).from(s.vinculo).where(donde).limit(1);
  if (ya) return false;
  const [p] = await ex.select({ id: s.personajes.id }).from(s.personajes).where(eq(s.personajes.id, personajeId));
  if (!p) throw new Rechazo("Ese personaje ya no existe.");
  await ex.insert(s.vinculo).values({ origenTipo: "actos", origenId: actoId, destinoTipo: "personajes", destinoId: personajeId, relacion: "acto_pov" });
  return true;
}

/** Acto y capítulo de un fragmento, o rechazo si no existe. */
async function actoDelFragmento(ex: Ejecutor, id: number): Promise<{ actoId: number; capituloId: number | null }> {
  const [f] = await ex
    .select({ actoId: s.actoFragmento.actoId, capituloId: s.actos.capituloId })
    .from(s.actoFragmento)
    .innerJoin(s.actos, eq(s.actoFragmento.actoId, s.actos.id))
    .where(eq(s.actoFragmento.id, id));
  if (!f) throw new Rechazo("El fragmento ya no existe.");
  return f;
}

/** Revalida lo que depende del acto y devuelve el bloque recién leído. */
async function trasFragmentos(
  r: Resultado<{ actoId: number; capituloId: number | null; povAnadido: boolean }>,
): Promise<ResultadoFragmentos> {
  if (!r.ok) return r;
  const { actoId, capituloId, povAnadido } = r.data;
  revalidarNarrativa(capituloId ?? undefined);
  if (capituloId != null) revalidatePath(`/capitulos/${capituloId}/actos/${actoId}`);
  return { ok: true, data: { ...(await getFragmentosActo(actoId)), povAnadido } };
}

/** Añade un fragmento al final del acto, en orden de lectura. */
export async function crearFragmento(actoId: number, personajeId: number | null = null): Promise<ResultadoFragmentos> {
  await assertAdmin();
  if (personajeId != null && !Number.isInteger(personajeId)) return { ok: false, error: "Datos inválidos." };
  const r = await intentar("crearFragmento", () =>
    db.transaction(async (tx) => {
      const capituloId = await capituloDelActo(tx, actoId);
      const [{ ultimo }] = await tx
        .select({ ultimo: max(s.actoFragmento.orden) })
        .from(s.actoFragmento)
        .where(eq(s.actoFragmento.actoId, actoId));
      await tx.insert(s.actoFragmento).values({ actoId, personajeId, orden: (ultimo ?? -1) + 1 });
      const povAnadido = personajeId != null ? await asegurarPov(tx, actoId, personajeId) : false;
      return { actoId, capituloId, povAnadido };
    }),
  );
  return trasFragmentos(r);
}

/** Guarda POV, título, enlace o fecha de un fragmento. Lo que no llega no se toca. */
export async function guardarFragmento(id: number, cambios: FragmentoCambios): Promise<ResultadoFragmentos> {
  await assertAdmin();
  const p = FragmentoCambios.safeParse(cambios);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const { fecha, ...d } = p.data;

  const r = await intentar("guardarFragmento", () =>
    db.transaction(async (tx) => {
      const { actoId, capituloId } = await actoDelFragmento(tx, id);
      const set: Partial<typeof s.actoFragmento.$inferInsert> = { actualizadoEn: new Date() };
      for (const [k, v] of Object.entries(d)) (set as Record<string, unknown>)[k] = v === "" ? null : v;
      await tx.update(s.actoFragmento).set(set).where(eq(s.actoFragmento.id, id));

      const povAnadido = d.personajeId != null ? await asegurarPov(tx, actoId, d.personajeId) : false;
      if (fecha !== undefined) {
        const error = await escribirFecha(tx, { entidadTipo: "fragmentos", entidadId: id, rol: "principal" }, fecha as Fecha | null);
        if (error) throw new Rechazo(error);
        const errorActo = await recalcularFechaActo(tx, actoId);
        if (errorActo) throw new Rechazo(errorActo);
      }
      return { actoId, capituloId, povAnadido };
    }),
  );
  return trasFragmentos(r);
}

/**
 * Borra un fragmento (sin papelera: el acto ya tiene la suya), con su fecha y
 * sus vínculos. Su POV se queda en el acto. Si era el último con fecha, la del
 * acto se queda como estaba y vuelve a ser manual.
 */
export async function borrarFragmento(id: number): Promise<ResultadoFragmentos> {
  await assertAdmin();
  const r = await intentar("borrarFragmento", () =>
    db.transaction(async (tx) => {
      const { actoId, capituloId } = await actoDelFragmento(tx, id);
      await borrarRastroDeFragmentos(tx, [id]);
      await tx.delete(s.actoFragmento).where(eq(s.actoFragmento.id, id));
      const error = await recalcularFechaActo(tx, actoId);
      if (error) throw new Rechazo(error);
      return { actoId, capituloId, povAnadido: false };
    }),
  );
  return trasFragmentos(r);
}

/** Fija el orden de lectura: `ids` son todos los fragmentos del acto, en su nuevo orden. */
export async function reordenarFragmentos(actoId: number, ids: number[]): Promise<ResultadoFragmentos> {
  await assertAdmin();
  const r = await intentar("reordenarFragmentos", () =>
    db.transaction(async (tx) => {
      const capituloId = await capituloDelActo(tx, actoId);
      const propios = await tx.select({ id: s.actoFragmento.id }).from(s.actoFragmento).where(eq(s.actoFragmento.actoId, actoId));
      const set = new Set(propios.map((f) => f.id));
      if (ids.length !== set.size || !ids.every((x) => set.has(x)))
        throw new Rechazo("La lista de fragmentos ha cambiado. Recarga y vuelve a intentarlo.");
      for (const [orden, fid] of ids.entries()) await tx.update(s.actoFragmento).set({ orden }).where(eq(s.actoFragmento.id, fid));
      return { actoId, capituloId, povAnadido: false };
    }),
  );
  return trasFragmentos(r);
}

/** Fechas y vínculos de unos fragmentos: lo que no se va solo con la clave foránea. */
async function borrarRastroDeFragmentos(ex: Ejecutor, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await ex.delete(s.fechaLore).where(and(eq(s.fechaLore.entidadTipo, "fragmentos"), inArray(s.fechaLore.entidadId, ids)));
  await ex
    .delete(s.vinculo)
    .where(
      or(
        and(eq(s.vinculo.origenTipo, "fragmentos"), inArray(s.vinculo.origenId, ids)),
        and(eq(s.vinculo.destinoTipo, "fragmentos"), inArray(s.vinculo.destinoId, ids)),
      ),
    );
}

// ── Papelera del taller (§9) ───────────────────────────────────────────────

const TABLAS_PAPELERA = {
  capitulos: s.capitulos,
  actos: s.actos,
  arcos: s.tramaArcos,
  hojas: s.tramaHojas,
  hilos: s.hiloNarrativo,
} as const;

export type TipoPapelera = keyof typeof TABLAS_PAPELERA;

function esTipoPapelera(t: string): t is TipoPapelera {
  return t in TABLAS_PAPELERA;
}

/**
 * Saca algo de la papelera. Un capítulo vuelve al final de su libro y un acto
 * al final de su capítulo (y a su primera fase si la plantilla cambió mientras
 * estaba borrado), para no pisar el orden que se haya hecho entretanto.
 */
export async function restaurarDelTaller(tipo: string, id: number): Promise<Resultado> {
  await assertAdmin();
  if (!esTipoPapelera(tipo)) return { ok: false, error: "Tipo desconocido." };
  const r = await intentar("restaurar", () =>
    db.transaction(async (tx) => {
      if (tipo === "capitulos") {
        const [c] = await tx.select({ libro: s.capitulos.libro }).from(s.capitulos).where(eq(s.capitulos.id, id));
        if (!c) throw new Rechazo("Ya no existe.");
        const [{ ultimo }] = await tx
          .select({ ultimo: max(s.capitulos.orden) })
          .from(s.capitulos)
          .where(and(c.libro ? eq(s.capitulos.libro, c.libro) : isNull(s.capitulos.libro), isNull(s.capitulos.eliminadoEn)));
        await tx.update(s.capitulos).set({ eliminadoEn: null, orden: (ultimo ?? -1) + 1 }).where(eq(s.capitulos.id, id));
        await renumerarCapitulos(tx);
      } else if (tipo === "actos") {
        const [a] = await tx.select({ capituloId: s.actos.capituloId, faseId: s.actos.faseId }).from(s.actos).where(eq(s.actos.id, id));
        if (!a) throw new Rechazo("Ya no existe.");
        let faseId = a.faseId;
        let orden = 0;
        if (a.capituloId != null) {
          const [cap] = await tx.select({ plantillaId: s.capitulos.plantillaId }).from(s.capitulos).where(eq(s.capitulos.id, a.capituloId));
          if (cap?.plantillaId != null) {
            const [f] = faseId != null ? await tx.select({ p: s.estructuraFase.plantillaId }).from(s.estructuraFase).where(eq(s.estructuraFase.id, faseId)) : [];
            if (!f || f.p !== cap.plantillaId) faseId = await primeraFase(tx, cap.plantillaId);
          }
          const [{ ultimo }] = await tx
            .select({ ultimo: max(s.actos.numeroOrden) })
            .from(s.actos)
            .where(and(eq(s.actos.capituloId, a.capituloId), isNull(s.actos.eliminadoEn)));
          orden = (ultimo ?? -1) + 1;
        }
        await tx.update(s.actos).set({ eliminadoEn: null, faseId, numeroOrden: orden }).where(eq(s.actos.id, id));
      } else {
        const t = TABLAS_PAPELERA[tipo];
        await tx.update(t).set({ eliminadoEn: null }).where(eq(t.id, id));
      }
      return undefined;
    }),
  );
  if (r.ok) revalidarNarrativa();
  return r;
}

/**
 * Borra para siempre algo que está en la papelera. Un capítulo con actos no se
 * borra: sus actos se quedarían sueltos. Lo que apuntaba a lo borrado (hojas,
 * hilos, eventos) se desliga en lugar de borrarse, y sus fechas y vínculos
 * genéricos se limpian.
 */
export async function eliminarDelTaller(tipo: string, id: number): Promise<Resultado> {
  await assertAdmin();
  if (!esTipoPapelera(tipo)) return { ok: false, error: "Tipo desconocido." };
  const r = await intentar("eliminar", () =>
    db.transaction(async (tx) => {
      const t = TABLAS_PAPELERA[tipo];
      const [fila] = await tx.select({ eliminadoEn: t.eliminadoEn }).from(t).where(eq(t.id, id));
      if (!fila) throw new Rechazo("Ya no existe.");
      if (!fila.eliminadoEn) throw new Rechazo("Solo se borra para siempre lo que está en la papelera.");

      if (tipo === "capitulos") {
        const [{ n }] = await tx.select({ n: count() }).from(s.actos).where(eq(s.actos.capituloId, id));
        if (n > 0) throw new Rechazo(`Tiene ${n} actos (vivos o en la papelera). Muévelos o bórralos antes.`);
        // Sus canciones van en `vinculo` desde la Fase 3 de fragmentos-y-musica:
        // las borra el barrido de vínculos de abajo.
      }
      if (tipo === "actos") {
        await tx.update(s.tramaHojas).set({ actoId: null }).where(eq(s.tramaHojas.actoId, id));
        // La clave foránea (on delete cascade) también se llevaría los
        // fragmentos, pero no sus fechas ni sus vínculos, que no la tienen.
        const fragmentos = await tx.select({ id: s.actoFragmento.id }).from(s.actoFragmento).where(eq(s.actoFragmento.actoId, id));
        await borrarRastroDeFragmentos(tx, fragmentos.map((f) => f.id));
        await tx.delete(s.actoFragmento).where(eq(s.actoFragmento.actoId, id));
      }
      if (tipo === "arcos") {
        await tx.update(s.tramaHojas).set({ arcoId: null }).where(eq(s.tramaHojas.arcoId, id));
        await tx.update(s.hiloNarrativo).set({ arcoId: null }).where(eq(s.hiloNarrativo.arcoId, id));
      }
      await tx.delete(s.fechaLore).where(and(eq(s.fechaLore.entidadTipo, tipo), eq(s.fechaLore.entidadId, id)));
      await tx
        .delete(s.vinculo)
        .where(or(and(eq(s.vinculo.origenTipo, tipo), eq(s.vinculo.origenId, id)), and(eq(s.vinculo.destinoTipo, tipo), eq(s.vinculo.destinoId, id))));
      await tx.delete(t).where(eq(t.id, id));
      return undefined;
    }),
  );
  if (r.ok) revalidarNarrativa();
  return r;
}
