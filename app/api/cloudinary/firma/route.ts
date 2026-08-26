import { adminActual } from "@/lib/auth/admin";
import { cloudinaryListo, firmarParams } from "@/lib/cloudinary";
import { esCarpetaValida } from "@/lib/media/carpetas";

/**
 * Firma las subidas del widget de Cloudinary.
 *
 * El widget hace `POST` aquí con `{ paramsToSign }` y espera `{ signature }`
 * de vuelta (contrato de `@cloudinary-util/url-loader`).
 *
 * Por qué existe: con un preset *unsigned* la clave del preset viaja en el
 * bundle de JavaScript, así que cualquiera que abra la web puede subir archivos
 * a la cuenta. Firmando en el servidor, solo sube quien ha pasado por el login
 * del admin.
 *
 * `proxy.ts` solo cubre `/admin/:path*`, o sea que esta ruta NO está protegida
 * por él: se defiende ella sola con `adminActual()`.
 */
export async function POST(request: Request) {
  if (!(await adminActual())) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!cloudinaryListo()) {
    return Response.json(
      { error: "Faltan CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET en el servidor." },
      { status: 500 },
    );
  }

  let paramsToSign: Record<string, unknown>;
  try {
    const body = (await request.json()) as { paramsToSign?: Record<string, unknown> };
    if (!body?.paramsToSign || typeof body.paramsToSign !== "object") throw new Error();
    paramsToSign = body.paramsToSign;
  } catch {
    return Response.json({ error: "Se esperaba { paramsToSign }." }, { status: 400 });
  }

  if (!esCarpetaValida(paramsToSign.folder)) {
    return Response.json(
      { error: `Carpeta no permitida: ${String(paramsToSign.folder)}` },
      { status: 400 },
    );
  }

  return Response.json({ signature: firmarParams(paramsToSign) });
}
