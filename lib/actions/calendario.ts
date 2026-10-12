"use server";

import { asc, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { claves, validarFecha, type Calendario, type Fecha, type TipoSegmento } from "@/lib/fechas";

/**
 * Configuración del calendario del mundo: meses, días fuera de mes, semana y
 * eras (spec del taller §13).
 *
 * Se guarda todo junto y en una transacción porque las piezas dependen entre sí:
 * cambiar cuántos días tiene un mes mueve el día absoluto de todas las fechas
 * posteriores, así que al final se recalculan todas las claves. Si alguna fecha
 * deja de caber (un día 30 en un mes que pasa a tener 28), se rechaza el cambio
 * entero en lugar de dejar fechas imposibles.
 *
 * `assertAdmin` en cada export: al ser un módulo "use server", todos son
 * endpoints alcanzables por POST directo.
 */

const Entrada = z.object({
  segmentos: z
    .array(
      z.object({
        id: z.number().int().nullable(),
        nombre: z.string().trim().min(1, "Cada mes necesita un nombre."),
        dias: z.number().int().min(1, "Un mes tiene al menos un día.").max(1000),
        tipo: z.enum(["mes", "intercalar"]),
      }),
    )
    .refine((xs) => xs.some((x) => x.tipo === "mes"), "El año necesita al menos un mes."),
  diasSemana: z.array(z.string().trim().min(1, "Cada día de la semana necesita un nombre.")),
  eras: z.array(
    z.object({
      id: z.number().int().nullable(),
      nombre: z.string().trim().min(1, "Cada era necesita un nombre."),
      abreviatura: z.string().trim(),
      anioInicio: z.number().int().nullable(),
    }),
  ),
});

export type CalendarioEntrada = z.input<typeof Entrada>;

export type ResultadoCalendario = { ok: true; recalculadas: number } | { ok: false; error: string };

/** Error pensado para enseñarse tal cual: aborta la transacción con un motivo legible. */
class Rechazo extends Error {}

export async function guardarCalendario(entrada: CalendarioEntrada): Promise<ResultadoCalendario> {
  await assertAdmin();
  const parsed = Entrada.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const datos = parsed.data;

  // Las eras se suceden: cada una configurada empieza después de la anterior.
  // La primera no tiene inicio (se extiende hacia atrás sin límite).
  let previo: { nombre: string; anio: number } | null = null;
  for (const e of datos.eras.slice(1)) {
    if (e.anioInicio == null) continue;
    if (previo && e.anioInicio <= previo.anio)
      return { ok: false, error: `«${e.nombre}» empieza en ${e.anioInicio}, que no es posterior a «${previo.nombre}» (${previo.anio}).` };
    previo = { nombre: e.nombre, anio: e.anioInicio };
  }

  try {
    const recalculadas = await db.transaction(async (tx) => {
      // ── Segmentos ────────────────────────────────────────────────────────
      const existentes = await tx.select().from(s.calendarioSegmento);
      const quedan = new Set(datos.segmentos.map((x) => x.id).filter((x): x is number => x != null));
      const quitados = existentes.filter((x) => !quedan.has(x.id));
      if (quitados.length) {
        const ids = quitados.map((x) => x.id);
        const usados = await tx
          .select({ ini: s.fechaLore.iniSegmentoId, fin: s.fechaLore.finSegmentoId })
          .from(s.fechaLore)
          .where(or(inArray(s.fechaLore.iniSegmentoId, ids), inArray(s.fechaLore.finSegmentoId, ids)));
        const enUso = quitados.filter((q) => usados.some((u) => u.ini === q.id || u.fin === q.id));
        if (enUso.length)
          throw new Rechazo(`No se puede quitar ${enUso.map((x) => `«${x.nombre}»`).join(", ")}: hay fechas que caen en ${enUso.length === 1 ? "él" : "ellos"}.`);
        await tx.delete(s.calendarioSegmento).where(inArray(s.calendarioSegmento.id, ids));
      }
      for (const [orden, x] of datos.segmentos.entries()) {
        const fila = { orden, nombre: x.nombre, dias: x.dias, tipo: x.tipo };
        if (x.id != null && existentes.some((e) => e.id === x.id)) {
          await tx.update(s.calendarioSegmento).set(fila).where(eq(s.calendarioSegmento.id, x.id));
        } else {
          await tx.insert(s.calendarioSegmento).values(fila);
        }
      }

      // ── Semana: no la referencia nada, se reescribe entera ───────────────
      await tx.delete(s.calendarioDiaSemana);
      if (datos.diasSemana.length)
        await tx.insert(s.calendarioDiaSemana).values(datos.diasSemana.map((nombre, orden) => ({ orden, nombre })));

      // ── Eras ─────────────────────────────────────────────────────────────
      const erasPrevias = await tx.select({ id: s.era.id }).from(s.era);
      const erasQuedan = new Set(datos.eras.map((e) => e.id).filter((x): x is number => x != null));
      const erasFuera = erasPrevias.filter((e) => !erasQuedan.has(e.id)).map((e) => e.id);
      if (erasFuera.length) await tx.delete(s.era).where(inArray(s.era.id, erasFuera));
      for (const [orden, e] of datos.eras.entries()) {
        const fila = {
          orden,
          nombre: e.nombre,
          abreviatura: e.abreviatura || null,
          anioInicio: orden === 0 ? null : e.anioInicio,
        };
        if (e.id != null && erasPrevias.some((p) => p.id === e.id)) {
          await tx.update(s.era).set(fila).where(eq(s.era.id, e.id));
        } else {
          await tx.insert(s.era).values(fila);
        }
      }

      // ── Recalcular el día absoluto de todas las fechas ───────────────────
      const segs = await tx.select().from(s.calendarioSegmento).orderBy(asc(s.calendarioSegmento.orden));
      const cal: Calendario = {
        segmentos: segs.map((x) => ({ ...x, tipo: x.tipo as TipoSegmento })),
        diasSemana: datos.diasSemana,
        eras: [],
      };
      const fechas = await tx.select().from(s.fechaLore);
      let cambiadas = 0;
      for (const f of fechas) {
        const fecha: Fecha = {
          ini: { anio: f.iniAnio, segmentoId: f.iniSegmentoId, dia: f.iniDia },
          fin: f.finAnio != null ? { anio: f.finAnio, segmentoId: f.finSegmentoId, dia: f.finDia } : null,
          aproximada: f.aproximada,
        };
        const errores = validarFecha(cal, fecha);
        if (errores.length)
          throw new Rechazo(`Con este calendario, una fecha de ${f.entidadTipo} #${f.entidadId} dejaría de existir: ${errores[0]}`);
        const k = claves(cal, fecha);
        if (k.ini !== f.claveIni || k.fin !== f.claveFin) {
          await tx.update(s.fechaLore).set({ claveIni: k.ini, claveFin: k.fin }).where(eq(s.fechaLore.id, f.id));
          cambiadas++;
        }
      }
      return cambiadas;
    });

    revalidatePath("/admin/taller/universo/calendario", "layout");
    // Las fechas se escriben distinto con otros meses o eras.
    revalidatePath("/", "layout");
    return { ok: true, recalculadas };
  } catch (e) {
    if (e instanceof Rechazo) return { ok: false, error: e.message };
    console.error("[guardarCalendario]", e);
    return { ok: false, error: "No se pudo guardar el calendario. Inténtalo de nuevo." };
  }
}
