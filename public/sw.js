/*
 * Service worker de Astralys. Escrito a mano a propósito: `next-pwa` lleva sin
 * mantenerse desde 2022 y es un plugin de webpack, mientras que Next 16 compila
 * con Turbopack. Son cincuenta líneas y así no entra una dependencia muerta.
 *
 * Estrategia:
 *   · estáticos de /_next/static  -> cache-first (llevan hash en el nombre)
 *   · páginas                     -> network-first con la caché como red de
 *                                    seguridad si no hay conexión
 *   · /admin y /api               -> NUNCA se tocan (llevan sesión)
 */
const VERSION = "astralys-v1";
const ESTATICOS = VERSION + "-estaticos";
const PAGINAS = VERSION + "-paginas";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      // Fuera las cachés de versiones anteriores.
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(peticion, deposito) {
  const guardada = await caches.match(peticion);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (respuesta.ok) (await caches.open(deposito)).put(peticion, respuesta.clone());
  return respuesta;
}

async function networkFirst(peticion, deposito) {
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) (await caches.open(deposito)).put(peticion, respuesta.clone());
    return respuesta;
  } catch (e) {
    const guardada = await caches.match(peticion);
    if (guardada) return guardada;
    throw e;
  }
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  // Sólo el propio origen: las imágenes de Cloudinary ya viajan con caché larga
  // y guardarlas aquí daría respuestas opacas de tamaño impredecible.
  if (url.origin !== self.location.origin) return;
  // El panel y las APIs dependen de la sesión: servirlos desde caché podría
  // enseñar datos de admin a quien no toca.
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api")) return;

  const esEstatico = url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/fonts");
  evento.respondWith(esEstatico ? cacheFirst(peticion, ESTATICOS) : networkFirst(peticion, PAGINAS));
});
