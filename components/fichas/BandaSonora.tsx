import { SongList } from "@/components/fichas/SongList";
import { cancionesDe } from "@/lib/queries/canciones";

/**
 * Banda sonora de cualquier ficha, leída del registro de relaciones
 * (docs/fragmentos-y-musica.md §3.7). La ficha que la use debe listar su
 * bloque `<entidad>_cancion:a` en `BLOQUES_A_MANO` para no pintarla dos veces.
 */
export async function BandaSonora({ entidad, id }: { entidad: string; id: number }) {
  const tracks = await cancionesDe(entidad, id).catch(() => []);
  return <SongList tracks={tracks} />;
}
