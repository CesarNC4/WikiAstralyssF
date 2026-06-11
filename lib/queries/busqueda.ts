import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ENTITIES, type EntityKey } from "@/lib/entities";
import type { SearchResult } from "@/lib/types";

/**
 * Búsqueda global (§8) sobre el índice FTS materializado `search_index`,
 * mantenido por triggers en Postgres. Ranking con ts_rank_cd y config 'spanish'.
 */
export async function buscarGlobal(query: string, limit = 40): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    // Búsqueda tolerante (§8): combina FTS en español con coincidencia por
    // subcadena y similitud trigram sobre el título sin acentos, de modo que
    // prefijos ("sylva") y typos ("silvaterra") encuentren la entidad.
    const result = await db.execute(sql`
      WITH params AS (
        SELECT extensions.unaccent(lower(${q})) AS t
      )
      SELECT entidad_tipo, entidad_id, titulo, subtitulo, resumen, imagen_url, url,
        (
          CASE WHEN documento @@ websearch_to_tsquery('spanish', ${q})
               THEN ts_rank_cd(documento, websearch_to_tsquery('spanish', ${q})) ELSE 0 END
          + extensions.similarity(extensions.unaccent(lower(titulo)), (SELECT t FROM params))
          + CASE WHEN extensions.unaccent(lower(titulo)) LIKE (SELECT t FROM params) || '%' THEN 0.6 ELSE 0 END
          + CASE WHEN extensions.unaccent(lower(titulo)) LIKE '%' || (SELECT t FROM params) || '%' THEN 0.3 ELSE 0 END
        ) AS score
      FROM search_index
      WHERE estado_publicacion = 'publicado'
        AND (
          documento @@ websearch_to_tsquery('spanish', ${q})
          OR extensions.unaccent(lower(titulo)) LIKE '%' || (SELECT t FROM params) || '%'
          OR extensions.unaccent(lower(coalesce(subtitulo, ''))) LIKE '%' || (SELECT t FROM params) || '%'
          OR extensions.similarity(extensions.unaccent(lower(titulo)), (SELECT t FROM params)) > 0.25
        )
      ORDER BY score DESC, titulo
      LIMIT ${limit}
    `);

    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as {
      entidad_tipo: string;
      entidad_id: string;
      titulo: string;
      subtitulo: string | null;
      resumen: string | null;
      imagen_url: string | null;
      url: string;
    }[];

    return rows.map((r) => ({
      tipo: r.entidad_tipo as EntityKey,
      tipoLabel: ENTITIES[r.entidad_tipo as EntityKey]?.singular ?? r.entidad_tipo,
      id: r.entidad_id,
      titulo: r.titulo,
      subtitulo: r.subtitulo ?? r.resumen,
      imagenUrl: r.imagen_url,
      href: r.url,
    }));
  } catch (err) {
    console.error("[buscarGlobal] error:", err);
    return [];
  }
}
