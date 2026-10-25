import type { MetadataRoute } from "next";
import { getActosVisibles, getVisibleIds, getLoreSlugs } from "@/lib/queries/fichas";
import { getVisibleRegionIds, getVisibleLocacionIds } from "@/lib/queries/mapa";
import { ENTITY_LIST } from "@/lib/entities";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Sitemap dinámico con todas las entidades visibles (§11.3). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...ENTITY_LIST.filter((e) => !e.sinSeccion).map((e) => ({
      url: `${base}${e.route}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // Submenú de la cronología (spec del taller §13).
    { url: `${base}/timeline/calendario`, changeFrequency: "weekly", priority: 0.6 },
  ];

  const keys = [
    "personajes",
    "naciones",
    "organizaciones",
    "familias",
    "razas",
    "bestias",
    "minerales",
    "conceptos",
    "magia",
    "misiones",
    "demonios",
    "artefactos",
    "capitulos",
    "arcos",
    "canciones",
  ] as const;

  const dynamic: MetadataRoute.Sitemap = [];
  for (const k of keys) {
    const ids = await getVisibleIds(k).catch(() => []);
    for (const id of ids) {
      dynamic.push({ url: `${base}/${k}/${id}`, changeFrequency: "monthly", priority: 0.5 });
    }
  }
  // Los actos viven dentro de su capítulo (spec del taller §4).
  for (const p of await getActosVisibles().catch(() => [])) {
    dynamic.push({ url: `${base}/capitulos/${p.capituloId}/actos/${p.actoId}`, changeFrequency: "monthly", priority: 0.4 });
  }
  const slugs = await getLoreSlugs().catch(() => []);
  for (const slug of slugs) {
    dynamic.push({ url: `${base}/lore/${slug}`, changeFrequency: "monthly", priority: 0.5 });
  }

  const [regionIds, locacionIds] = await Promise.all([
    getVisibleRegionIds().catch(() => []),
    getVisibleLocacionIds().catch(() => []),
  ]);
  for (const id of regionIds) dynamic.push({ url: `${base}/regiones/${id}`, changeFrequency: "monthly", priority: 0.4 });
  for (const id of locacionIds) dynamic.push({ url: `${base}/locaciones/${id}`, changeFrequency: "monthly", priority: 0.4 });

  return [...staticRoutes, ...dynamic];
}
