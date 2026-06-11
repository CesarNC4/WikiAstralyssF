"use client";

import { useEffect, useRef } from "react";

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/**
 * Campo de partículas reactivo al cursor (§ punto 13). Canvas ligero sin
 * dependencias: las partículas derivan, se conectan en constelaciones y huyen
 * del ratón. Respeta prefers-reduced-motion.
 */
export function ParticleField({ color = "139,123,255", density = 0.00008 }: { color?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let parts: P[] = [];
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      w = rect?.width ?? window.innerWidth;
      h = rect?.height ?? window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.max(36, Math.min(140, Math.floor(w * h * density)));
      parts = Array.from({ length: target }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.15 - Math.random() * 0.35,
        r: 0.6 + Math.random() * 1.8,
      }));
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const step = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        // Repulsión del cursor.
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) {
          const f = (1 - Math.sqrt(d2) / 120) * 0.6;
          p.vx += (dx / (Math.sqrt(d2) || 1)) * f;
          p.vy += (dy / (Math.sqrt(d2) || 1)) * f;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 - 0.02; // leve flotación hacia arriba
        // Reaparece por abajo al salir.
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},0.6)`;
        ctx.fill();
      }
      // Líneas de constelación.
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i];
          const b = parts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 110 * 110) {
            ctx.strokeStyle = `rgba(${color},${0.12 * (1 - Math.sqrt(d2) / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(step);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    if (!reduce) raf = requestAnimationFrame(step);
    else step(); // un frame estático

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [color, density]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
