import type { MetadataRoute } from "next";

/**
 * robots.txt (§11.4). La wiki es solo para el autor y sus amigos: abierta a
 * quien tenga el enlace, pero fuera de los buscadores.
 *
 * Los buscadores pueden rastrearla A PROPÓSITO: lo que la saca de sus
 * resultados es el `noindex` (cabecera X-Robots-Tag de next.config.ts y meta
 * del layout raíz), y solo lo ven si pueden leer la página. Con `disallow: /`
 * no lo leerían, y una URL ya conocida podría seguir saliendo como enlace suelto.
 * Los rastreadores de IA no atienden `noindex`, así que a ellos se les cierra todo.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-SearchBot",
          "Claude-User",
          "anthropic-ai",
          "Google-Extended",
          "Applebot-Extended",
          "PerplexityBot",
          "CCBot",
          "Bytespider",
          "meta-externalagent",
          "Amazonbot",
        ],
        disallow: "/",
      },
    ],
  };
}
