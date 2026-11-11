/**
 * La dirección de la wiki, para los enlaces absolutos (avisos a Discord, RSS,
 * metadatos para compartir).
 *
 * En Vercel nunca es `localhost`: si `NEXT_PUBLIC_SITE_URL` falta o lleva la del
 * equipo del autor (se copió de `.env.local`), se usa el dominio de producción que
 * da Vercel. Pasó el 2026-11-11: los avisos enlazaban a `localhost:3000`.
 */
const WIKI_PUBLICADA = "https://wiki-astralyss-f.vercel.app";
const ES_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

const limpia = (u: string | undefined) => (u ?? "").trim().replace(/\/+$/, "");

/**
 * La web publicada. Para lo que sale de la wiki, como los avisos a Discord: un
 * enlace a `localhost` no le sirve a ningún jugador, así que tampoco se usa en el
 * equipo del autor.
 */
export function urlPublicada(): string {
  const propia = limpia(process.env.NEXT_PUBLIC_SITE_URL);
  if (propia && !ES_LOCAL.test(propia)) return propia;
  const vercel = limpia(process.env.VERCEL_PROJECT_PRODUCTION_URL).replace(/^https?:\/\//, "");
  return vercel ? `https://${vercel}` : WIKI_PUBLICADA;
}

/** Esta web: la publicada en Vercel; en el equipo del autor, la de `.env.local` o localhost. */
export function urlDelSitio(): string {
  if (process.env.VERCEL) return urlPublicada();
  return limpia(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000";
}
