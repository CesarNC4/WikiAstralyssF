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
 * Nombre de la primera variable que falte para poder subir, o `null` si está
 * todo. El widget lanza una excepción si le falta algo, y esa excepción sube
 * hasta el error boundary y se lleva la página entera por delante con un 500;
 * comprobándolo antes se avisa en la propia interfaz y el resto del formulario
 * sigue funcionando.
 *
 * Las tres son `NEXT_PUBLIC_` a propósito. La `api_key` de Cloudinary no es un
 * secreto: viaja en cada subida firmada desde el navegador. El que no puede
 * salir del servidor es `CLOUDINARY_API_SECRET`.
 */
export function faltaConfigSubida(): string | null {
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) return "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME";
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY) return "NEXT_PUBLIC_CLOUDINARY_API_KEY";
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) return "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET";
  return null;
}

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
