import { ImageResponse } from "next/og";

/**
 * Generación de imágenes Open Graph (§11). Diseño "split imagen + texto":
 * la imagen de la entidad a la izquierda, panel de texto cósmico a la derecha.
 * Una sola implementación que reutilizan todas las fichas vía su opengraph-image.tsx.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BRAND = "astralys.wiki";

// Tokens del design system (§7.1) — duplicados aquí porque Satori no lee CSS vars.
const VOID = "#0a0a14";
const DEEP = "#12121f";
const PRIMARY = "#7b5cff";
const ACCENT = "#ffd66b";
const TEXT = "#f5f3ff";
const TEXT_SECONDARY = "#b8b5d1";
const TEXT_MUTED = "#7a7895";

/**
 * Carga una fuente de Google Fonts como ArrayBuffer (formato TTF, que Satori sí
 * parsea). Se fuerza TTF con un User-Agent antiguo y se subsetea con `text`.
 */
async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url =
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}` +
      `&text=${encodeURIComponent(text)}`;
    const css = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SatoriFontLoader/1.0)" },
    }).then((r) => r.text());
    const src = css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
    if (!src) return null;
    return await fetch(src).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export interface OgInput {
  /** Etiqueta del tipo de entidad (PERSONAJE, NACIÓN, …). */
  tipo: string;
  titulo: string;
  subtitulo?: string | null;
  /** URL de la imagen de la entidad (Cloudinary u otra). */
  imagenUrl?: string | null;
  /** Color de acento (hex) para la barra/tipo; default violeta primario. */
  acento?: string;
}

const Star = ({ size = 40, color = ACCENT }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l2.2 6.6L21 9.3l-5.2 4.1L17.6 21 12 16.9 6.4 21l1.8-7.6L3 9.3l6.8-.7z" />
  </svg>
);

/** Construye la ImageResponse de una ficha. */
export async function renderOgImage(input: OgInput): Promise<ImageResponse> {
  const { tipo, titulo, subtitulo, imagenUrl, acento = PRIMARY } = input;
  const glyphs = `${tipo}${titulo}${subtitulo ?? ""}${BRAND}ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyz0123456789·,.'’-—`;

  const [cinzel, inter, interBold] = await Promise.all([
    loadGoogleFont("Cinzel", 700, glyphs),
    loadGoogleFont("Inter", 400, glyphs),
    loadGoogleFont("Inter", 600, glyphs),
  ]);

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 700 | 600; style: "normal" }[] = [];
  if (cinzel) fonts.push({ name: "Cinzel", data: cinzel, weight: 700, style: "normal" });
  if (inter) fonts.push({ name: "Inter", data: inter, weight: 400, style: "normal" });
  if (interBold) fonts.push({ name: "Inter", data: interBold, weight: 600, style: "normal" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: VOID,
          fontFamily: "Inter",
        }}
      >
        {/* Columna imagen */}
        <div style={{ display: "flex", width: 470, height: "100%", position: "relative" }}>
          {imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagenUrl} alt="" width={470} height={630} style={{ objectFit: "cover", width: 470, height: 630 }} />
          ) : (
            <div
              style={{
                display: "flex",
                width: 470,
                height: 630,
                alignItems: "center",
                justifyContent: "center",
                background: `radial-gradient(circle at 50% 40%, ${acento}55, ${DEEP} 70%)`,
              }}
            >
              <Star size={120} color={acento} />
            </div>
          )}
          {/* Degradado de unión imagen→panel */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 160,
              height: 630,
              background: `linear-gradient(90deg, rgba(10,10,20,0), ${VOID})`,
            }}
          />
        </div>

        {/* Columna texto */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            height: "100%",
            padding: "64px 72px",
            justifyContent: "center",
            background: `radial-gradient(circle at 80% 0%, ${PRIMARY}22, ${VOID} 60%)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <Star size={28} color={acento} />
            <span style={{ fontSize: 26, letterSpacing: 6, color: acento, fontWeight: 600 }}>
              {tipo.toUpperCase()}
            </span>
          </div>
          <div
            style={{
              fontFamily: "Cinzel",
              fontWeight: 700,
              fontSize: titulo.length > 22 ? 64 : 80,
              lineHeight: 1.05,
              color: TEXT,
            }}
          >
            {titulo}
          </div>
          {subtitulo ? (
            <div style={{ marginTop: 22, fontSize: 32, color: TEXT_SECONDARY, lineHeight: 1.25 }}>
              {subtitulo}
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: "auto", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 3, background: acento }} />
            <span style={{ fontSize: 24, color: TEXT_MUTED, letterSpacing: 2 }}>{BRAND}</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  );
}
