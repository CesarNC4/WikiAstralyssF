"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { AtlasNodo, AtlasArista, AtlasTipo } from "@/lib/queries/atlas";

const TIPO_META: Record<AtlasTipo, { label: string; color: string; icon: string }> = {
  naciones: { label: "Naciones", color: "#7b5cff", icon: "Globe2" },
  razas: { label: "Razas", color: "#9b8cff", icon: "Rabbit" },
  bestias: { label: "Bestias", color: "#ef6f6f", icon: "PawPrint" },
  minerales: { label: "Minerales", color: "#6fc3d6", icon: "Gem" },
  organizaciones: { label: "Organizaciones", color: "#5b8def", icon: "Building2" },
};

interface Pos { x: number; y: number; }

/** Simulación force-directed determinista (se ejecuta una vez tras montar). */
function simular(nodos: AtlasNodo[], aristas: AtlasArista[]): Record<string, Pos> {
  const n = nodos.length;
  if (n === 0) return {};
  // RNG sembrado para posiciones iniciales reproducibles.
  let seed = 1337;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const idx = new Map(nodos.map((nd, i) => [nd.id, i]));
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const r = 200 + rnd() * 120;
    px[i] = Math.cos(a) * r;
    py[i] = Math.sin(a) * r;
  }
  const edges = aristas.map((e) => [idx.get(e.a)!, idx.get(e.b)!]).filter(([a, b]) => a != null && b != null);
  const iter = n > 200 ? 120 : 220;
  for (let it = 0; it < iter; it++) {
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);
    // Repulsión
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = px[i] - px[j];
        let dy = py[i] - py[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (rnd() - 0.5); dy = (rnd() - 0.5); d2 = 0.01; }
        const f = 9000 / d2;
        const d = Math.sqrt(d2);
        fx[i] += (dx / d) * f; fy[i] += (dy / d) * f;
        fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f;
      }
    }
    // Atracción por aristas
    for (const [a, b] of edges) {
      const dx = px[b] - px[a];
      const dy = py[b] - py[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 90) * 0.02;
      fx[a] += (dx / d) * f; fy[a] += (dy / d) * f;
      fx[b] -= (dx / d) * f; fy[b] -= (dy / d) * f;
    }
    // Gravedad central + integración
    const damp = 0.85;
    for (let i = 0; i < n; i++) {
      fx[i] -= px[i] * 0.012;
      fy[i] -= py[i] * 0.012;
      px[i] += Math.max(-30, Math.min(30, fx[i])) * damp;
      py[i] += Math.max(-30, Math.min(30, fy[i])) * damp;
    }
  }
  const out: Record<string, Pos> = {};
  nodos.forEach((nd, i) => { out[nd.id] = { x: px[i], y: py[i] }; });
  return out;
}

export function AtlasClient({ nodos, aristas }: { nodos: AtlasNodo[]; aristas: AtlasArista[] }) {
  const router = useRouter();
  const [activos, setActivos] = useState<Record<AtlasTipo, boolean>>({ naciones: true, razas: true, bestias: true, minerales: true, organizaciones: true });
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  // Layout determinista: misma salida en SSR y cliente (sin mismatch).
  const pos = useMemo(() => simular(nodos, aristas), [nodos, aristas]);

  const visibles = useMemo(() => new Set(nodos.filter((n) => activos[n.tipo]).map((n) => n.id)), [nodos, activos]);
  const vecinos = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    aristas.forEach((e) => { if (e.a === hover) set.add(e.b); if (e.b === hover) set.add(e.a); });
    return set;
  }, [hover, aristas]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setView((v) => ({ ...v, k: Math.max(0.3, Math.min(3, v.k * factor)) }));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, tx: drag.current!.tx + (e.clientX - drag.current!.x), ty: drag.current!.ty + (e.clientY - drag.current!.y) }));
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-base bg-deep">
      {/* Filtros */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
        {(Object.keys(TIPO_META) as AtlasTipo[]).map((t) => {
          const m = TIPO_META[t];
          const on = activos[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActivos((a) => ({ ...a, [t]: !a[t] }))}
              className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity " + (on ? "" : "opacity-40")}
              style={{ borderColor: `${m.color}66`, background: `${m.color}1a`, color: m.color }}
            >
              <Icon name={m.icon} size={12} /> {m.label}
            </button>
          );
        })}
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        <button type="button" onClick={() => setView((v) => ({ ...v, k: Math.min(3, v.k * 1.2) }))} className="grid h-7 w-7 place-items-center rounded border border-border-base bg-surface text-fg">+</button>
        <button type="button" onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k * 0.83) }))} className="grid h-7 w-7 place-items-center rounded border border-border-base bg-surface text-fg">−</button>
        <button type="button" onClick={() => setView({ k: 1, tx: 0, ty: 0 })} className="grid h-7 w-7 place-items-center rounded border border-border-base bg-surface text-fg" title="Reset"><Icon name="Compass" size={14} /></button>
      </div>

      <svg
        viewBox="-450 -350 900 700"
        className="h-[70vh] w-full cursor-grab touch-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* Aristas */}
          {aristas.map((e, i) => {
            const a = pos[e.a];
            const b = pos[e.b];
            if (!a || !b || !visibles.has(e.a) || !visibles.has(e.b)) return null;
            const activo = vecinos ? vecinos.has(e.a) && vecinos.has(e.b) : true;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#6b7280" strokeOpacity={activo ? 0.5 : 0.08} strokeWidth={activo ? 0.8 : 0.5} />;
          })}
          {/* Nodos */}
          {nodos.map((nd) => {
            if (!visibles.has(nd.id)) return null;
            const p = pos[nd.id];
            if (!p) return null;
            const m = TIPO_META[nd.tipo];
            const dim = vecinos && !vecinos.has(nd.id);
            const isHover = hover === nd.id;
            const r = nd.tipo === "naciones" ? 9 : 6;
            return (
              <g
                key={nd.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={dim ? 0.2 : 1}
                className="cursor-pointer"
                onMouseEnter={() => setHover(nd.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => router.push(nd.href)}
              >
                <circle r={r} fill={m.color} stroke={isHover ? "#fff" : `${m.color}`} strokeWidth={isHover ? 1.5 : 0.5} />
                {(isHover || nd.tipo === "naciones") && (
                  <text y={-r - 4} textAnchor="middle" className="fill-fg text-[9px]" style={{ paintOrder: "stroke", stroke: "#0b0b12", strokeWidth: 2 }}>
                    {nd.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <p className="border-t border-border-base px-4 py-2 text-xs text-fg-muted">
        Arrastra para mover · rueda para zoom · pasa el ratón para resaltar relaciones · clic para visitar.
      </p>
    </div>
  );
}
