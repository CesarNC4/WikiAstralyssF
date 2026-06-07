import { ImageResponse } from "next/og";

/** Favicon generado (§11): estrella dorada sobre degradado cósmico. */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
        <svg width="42" height="42" viewBox="0 0 24 24" fill="#ffd66b">
          <path d="M12 2l2.2 6.6L21 9.3l-5.2 4.1L17.6 21 12 16.9 6.4 21l1.8-7.6L3 9.3l6.8-.7z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
