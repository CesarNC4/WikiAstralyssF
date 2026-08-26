import { getPublicacionesRecientes } from "@/lib/queries/feed";
import { ENTITIES, type EntityKey } from "@/lib/entities";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Escapa lo que va dentro de un nodo XML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Feed RSS de las últimas entidades publicadas (/feed.xml).
 *
 * Se revalida cada hora, en la misma línea que el ISR del resto de la wiki: un
 * lector de feeds consulta con frecuencia y no tiene sentido pegarle a la base
 * en cada visita.
 */
export const revalidate = 3600;

export async function GET() {
  const items = await getPublicacionesRecientes(30).catch(() => []);
  const ahora = new Date().toUTCString();

  const entradas = items
    .map((i) => {
      const enlace = `${base}${i.url}`;
      const seccion = ENTITIES[i.tipo as EntityKey]?.singular ?? i.tipo;
      return [
        "    <item>",
        `      <title>${esc(i.titulo)}</title>`,
        `      <link>${esc(enlace)}</link>`,
        `      <guid isPermaLink="true">${esc(enlace)}</guid>`,
        `      <category>${esc(seccion)}</category>`,
        `      <pubDate>${i.publicadoEn.toUTCString()}</pubDate>`,
        i.resumen ? `      <description>${esc(i.resumen)}</description>` : "",
        i.imagenUrl ? `      <enclosure url="${esc(i.imagenUrl)}" type="image/jpeg" />` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Astralys — Novedades</title>",
    `    <link>${esc(base)}</link>`,
    "    <description>Últimas fichas y páginas de lore publicadas en la wiki de Astralys.</description>",
    "    <language>es</language>",
    `    <lastBuildDate>${ahora}</lastBuildDate>`,
    `    <atom:link href="${esc(base)}/feed.xml" rel="self" type="application/rss+xml" />`,
    entradas,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
