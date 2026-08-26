import { ImageResponse } from "next/og";

/**
 * Iconos grandes para el manifest (/icono/192 y /icono/512).
 *
 * `app/icon.tsx` genera 64x64 y `apple-icon.tsx` 180x180, pero para que el
 * navegador ofrezca *instalar* la wiki el manifest necesita al menos un icono de
 * 192 y otro de 512. Se generan aquí en vez de duplicar PNGs en `public/`.
 */
const TAMANOS = new Set(["192", "512"]);

export function generateStaticParams() {
  return [...TAMANOS].map((px) => ({ px }));
}

export const contentType = "image/png";

export async function GET(_req: Request, { params }: { params: Promise<{ px: string }> }) {
  const { px } = await params;
  if (!TAMANOS.has(px)) return new Response("No encontrado", { status: 404 });
  const n = Number(px);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 35%, #7b5cff 0%, #12121f 75%)",
        }}
      >
        <svg width={n * 0.66} height={n * 0.66} viewBox="0 0 24 24" fill="#ffd66b">
          <path d="M12 2l2.2 6.6L21 9.3l-5.2 4.1L17.6 21 12 16.9 6.4 21l1.8-7.6L3 9.3l6.8-.7z" />
        </svg>
      </div>
    ),
    { width: n, height: n },
  );
}
