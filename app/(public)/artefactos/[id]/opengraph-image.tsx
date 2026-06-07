import { getOgFicha } from "@/lib/queries/og";
import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Artefacto de Astralys";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getOgFicha("artefactos", Number(id));
  return renderOgImage(d ?? { tipo: "Artefacto", titulo: "Astralys" });
}
