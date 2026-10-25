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
  letra: s.canciones.letra,
  duracion: s.canciones.duracion,
  estado: s.canciones.estadoPublicacion,
};

/** Fila de `CANCION_TRACK` → Track, sin el estado (que solo sirve para filtrar). */
function aTrack(c: Track): Track {
  return {
    id: c.id,
    titulo: c.titulo,
    artista: c.artista,
    url: c.url,
    tipoFuente: c.tipoFuente,
    imagenUrl: c.imagenUrl,
    letra: c.letra,
    duracion: c.duracion,
  };
}

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

// ── Sección Música (§3.7) ──────────────────────────────────────────────────

const publicada = and(eq(s.canciones.estadoPublicacion, "publicado"), isNull(s.canciones.eliminadoEn));

/** Valores de un catálogo en su orden. */
async function catalogo(campo: string): Promise<string[]> {
  const filas = await db
    .select({ valor: s.catalogos.valor })
    .from(s.catalogos)
    .where(eq(s.catalogos.campo, campo))
    .orderBy(asc(s.catalogos.orden), asc(s.catalogos.valor));
  return filas.map((f) => f.valor);
}

/** Actos visibles (publicados, en capítulo publicado) → su capítulo. */
async function actosVisibles(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const filas = await db
    .select({ id: s.actos.id, capituloId: s.actos.capituloId })
    .from(s.actos)
    .innerJoin(s.capitulos, eq(s.actos.capituloId, s.capitulos.id))
    .where(
      and(
        inArray(s.actos.id, [...new Set(ids)]),
        eq(s.actos.estadoPublicacion, "publicado"),
        isNull(s.actos.eliminadoEn),
        eq(s.capitulos.estadoPublicacion, "publicado"),
        isNull(s.capitulos.eliminadoEn),
      ),
    );
  return new Map(filas.map((f) => [f.id, f.capituloId!]));
}

export interface CancionMusica extends Track {
  uso: string | null;
  /** Capítulos donde suena: vínculo directo, el de alguno de sus actos o el de alguno de sus fragmentos. */
  capitulos: number[];
  personajes: number[];
}

export interface IndiceMusica {
  canciones: CancionMusica[];
  /** Capítulos publicados en orden de lectura: libro (orden del catálogo) y posición. */
  capitulos: { id: number; numero: string; titulo: string; libro: string | null }[];
  libros: string[];
  usos: string[];
  personajes: { id: number; nombre: string }[];
}

/** Todo lo que necesita el índice /canciones: las publicadas y dónde suena cada una. */
export async function getIndiceMusica(): Promise<IndiceMusica> {
  const [canciones, usos, librosCat, caps] = await Promise.all([
    db.select({ ...CANCION_TRACK, uso: s.canciones.uso }).from(s.canciones).where(publicada).orderBy(asc(s.canciones.titulo)),
    catalogo("cancion_uso"),
    catalogo("libro"),
    db
      .select({ id: s.capitulos.id, numero: s.capitulos.numero, titulo: s.capitulos.titulo, libro: s.capitulos.libro, orden: s.capitulos.orden })
      .from(s.capitulos)
      .where(and(eq(s.capitulos.estadoPublicacion, "publicado"), isNull(s.capitulos.eliminadoEn))),
  ]);
  const ids = canciones.map((c) => c.id);
  const vacio: IndiceMusica = { canciones: [], capitulos: [], libros: [], usos, personajes: [] };
  if (ids.length === 0) return vacio;

  const vinculos = await db
    .select({ relacion: s.vinculo.relacion, origenId: s.vinculo.origenId, cancionId: s.vinculo.destinoId })
    .from(s.vinculo)
    .where(
      and(
        eq(s.vinculo.destinoTipo, "canciones"),
        inArray(s.vinculo.destinoId, ids),
        inArray(s.vinculo.relacion, ["capitulo_cancion", "acto_cancion", "fragmento_cancion", "personaje_cancion"]),
      ),
    );
  const de = (rel: string) => vinculos.filter((v) => v.relacion === rel);

  // Fragmento → acto → capítulo, solo lo que el lector puede ver.
  const fragmentos = de("fragmento_cancion").length
    ? await db
        .select({ id: s.actoFragmento.id, actoId: s.actoFragmento.actoId })
        .from(s.actoFragmento)
        .where(inArray(s.actoFragmento.id, de("fragmento_cancion").map((v) => v.origenId)))
    : [];
  const actoDeFragmento = new Map(fragmentos.map((f) => [f.id, f.actoId]));
  const capituloDeActo = await actosVisibles([...de("acto_cancion").map((v) => v.origenId), ...fragmentos.map((f) => f.actoId)]);
  const capsVisibles = new Set(caps.map((c) => c.id));

  const personajesIds = [...new Set(de("personaje_cancion").map((v) => v.origenId))];
  const personajes = personajesIds.length
    ? await db
        .select({ id: s.personajes.id, nombre: s.personajes.nombre })
        .from(s.personajes)
        .where(and(inArray(s.personajes.id, personajesIds), eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn)))
        .orderBy(asc(s.personajes.nombre))
    : [];
  const personajesVisibles = new Set(personajes.map((p) => p.id));

  const lista: CancionMusica[] = canciones.map((fila) => {
    const c = { ...aTrack(fila), uso: fila.uso };
    const capitulos = new Set<number>();
    const pjs = new Set<number>();
    for (const v of vinculos) {
      if (v.cancionId !== c.id) continue;
      const cap =
        v.relacion === "capitulo_cancion"
          ? v.origenId
          : v.relacion === "acto_cancion"
            ? capituloDeActo.get(v.origenId)
            : v.relacion === "fragmento_cancion"
              ? capituloDeActo.get(actoDeFragmento.get(v.origenId) ?? -1)
              : undefined;
      if (cap != null && capsVisibles.has(cap)) capitulos.add(cap);
      if (v.relacion === "personaje_cancion" && personajesVisibles.has(v.origenId)) pjs.add(v.origenId);
    }
    return { ...c, capitulos: [...capitulos], personajes: [...pjs] };
  });

  // Libros: los del catálogo en su orden, más los que use algún capítulo sin estar en él.
  const libros = [...librosCat];
  for (const c of caps) if (c.libro && !libros.includes(c.libro)) libros.push(c.libro);
  const posLibro = (l: string | null) => (l ? libros.indexOf(l) : libros.length);
  const capitulos = [...caps]
    .sort((a, b) => posLibro(a.libro) - posLibro(b.libro) || a.orden - b.orden || a.id - b.id)
    .map((c) => ({ id: c.id, numero: c.numero, titulo: c.titulo, libro: c.libro }));

  return { canciones: lista, capitulos, libros, usos, personajes };
}

