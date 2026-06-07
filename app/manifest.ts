import type { MetadataRoute } from "next";

/** Web App Manifest (§15): la wiki se puede instalar / añadir a inicio. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Astralys — Wiki de fantasía",
    short_name: "Astralys",
    description:
      "El compendio del mundo de Astralys: personajes, naciones, lore, magia y las estrellas que lo unen todo.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a14",
    theme_color: "#0a0a14",
    lang: "es",
    categories: ["entertainment", "books", "education"],
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
