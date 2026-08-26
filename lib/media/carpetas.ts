/**
 * Carpetas de Cloudinary donde aterrizan las imágenes de la wiki.
 *
 * Client-safe a propósito (sin `server-only`): lo usan el widget de subida, que
 * corre en el navegador, y la ruta que firma esa subida, que corre en el
 * servidor. Ambos deben calcular la MISMA carpeta o la firma no cubriría la
 * carpeta real y Cloudinary rechazaría la subida.
 */

export const CARPETA_RAIZ = "astralys";

/** Endpoint que firma las subidas. Cliente y servidor deben apuntar al mismo. */
export const RUTA_FIRMA = "/api/cloudinary/firma";

/**
 * `astralys/personajes` para la imagen principal y el banner de una ficha,
 * `astralys/personajes/galeria` para las imágenes de su galería.
 *
 * Se separa la galería porque es de muchos a uno: una ficha tiene una imagen
 * principal pero puede tener docenas de imágenes de galería, y mezclarlas hace
 * inmanejable la vista de Cloudinary.
 */
export function carpetaDe(entidad: string, rol: "principal" | "galeria" = "principal"): string {
  const limpia = entidad
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = `${CARPETA_RAIZ}/${limpia || "otros"}`;
  return rol === "galeria" ? `${base}/galeria` : base;
}

/** Forma que debe tener una carpeta gestionada por la wiki. */
const CARPETA_VALIDA = new RegExp(`^${CARPETA_RAIZ}/[a-z0-9_-]+(/galeria)?$`);

/**
 * La ruta de firma rechaza cualquier carpeta que no case con esto. Es defensa
 * en profundidad: aunque alguien se hiciera con una sesión de admin, no podría
 * usar la firma para colar archivos en cualquier rincón de la cuenta.
 */
export function esCarpetaValida(folder: unknown): folder is string {
  return typeof folder === "string" && CARPETA_VALIDA.test(folder);
}
