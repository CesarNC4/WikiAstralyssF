/**
 * De dónde suena una canción (docs/fragmentos-y-musica.md §3.3). Ya no se elige
 * a mano: el servidor la deduce del archivo subido o del enlace, y el
 * reproductor elige motor según ella. Client-safe: el panel la usa para decir
 * qué ha reconocido mientras pegas el enlace.
 */

export const FUENTES = ["audio", "youtube", "soundcloud", "suno", "bandcamp", "spotify", "externo"] as const;
export type Fuente = (typeof FUENTES)[number];

export const NOMBRE_FUENTE: Record<Fuente, string> = {
  audio: "Audio propio",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  suno: "Suno",
  bandcamp: "Bandcamp",
  spotify: "Spotify",
  externo: "Enlace externo",
};

/** Fuente de un enlace pegado, o null si no hay enlace. Nunca "audio": esa sale de la subida. */
export function deducirFuente(url: string | null | undefined): Fuente | null {
  const u = url?.trim();
  if (!u) return null;
  let host: string;
  try {
    host = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "externo";
  }
  const es = (dominio: string) => host === dominio || host.endsWith(`.${dominio}`);
  if (es("youtube.com") || es("youtu.be") || es("youtube-nocookie.com")) return "youtube";
  if (es("soundcloud.com") || es("snd.sc")) return "soundcloud";
  if (es("suno.com") || es("suno.ai")) return "suno";
  if (es("bandcamp.com")) return "bandcamp";
  if (es("spotify.com")) return "spotify";
  return "externo";
}

/** "3:07" a partir de segundos; null si no hay duración. */
export function formatoDuracion(s: number | null | undefined): string | null {
  if (s == null || !Number.isFinite(s) || s < 0) return null;
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Id de un vídeo de YouTube a partir de cualquiera de sus formas de enlace. */
export function idYoutube(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1] ?? null;
}

/**
 * Reproductor embebido de las fuentes que no se controlan desde la barra
 * (§3.6): Suno y Spotify. Bandcamp no tiene uno que se pueda sacar del enlace
 * (su embed pide el id interno del álbum), así que queda en "Abrir enlace".
 *
 * Suno solo se puede incrustar con el id largo de la canción
 * (`suno.com/song/<uuid>`); los enlaces cortos `suno.com/s/…` los resuelve el
 * servidor al guardar (`lib/media/suno.ts`). Spotify sin sesión solo deja oír
 * 30 segundos.
 */
export function embedDe(fuente: Fuente | null, url: string | null | undefined): string | null {
  if (!url) return null;
  if (fuente === "suno") {
    const id = url.match(/suno\.(?:com|ai)\/(?:song|embed)\/([0-9a-f-]{36})/i)?.[1];
    return id ? `https://suno.com/embed/${id}` : null;
  }
  if (fuente === "spotify") {
    const m = url.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode)\/([\w]+)/);
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  }
  return null;
}

/** Normaliza las fuentes guardadas antes de la Fase 3 ("Local", "YouTube"…). */
export function fuenteDe(tipoFuente: string | null | undefined, url: string | null | undefined): Fuente | null {
  const t = (tipoFuente ?? "").trim().toLowerCase();
  if (t === "audio" || t === "local") return url ? "audio" : null;
  if ((FUENTES as readonly string[]).includes(t)) return t as Fuente;
  return deducirFuente(url);
}
