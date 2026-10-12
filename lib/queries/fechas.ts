import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { claves, validarFecha, type Calendario, type Fecha, type TipoSegmento } from "@/lib/fechas";

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

/** La fecha guardada de una ficha para un rol, en la forma de `lib/fechas`. */
export async function leerFecha(
  destino: { entidadTipo: string; entidadId: number; rol: string },
): Promise<{ fecha: Fecha; importante: boolean } | null> {
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
  if (!f) return null;
  return {
    fecha: {
      ini: { anio: f.iniAnio, segmentoId: f.iniSegmentoId, dia: f.iniDia },
      fin: f.finAnio != null ? { anio: f.finAnio, segmentoId: f.finSegmentoId, dia: f.finDia } : null,
      aproximada: f.aproximada,
    },
    importante: f.importante,
  };
}
