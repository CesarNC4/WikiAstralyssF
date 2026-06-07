import type { MetadataRoute } from "next";
import { getVisibleIds, getLoreSlugs } from "@/lib/queries/fichas";
import { ENTITY_LIST } from "@/lib/entities";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Sitemap dinámico con todas las entidades visibles (§11.3). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...ENTITY_LIST.map((e) => ({
      url: `${base}${e.route}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
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
  ] as const;

  const dynamic: MetadataRoute.Sitemap = [];
  for (const k of keys) {
    const ids = await getVisibleIds(k).catch(() => []);
    for (const id of ids) {
      dynamic.push({ url: `${base}/${k}/${id}`, changeFrequency: "monthly", priority: 0.5 });
    }
  }
  const slugs = await getLoreSlugs().catch(() => []);
  for (const slug of slugs) {
    dynamic.push({ url: `${base}/lore/${slug}`, changeFrequency: "monthly", priority: 0.5 });
  }

  return [...staticRoutes, ...dynamic];
}
