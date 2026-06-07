import { getOgLore } from "@/lib/queries/og";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Crónica de Astralys";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getOgLore(slug);
  return renderOgImage(d ?? { tipo: "Lore", titulo: "Astralys" });
}
