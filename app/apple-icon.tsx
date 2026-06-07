import { ImageResponse } from "next/og";

/** Apple touch icon (§11, §15): estrella sobre fondo cósmico, esquinas suaves. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 32%, #7b5cff 0%, #0a0a14 78%)",
        }}
      >
        <svg width="118" height="118" viewBox="0 0 24 24" fill="#ffd66b">
          <path d="M12 2l2.2 6.6L21 9.3l-5.2 4.1L17.6 21 12 16.9 6.4 21l1.8-7.6L3 9.3l6.8-.7z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
