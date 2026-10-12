import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { claves, textosFecha, validarFecha, type Calendario, type Fecha, type TextosFecha, type TipoSegmento } from "@/lib/fechas";

/** Una transacción de Drizzle o el cliente. */
type Ejecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * El calendario completo del mundo: meses, semana y eras. Es pequeño (unas
 * decenas de filas) y lo necesita casi cualquier pantalla que pinte una fecha,
 * así que se carga entero de una vez.
 */
export async function getCalendario(ex: Ejecutor = db): Promise<Calendario> {
  const [segmentos, dias, eras] = await Promise.all([
    ex.select().from(s.calendarioSegmento).orderBy(asc(s.calendarioSegmento.orden), asc(s.calendarioSegmento.id)),
    ex.select().from(s.calendarioDiaSemana).orderBy(asc(s.calendarioDiaSemana.orden), asc(s.calendarioDiaSemana.id)),
    ex.select().from(s.era).orderBy(asc(s.era.orden), asc(s.era.id)),
  ]);
  return {
    segmentos: segmentos.map((x) => ({ ...x, tipo: x.tipo as TipoSegmento })),
    diasSemana: dias.map((d) => d.nombre),
    eras,
  };
}

/**
 * Cuántas fechas usan cada mes o bloque de días. Un segmento en uso no se puede
 * borrar (la base lo impide con una clave foránea); el taller lo dice antes de
 * que lo intentes.
 */
export async function getUsoSegmentos(): Promise<Record<number, number>> {
  const filas = await db.execute<{ id: number; n: number }>(sql`
    select seg as id, count(*)::int as n from (
      select ini_segmento_id as seg from fecha_lore where ini_segmento_id is not null
      union all
      select fin_segmento_id from fecha_lore where fin_segmento_id is not null
    ) u group by seg`);
  return Object.fromEntries(filas.map((f) => [f.id, f.n]));
}

/**
 * Guarda (o borra, con `fecha` null) la fecha de una ficha para un rol. Valida
 * contra el calendario y precalcula las claves. Devuelve el primer error si la
 * fecha no cabe en el calendario; null si se guardó.
 *
 * Vive aquí, server-only y sin `assertAdmin`, para poder usarse dentro de la
 * transacción de otra escritura (guardar un acto con su fecha). Quien la llame
 * desde una Server Action es responsable de haber comprobado al admin.
 */
export async function escribirFecha(
  ex: Ejecutor,
  destino: { entidadTipo: string; entidadId: number; rol: string },
  fecha: Fecha | null,
  importante = false,
): Promise<string | null> {
  const donde = and(
    eq(s.fechaLore.entidadTipo, destino.entidadTipo),
    eq(s.fechaLore.entidadId, destino.entidadId),
    eq(s.fechaLore.rol, destino.rol),
  );
  if (!fecha) {
    await ex.delete(s.fechaLore).where(donde);
    return null;
  }
  const cal = await getCalendario(ex);
  const errores = validarFecha(cal, fecha);
  if (errores.length) return errores[0];
  const k = claves(cal, fecha);
  const fila = {
    iniAnio: fecha.ini.anio,
    iniSegmentoId: fecha.ini.segmentoId,
    iniDia: fecha.ini.dia,
    finAnio: fecha.fin?.anio ?? null,
    finSegmentoId: fecha.fin?.segmentoId ?? null,
    finDia: fecha.fin?.dia ?? null,
    aproximada: fecha.aproximada,
    importante,
    claveIni: k.ini,
    claveFin: k.fin,
  };
  await ex
    .insert(s.fechaLore)
    .values({ ...destino, ...fila })
    .onConflictDoUpdate({ target: [s.fechaLore.entidadTipo, s.fechaLore.entidadId, s.fechaLore.rol], set: fila });
  return null;
}

/** Una fila de `fecha_lore` ya en la forma de `lib/fechas`, con sus claves. */
export interface FechaGuardada {
  entidadId: number;
  rol: string;
  fecha: Fecha;
  importante: boolean;
  claveIni: number;
  claveFin: number;
}

export function aFechaGuardada(f: typeof s.fechaLore.$inferSelect): FechaGuardada {
  return {
    entidadId: f.entidadId,
    rol: f.rol,
    fecha: {
      ini: { anio: f.iniAnio, segmentoId: f.iniSegmentoId, dia: f.iniDia },
      fin: f.finAnio != null ? { anio: f.finAnio, segmentoId: f.finSegmentoId, dia: f.finDia } : null,
      aproximada: f.aproximada,
    },
    importante: f.importante,
    claveIni: f.claveIni,
    claveFin: f.claveFin,
  };
}

/** La fecha guardada de una ficha para un rol, en la forma de `lib/fechas`. */
export async function leerFecha(
  destino: { entidadTipo: string; entidadId: number; rol: string },
): Promise<FechaGuardada | null> {
  const [f] = await db
    .select()
    .from(s.fechaLore)
    .where(
      and(
        eq(s.fechaLore.entidadTipo, destino.entidadTipo),
        eq(s.fechaLore.entidadId, destino.entidadId),
        eq(s.fechaLore.rol, destino.rol),
      ),
    )
    .limit(1);
  return f ? aFechaGuardada(f) : null;
}

/** Todas las fechas de una ficha, por rol. */
export async function leerFechasDe(entidadTipo: string, entidadId: number): Promise<Record<string, FechaGuardada>> {
  const filas = await db
    .select()
    .from(s.fechaLore)
    .where(and(eq(s.fechaLore.entidadTipo, entidadTipo), eq(s.fechaLore.entidadId, entidadId)));
  return Object.fromEntries(filas.map((f) => [f.rol, aFechaGuardada(f)]));
}

/** La fecha de un rol para varias fichas de golpe, por id. */
export async function fechasDeEntidades(
  entidadTipo: string,
  ids: number[],
  rol = "principal",
): Promise<Map<number, FechaGuardada>> {
  if (ids.length === 0) return new Map();
  const filas = await db
    .select()
    .from(s.fechaLore)
    .where(and(eq(s.fechaLore.entidadTipo, entidadTipo), eq(s.fechaLore.rol, rol), inArray(s.fechaLore.entidadId, [...new Set(ids)])));
  return new Map(filas.map((f) => [f.entidadId, aFechaGuardada(f)]));
}

/**
 * La fecha de varias fichas ya escrita, para listas y selectores. Las dos
 * lecturas (eras y absoluto) por id; las fichas sin fecha no aparecen.
 */
export async function textosDeFechas(
  entidadTipo: string,
  ids: number[],
  { rol = "principal", corto = false }: { rol?: string; corto?: boolean } = {},
): Promise<Map<number, TextosFecha>> {
  if (ids.length === 0) return new Map();
  const [cal, fechas] = await Promise.all([getCalendario(), fechasDeEntidades(entidadTipo, ids, rol)]);
  return new Map([...fechas].map(([id, f]) => [id, textosFecha(cal, f.fecha, corto)]));
}
