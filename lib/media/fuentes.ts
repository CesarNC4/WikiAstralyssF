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

/** Normaliza las fuentes guardadas antes de la Fase 3 ("Local", "YouTube"…). */
export function fuenteDe(tipoFuente: string | null | undefined, url: string | null | undefined): Fuente | null {
  const t = (tipoFuente ?? "").trim().toLowerCase();
  if (t === "audio" || t === "local") return url ? "audio" : null;
  if ((FUENTES as readonly string[]).includes(t)) return t as Fuente;
  return deducirFuente(url);
}
