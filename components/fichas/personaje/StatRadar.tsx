"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface RadarStat {
  label: string;
  value: number | null;
}

/** Radar/hexágono de atributos con paralaje 3D reactivo al cursor (§ punto 2). */
export function StatRadar({ stats, max = 20, color = "var(--color-primary, #8b7bff)" }: { stats: RadarStat[]; max?: number; color?: string }) {
  const data = stats.map((s) => ({ label: s.label, value: Math.max(0, s.value ?? 0) }));
  const ref = useRef<HTMLDivElement>(null);

  // Inclinación 3D suave siguiendo el mouse.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 18 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 18 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;
  const n = data.length || 6;
  const angleAt = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const point = (i: number, r: number) => {
    const a = angleAt(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const ringPath = (f: number) =>
    data.map((_, i) => point(i, R * f).join(",")).join(" ");
  const valuePath = data.map((d, i) => point(i, R * Math.min(1, d.value / max)).join(",")).join(" ");

  if (data.length === 0) return null;

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className="mx-auto"
      style={{ perspective: 800, width: size, maxWidth: "100%" }}
    >
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
      >
        {/* Anillos de la rejilla */}
        {rings.map((f) => (
          <polygon key={f} points={ringPath(f)} fill="none" stroke="rgba(255,255,255,0.08)" />
        ))}
        {/* Ejes */}
        {data.map((_, i) => {
          const [x, y] = point(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />;
        })}
        {/* Área de valores */}
        <motion.polygon
          points={valuePath}
          fill={color}
          fillOpacity={0.22}
          stroke={color}
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "center" }}
        />
        {/* Vértices */}
        {data.map((d, i) => {
          const [x, y] = point(i, R * Math.min(1, d.value / max));
          return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
        })}
        {/* Etiquetas */}
        {data.map((d, i) => {
          const [x, y] = point(i, R + 22);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--color-fg-muted,#9aa)] font-medium"
              style={{ fontSize: 10 }}
            >
              <tspan x={x} dy="-0.3em">{d.label}</tspan>
              <tspan x={x} dy="1.2em" className="fill-[var(--color-fg,#eee)]" style={{ fontSize: 11 }}>
                {d.value}
              </tspan>
            </text>
          );
        })}
      </motion.svg>
    </div>
  );
}
