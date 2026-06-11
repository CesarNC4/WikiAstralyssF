"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAPA_IMG, MAPA_W, MAPA_H } from "@/lib/mapa";

export interface MiniPoly {
  points: [number, number][];
  color?: string;
  href?: string;
  label?: string;
  /** Polígono protagonista (resaltado) vs. contexto. */
  focus?: boolean;
}
export interface MiniPin {
  x: number;
  y: number;
  color?: string;
  href?: string;
  label?: string;
  big?: boolean;
}

const px = (nx: number) => nx * MAPA_W;
const py = (ny: number) => ny * MAPA_H;

/**
 * Mini-mapa SVG ligero (§ puntos 3-4): recorta la imagen del mundo al territorio
 * relevante y dibuja polígonos y pines. Sin Leaflet — barato y server-friendly.
 */
export function MiniMapa({
  focusPoly,
  focusPoint,
  polygons = [],
  pins = [],
  height = 300,
}: {
  focusPoly?: [number, number][] | null;
  focusPoint?: [number, number] | null;
  polygons?: MiniPoly[];
  pins?: MiniPin[];
  height?: number;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  // Bounding box (normalizado) del foco.
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  const acc = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  (focusPoly ?? []).forEach(([x, y]) => acc(x, y));
  if (focusPoint) acc(focusPoint[0], focusPoint[1]);
  if (minX > maxX) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }

  // Padding alrededor del foco; mínimo razonable para un punto.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const half = Math.max(spanX, spanY, 0.18) / 2;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pad = half * 0.9 + 0.03;
  const x0 = Math.max(0, cx - half - pad);
  const y0 = Math.max(0, cy - half - pad);
  const x1 = Math.min(1, cx + half + pad);
  const y1 = Math.min(1, cy + half + pad);
  const vb = `${px(x0)} ${py(y0)} ${px(x1 - x0)} ${py(y1 - y0)}`;

  const nav = (href?: string | null) => href && router.push(href);
  const allPolys = [...polygons].sort((a, b) => Number(a.focus) - Number(b.focus));

  return (
    <div className="overflow-hidden rounded-2xl border border-border-glow bg-[#0a0a14]" style={{ height }}>
      <svg viewBox={vb} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <image href={MAPA_IMG} x={0} y={0} width={MAPA_W} height={MAPA_H} opacity={0.82} />
        <rect x={0} y={0} width={MAPA_W} height={MAPA_H} fill="#0a0a14" opacity={0.28} />

        {allPolys.map((p, i) => {
          if (p.points.length < 3) return null;
          const color = p.color ?? (p.focus ? "#7b5cff" : "#2dd4bf");
          const id = `poly-${i}`;
          const on = hover === id;
          return (
            <polygon
              key={id}
              points={p.points.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")}
              fill={color}
              fillOpacity={p.focus ? (on ? 0.34 : 0.22) : on ? 0.18 : 0.06}
              stroke={color}
              strokeWidth={(p.focus ? 3 : 2) * (MAPA_W / 900)}
              strokeDasharray={p.focus ? undefined : `${8 * (MAPA_W / 900)}`}
              style={{ cursor: p.href ? "pointer" : "default" }}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover((h) => (h === id ? null : h))}
              onClick={() => nav(p.href)}
            >
              {p.label && <title>{p.label}</title>}
            </polygon>
          );
        })}

        {pins.map((pin, i) => {
          const id = `pin-${i}`;
          const r = (pin.big ? 11 : 8) * (MAPA_W / 900);
          const color = pin.color ?? "#2dd4bf";
          return (
            <g
              key={id}
              style={{ cursor: pin.href ? "pointer" : "default" }}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover((h) => (h === id ? null : h))}
              onClick={() => nav(pin.href)}
            >
              <circle cx={px(pin.x)} cy={py(pin.y)} r={r + 4 * (MAPA_W / 900)} fill={color} opacity={hover === id ? 0.35 : 0.18} />
              <circle cx={px(pin.x)} cy={py(pin.y)} r={r} fill={color} stroke="#0a0a14" strokeWidth={2 * (MAPA_W / 900)} />
              {pin.label && <title>{pin.label}</title>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
