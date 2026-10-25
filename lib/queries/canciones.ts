import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { Track } from "@/hooks/usePlayerStore";
import { RELACIONES } from "@/lib/relaciones/registro";

/**
 * Canciones de una ficha (docs/fragmentos-y-musica.md §3.3). Todos los vínculos
 * con canciones viven en la tabla genérica `vinculo`, con la ficha en el lado A
 * y la canción en el B, así que una sola lectura sirve a personajes, capítulos,
 * actos, fragmentos, naciones, organizaciones, lugares y eventos.
 */

/** Relación ficha → canción de cada entidad, sacada del registro. */
const RELACION_CANCION: Record<string, string> = Object.fromEntries(
  RELACIONES.filter((r) => r.medio === "vinculo" && r.b.entidad === "canciones").map((r) => [r.a.entidad, r.relacion ?? r.id]),
);

export const CANCION_TRACK = {
  id: s.canciones.id,
  titulo: s.canciones.titulo,
  artista: s.canciones.artista,
  url: s.canciones.url,
  tipoFuente: s.canciones.tipoFuente,
  imagenUrl: s.canciones.imagenUrl,
  estado: s.canciones.estadoPublicacion,
};

/**
 * Canciones vinculadas a varias fichas de una entidad, por id de ficha. La nota
 * del vínculo ("suena cuando Aqua despierta") llega como `contexto`. Con
 * `publico`, solo las canciones publicadas.
 */
export async function cancionesDeFichas(
  entidad: string,
  ids: number[],
  { publico = true }: { publico?: boolean } = {},
): Promise<Map<number, Track[]>> {
  const out = new Map<number, Track[]>();
  const relacion = RELACION_CANCION[entidad];
  if (!relacion || ids.length === 0) return out;
  const filas = await db
    .select({ ...CANCION_TRACK, ownerId: s.vinculo.origenId, nota: s.vinculo.nota })
    .from(s.vinculo)
    .innerJoin(s.canciones, eq(s.vinculo.destinoId, s.canciones.id))
    .where(
      and(
        eq(s.vinculo.origenTipo, entidad),
        inArray(s.vinculo.origenId, [...new Set(ids)]),
        eq(s.vinculo.relacion, relacion),
        eq(s.vinculo.destinoTipo, "canciones"),
        isNull(s.canciones.eliminadoEn),
      ),
    )
    .orderBy(asc(s.vinculo.orden), asc(s.vinculo.id));
  for (const { ownerId, nota, estado, ...c } of filas) {
    if (publico && estado !== "publicado") continue;
    if (!out.has(ownerId)) out.set(ownerId, []);
    out.get(ownerId)!.push({ ...c, contexto: nota });
  }
  return out;
}

/** Canciones de una ficha. */
export async function cancionesDe(entidad: string, id: number, opts: { publico?: boolean } = {}): Promise<Track[]> {
  return (await cancionesDeFichas(entidad, [id], opts)).get(id) ?? [];
}