export interface MomentoCancion {
  fragmentoId: number;
  /** Posición del fragmento en orden de lectura dentro de su acto, desde 1. */
  numero: number;
  titulo: string | null;
  nota: string | null;
  pov: string | null;
  acto: { id: number; nombre: string };
  capitulo: { id: number; numero: string; titulo: string };
}

export interface CancionFicha extends Track {
  uso: string | null;
  momentos: MomentoCancion[];
}

/** Ficha pública de una canción, con los momentos exactos (fragmentos) en que suena. */
export async function getCancionPublica(id: number): Promise<CancionFicha | null> {
  const [c] = await db
    .select({ ...CANCION_TRACK, uso: s.canciones.uso })
    .from(s.canciones)
    .where(and(eq(s.canciones.id, id), publicada));
  if (!c) return null;
  const cancion = { ...aTrack(c), uso: c.uso };

  const vinculos = await db
    .select({ fragmentoId: s.vinculo.origenId, nota: s.vinculo.nota })
    .from(s.vinculo)
    .where(and(eq(s.vinculo.destinoTipo, "canciones"), eq(s.vinculo.destinoId, id), eq(s.vinculo.relacion, "fragmento_cancion")))
    .orderBy(asc(s.vinculo.orden), asc(s.vinculo.id));
  if (vinculos.length === 0) return { ...cancion, momentos: [] };

  const fragmentos = await db
    .select({
      id: s.actoFragmento.id,
      actoId: s.actoFragmento.actoId,
      titulo: s.actoFragmento.titulo,
      pov: s.personajes.nombre,
      povEstado: s.personajes.estadoPublicacion,
      actoNombre: s.actos.nombre,
      capituloId: s.capitulos.id,
      capituloNumero: s.capitulos.numero,
      capituloTitulo: s.capitulos.titulo,
    })
    .from(s.actoFragmento)
    .innerJoin(s.actos, eq(s.actoFragmento.actoId, s.actos.id))
    .innerJoin(s.capitulos, eq(s.actos.capituloId, s.capitulos.id))
    .leftJoin(s.personajes, eq(s.actoFragmento.personajeId, s.personajes.id))
    .where(
      and(
        inArray(s.actoFragmento.id, vinculos.map((v) => v.fragmentoId)),
        eq(s.actos.estadoPublicacion, "publicado"),
        isNull(s.actos.eliminadoEn),
        eq(s.capitulos.estadoPublicacion, "publicado"),
        isNull(s.capitulos.eliminadoEn),
      ),
    );

  // Número del fragmento dentro de su acto, en orden de lectura.
  const hermanos = await db
    .select({ id: s.actoFragmento.id, actoId: s.actoFragmento.actoId })
    .from(s.actoFragmento)
    .where(inArray(s.actoFragmento.actoId, [...new Set(fragmentos.map((f) => f.actoId))]))
    .orderBy(asc(s.actoFragmento.orden), asc(s.actoFragmento.id));
  const numero = new Map<number, number>();
  const contador = new Map<number, number>();
  for (const h of hermanos) {
    const n = (contador.get(h.actoId) ?? 0) + 1;
    contador.set(h.actoId, n);
    numero.set(h.id, n);
  }

  const porId = new Map(fragmentos.map((f) => [f.id, f]));
  const momentos: MomentoCancion[] = [];
  for (const v of vinculos) {
    const f = porId.get(v.fragmentoId);
    if (!f) continue;
    momentos.push({
      fragmentoId: f.id,
      numero: numero.get(f.id) ?? 0,
      titulo: f.titulo,
      nota: v.nota,
      pov: f.povEstado === "publicado" ? f.pov : null,
      acto: { id: f.actoId, nombre: f.actoNombre },
      capitulo: { id: f.capituloId, numero: f.capituloNumero, titulo: f.capituloTitulo },
    });
  }
  return { ...cancion, momentos };
}
