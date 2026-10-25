import "server-only";

/**
 * Los enlaces cortos de Suno (`suno.com/s/<código>`, los de "Compartir") no se
 * pueden incrustar: el reproductor embebido pide el id largo de la canción.
 * Suno los redirige a `suno.com/song/<uuid>`, así que al guardar se sigue esa
 * redirección y se guarda el enlace largo. Si Suno no responde, se deja el
 * enlace tal cual: la canción seguirá teniendo su botón "Abrir en Suno".
 */
export async function resolverEnlaceSuno(url: string): Promise<string> {
  if (!/^https?:\/\/(www\.)?suno\.(com|ai)\/s\//i.test(url)) return url;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000) });
    const destino = res.headers.get("location");
    const id = destino?.match(/\/song\/([0-9a-f-]{36})/i)?.[1];
    return id ? `https://suno.com/song/${id}` : url;
  } catch {
    return url;
  }
}
