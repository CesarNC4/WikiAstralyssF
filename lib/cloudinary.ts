import "server-only";
import { createHash } from "node:crypto";

/**
 * Cloudinary del lado servidor: firmar subidas y borrar assets.
 *
 * Hecho a mano con `node:crypto` + `fetch` en vez de con el paquete
 * `cloudinary`. Son treinta líneas y ahorra una dependencia de servidor entera
 * (con sus scripts de instalación) para usar dos endpoints.
 *
 * El algoritmo de firma de Cloudinary: coges los parámetros, los ordenas
 * alfabéticamente, los unes como `clave=valor&clave=valor`, le concatenas el
 * api_secret al final y sacas el SHA-1 en hexadecimal.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/** Sin las tres variables no se puede ni firmar ni borrar. */
export function cloudinaryListo(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

/** Estos nunca entran en la firma: los añade Cloudinary o van aparte. */
const FUERA_DE_FIRMA = new Set(["file", "cloud_name", "resource_type", "api_key"]);

export function firmarParams(params: Record<string, unknown>): string {
  if (!API_SECRET) throw new Error("CLOUDINARY_API_SECRET no está configurada.");
  const cadena = Object.keys(params)
    .filter((k) => !FUERA_DE_FIRMA.has(k))
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join("&");
  return createHash("sha1").update(cadena + API_SECRET).digest("hex");
}

/**
 * Borra un asset de Cloudinary para que deje de ocupar cuota.
 *
 * Devuelve `true` también cuando Cloudinary responde `not found`: el objetivo
 * (que el archivo no siga ahí) se cumple igual, y así un asset borrado a mano
 * desde la Media Library no bloquea la limpieza de su fila en la base.
 */
export async function borrarDeCloudinary(publicId: string): Promise<boolean> {
  if (!cloudinaryListo()) return false;
  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY as string,
    signature: firmarParams({ public_id: publicId, timestamp }),
  });
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { result?: string };
    return json.result === "ok" || json.result === "not found";
  } catch {
    return false;
  }
}
