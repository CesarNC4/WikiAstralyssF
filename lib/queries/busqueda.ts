import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ENTITIES, type EntityKey } from "@/lib/entities";
import type { SearchResult } from "@/lib/types";

/**
 * Búsqueda global (§8) sobre el índice FTS materializado `search_index`,
 * mantenido por triggers en Postgres. Ranking con ts_rank_cd y config 'spanish'.
 */
export async function buscarGlobal(query: string, limit = 24): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const result = await db.execute(sql`
      SELECT entidad_tipo, entidad_id, titulo, subtitulo, url
      FROM search_index
      WHERE estado_publicacion = 'publicado'
        AND documento @@ websearch_to_tsquery('spanish', ${q})
      ORDER BY ts_rank_cd(documento, websearch_to_tsquery('spanish', ${q})) DESC
      LIMIT ${limit}
    `);

    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as {
      entidad_tipo: string;
      entidad_id: string;
      titulo: string;
      subtitulo: string | null;
      url: string;
    }[];

    return rows.map((r) => ({
      tipo: r.entidad_tipo as EntityKey,
      tipoLabel: ENTITIES[r.entidad_tipo as EntityKey]?.singular ?? r.entidad_tipo,
      id: r.entidad_id,
      titulo: r.titulo,
      subtitulo: r.subtitulo,
      href: r.url,
    }));
  } catch {
    return [];
  }
}
