import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export interface AdminStat {
  label: string;
  total: number;
  visibles: number;
}

/**
 * Estadísticas del dashboard en UNA sola consulta (UNION ALL) en lugar de 22
 * round-trips. Excluye personajes en papelera.
 */
export async function getAdminStats(): Promise<AdminStat[]> {
  const rows = (await db.execute(sql`
    select 'Personajes' as label, count(*) as total, count(*) filter (where estado_publicacion = 'publicado') as visibles from personajes where eliminado_en is null
    union all select 'Naciones', count(*), count(*) filter (where estado_publicacion = 'publicado') from naciones
    union all select 'Organizaciones', count(*), count(*) filter (where estado_publicacion = 'publicado') from organizaciones
    union all select 'Familias', count(*), count(*) filter (where estado_publicacion = 'publicado') from familias
    union all select 'Razas', count(*), count(*) filter (where estado_publicacion = 'publicado') from razas
    union all select 'Bestias', count(*), count(*) filter (where estado_publicacion = 'publicado') from bestias
    union all select 'Minerales', count(*), count(*) filter (where estado_publicacion = 'publicado') from minerales
    union all select 'Conceptos', count(*), count(*) filter (where estado_publicacion = 'publicado') from conceptos
    union all select 'Magia', count(*), count(*) filter (where estado_publicacion = 'publicado') from magia_fundamentos
    union all select 'Misiones', count(*), count(*) filter (where estado_publicacion = 'publicado') from misiones
    union all select 'Lore', count(*), count(*) filter (where estado_publicacion = 'publicado') from paginas_lore
  `)) as unknown as { label: string; total: number | string; visibles: number | string }[];

  return rows.map((r) => ({
    label: r.label,
    total: Number(r.total),
    visibles: Number(r.visibles),
  }));
}
