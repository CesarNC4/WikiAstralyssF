import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

/** OG por defecto del sitio (home, índices y rutas sin imagen propia). */
export const alt = "Astralys — Wiki de fantasía";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    tipo: "Wiki",
    titulo: "Astralys",
    subtitulo: "El compendio del mundo: personajes, naciones, lore y magia.",
    acento: "#ffd66b",
  });
}
