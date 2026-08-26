import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { DASH_ENTITIES } from "@/lib/queries/admin";

export interface FeedItem {
  tipo: string;
  titulo: string;
  resumen: string | null;
  url: string;
  imagenUrl: string | null;
  publicadoEn: Date;
}

/**
 * Últimas entidades publicadas, para el feed RSS.
 *
 * Se ordena por `publicado_primera_vez_en`, que es cuando algo se hizo público
 * por primera vez: editar una ficha vieja no la vuelve a colar como novedad.
 *
 * Las fechas salen de las tablas de entidad y el título/resumen/URL de
 * `search_index`, que ya los mantiene al día por triggers. El `join` deja fuera
 * lo que no tiene ficha pública propia (cronología, sistema monetario), que es
 * justo lo que no debe aparecer en un feed.
 */
export async function getPublicacionesRecientes(limit = 30): Promise<FeedItem[]> {
  const n = Math.max(1, Math.min(100, Math.trunc(limit)));

  // Cada rama se recorta antes de unir: las n globales sólo pueden salir de las
  // n mejores de cada tabla.
  const ramas = DASH_ENTITIES.map((e) =>
    sql.raw(
      `(select '${e.key}' as tipo, id::text as entidad_id, publicado_primera_vez_en as fecha ` +
        `from ${e.table} ` +
        `where estado_publicacion = 'publicado' and eliminado_en is null ` +
        `and publicado_primera_vez_en is not null ` +
        `order by publicado_primera_vez_en desc limit ${n})`,
    ),
  );

  const res = await db.execute(sql`
    with publicadas as (${sql.join(ramas, sql.raw(" union all "))})
    select p.tipo, p.fecha, s.titulo, s.subtitulo, s.resumen, s.url, s.imagen_url
    from publicadas p
    join search_index s on s.entidad_tipo = p.tipo and s.entidad_id = p.entidad_id
    where s.estado_publicacion = 'publicado'
    order by p.fecha desc
    limit ${n}
  `);

  const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as {
    tipo: string;
    fecha: Date;
    titulo: string;
    subtitulo: string | null;
    resumen: string | null;
    url: string;
    imagen_url: string | null;
  }[];

  return rows.map((r) => ({
    tipo: r.tipo,
    titulo: r.titulo,
    resumen: r.resumen ?? r.subtitulo,
    url: r.url,
    imagenUrl: r.imagen_url,
    publicadoEn: new Date(r.fecha),
  }));
}
