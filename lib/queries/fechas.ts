import "server-only";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { Calendario, TipoSegmento } from "@/lib/fechas";

/**
 * El calendario completo del mundo: meses, semana y eras. Es pequeño (unas
 * decenas de filas) y lo necesita casi cualquier pantalla que pinte una fecha,
 * así que se carga entero de una vez.
 */
export async function getCalendario(): Promise<Calendario> {
  const [segmentos, dias, eras] = await Promise.all([
    db.select().from(s.calendarioSegmento).orderBy(asc(s.calendarioSegmento.orden), asc(s.calendarioSegmento.id)),
    db.select().from(s.calendarioDiaSemana).orderBy(asc(s.calendarioDiaSemana.orden), asc(s.calendarioDiaSemana.id)),
    db.select().from(s.era).orderBy(asc(s.era.orden), asc(s.era.id)),
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
