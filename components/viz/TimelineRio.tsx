"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { Icon } from "@/components/Icon";
import { ParticleField } from "@/components/viz/ParticleField";
import type { TimelineEventoPublico } from "@/lib/queries/extra";

type Ev = TimelineEventoPublico;

const CATEGORIAS: Record<string, { color: string; icon: string }> = {
  Magico: { color: "#8b7bff", icon: "Sparkles" },
  Mágico: { color: "#8b7bff", icon: "Sparkles" },
  Politico: { color: "#5b8def", icon: "Landmark" },
  Político: { color: "#5b8def", icon: "Landmark" },
  Militar: { color: "#f87171", icon: "Swords" },
  Cosmico: { color: "#2dd4bf", icon: "Star" },
  Cósmico: { color: "#2dd4bf", icon: "Star" },
  Otro: { color: "#9aa3b2", icon: "Circle" },
};
const catMeta = (c: string | null) => (c && CATEGORIAS[c]) || { color: "#9aa3b2", icon: "Circle" };

const SPACING_MINOR = 130;
const SPACING_MAJOR = 180;
const ERA_GAP = 120;
const TOP = 70;

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x},${pts[0].y}` : "";
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Cronología "río del tiempo" (§ punto 13): serpiente viva, partículas y parallax. */
export function TimelineRio({ eventos }: { eventos: Ev[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const narrow = width > 0 && width < 640;
  const [sel, setSel] = useState<Ev | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [soloMayor, setSoloMayor] = useState(false);

  // Parallax suave del río siguiendo el cursor.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18 });
  const sy = useSpring(py, { stiffness: 60, damping: 18 });

  useEffect(() => {
    const measure = () => setWidth(wrapRef.current?.clientWidth ?? 0);
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onMove = (e: MouseEvent) => {
      px.set((e.clientX / window.innerWidth - 0.5) * 22);
      py.set((e.clientY / window.innerHeight - 0.5) * 16);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, [px, py]);

  const categorias = useMemo(
    () => [...new Set(eventos.map((e) => e.categoria).filter((x): x is string => !!x))],
    [eventos],
  );
  const hasEras = useMemo(() => eventos.some((e) => e.era && e.era.trim()), [eventos]);

  const { items, totalH, points } = useMemo(() => {
    const out: (
      | { kind: "era"; y: number; label: string; key: string }
      | { kind: "event"; y: number; xPct: number; ev: Ev; key: string }
    )[] = [];
    const pts: { xPct: number; y: number }[] = [];
    const amp = narrow ? 22 : 32;
    let y = TOP;
    let prevEra: string | null | undefined = undefined;
    let idx = 0;
    for (const ev of eventos) {
      const era = ev.era ?? null;
      if (hasEras && era !== prevEra) {
        if (out.length) y += ERA_GAP;
        out.push({ kind: "era", y, label: era ?? "Tiempos sin nombre", key: `era-${era ?? idx}` });
        prevEra = era;
        y += 48;
      }
      const xPct = 50 + amp * Math.sin(idx * 0.85);
      out.push({ kind: "event", y, xPct, ev, key: `ev-${ev.id}` });
      pts.push({ xPct, y });
      y += ev.importancia === "Mayor" ? SPACING_MAJOR : SPACING_MINOR;
      idx++;
    }
    return { items: out, totalH: y + 80, points: pts };
  }, [eventos, narrow, hasEras]);

  const pathD = useMemo(() => {
    if (width === 0) return "";
    return smoothPath(points.map((p) => ({ x: (p.xPct / 100) * width, y: p.y })));
  }, [points, width]);

  const visible = (ev: Ev) => (!cat || ev.categoria === cat) && (!soloMayor || ev.importancia === "Mayor");

  return (
    <div className="relative">
      {/* Filtros */}
      <div className="sticky top-14 z-30 mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border-base bg-deep/70 p-2 backdrop-blur-xl">
        <Chip active={!cat} onClick={() => setCat(null)}>Todo</Chip>
        {categorias.map((c) => (
          <Chip key={c} active={cat === c} color={catMeta(c).color} icon={catMeta(c).icon} onClick={() => setCat(cat === c ? null : c)}>
            {c}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-border-base" />
        <Chip active={soloMayor} color="#e0b34a" icon="Star" onClick={() => setSoloMayor((v) => !v)}>
          Solo mayores
        </Chip>
      </div>

      <div ref={wrapRef} className="relative overflow-hidden rounded-3xl border border-border-glow bg-gradient-to-b from-deep to-void">
        <ParticleField />

        <motion.div style={{ x: sx, y: sy }} className="relative" >
          <div className="relative" style={{ height: totalH }}>
            {/* Río SVG */}
            {pathD && (
              <svg className="pointer-events-none absolute inset-0" width={width} height={totalH} style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="rio-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b7bff" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#8b7bff" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <path d={pathD} fill="none" stroke="#1c2030" strokeWidth={18} strokeLinecap="round" />
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke="url(#rio-grad)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2.2, ease: "easeInOut" }}
                />
              </svg>
            )}

            {/* Marcadores de era */}
            {items.map((it) =>
              it.kind === "era" ? (
                <div key={it.key} className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: it.y }}>
                  <div className="flex items-center gap-2 rounded-full border border-border-glow bg-void/80 px-4 py-1.5 backdrop-blur">
                    <Icon name="Clock" size={13} className="text-secondary" />
                    <span className="font-display text-sm uppercase tracking-[0.18em] text-fg-secondary">{it.label}</span>
                  </div>
                </div>
              ) : null,
            )}

            {/* Nodos de evento */}
            {items.map((it) => {
              if (it.kind !== "event") return null;
              const ev = it.ev;
              const meta = catMeta(ev.categoria);
              const mayor = ev.importancia === "Mayor";
              const vis = visible(ev);
              // En la mitad derecha, la tarjeta va hacia el centro (izquierda) y viceversa.
              const cardLeft = it.xPct >= 50;
              return (
                <div
                  key={it.key}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${it.xPct}%`, top: it.y, opacity: vis ? 1 : 0.18, pointerEvents: vis ? "auto" : "none", transition: "opacity .3s" }}
                >
                  <div className="relative">
                    <NodoPulso color={meta.color} mayor={mayor} onClick={() => setSel(ev)} icon={meta.icon} />
                    <button
                      onClick={() => setSel(ev)}
                      className={`absolute top-1/2 w-[40vw] -translate-y-1/2 sm:w-[220px] ${cardLeft ? "right-full mr-3 text-right" : "left-full ml-3 text-left"}`}
                    >
                      <p className="font-mono text-[11px]" style={{ color: meta.color }}>{ev.fechaLore}</p>
                      <p className={`font-display leading-tight text-fg ${mayor ? "text-base" : "text-sm"}`}>{ev.titulo}</p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Panel de detalle */}
      <AnimatePresence>
        {sel && <DetallePanel ev={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}

function NodoPulso({ color, mayor, icon, onClick }: { color: string; mayor: boolean; icon: string; onClick: () => void }) {
  const size = mayor ? 22 : 14;
  return (
    <motion.button
      onClick={onClick}
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 ${mayor ? 22 : 12}px ${color}` }}
      whileHover={{ scale: 1.35 }}
      animate={{ scale: [1, 1.12, 1] }}
      transition={{ scale: { duration: mayor ? 2.4 : 3.2, repeat: Infinity, ease: "easeInOut" } }}
      aria-label="Ver evento"
    >
      {mayor && <Icon name={icon} size={11} className="text-void" />}
    </motion.button>
  );
}

function DetallePanel({ ev, onClose }: { ev: Ev; onClose: () => void }) {
  const meta = catMeta(ev.categoria);
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[90] bg-void/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed inset-x-0 bottom-0 z-[91] max-h-[80vh] overflow-y-auto rounded-t-3xl border border-border-glow bg-deep p-6 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-l-3xl sm:rounded-tr-none"
        initial={{ y: "100%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      >
        <button onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-border-base text-fg-muted hover:text-fg">
          <Icon name="X" size={16} />
        </button>
        <p className="font-mono text-sm" style={{ color: meta.color }}>{ev.fechaLore}</p>
        <h2 className="mt-1 font-display text-2xl text-fg">{ev.titulo}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ev.era && <span className="rounded-full border border-border-base px-2.5 py-0.5 text-xs text-fg-muted">{ev.era}</span>}
          {ev.categoria && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs" style={{ background: `${meta.color}1f`, color: meta.color }}>
              <Icon name={meta.icon} size={11} /> {ev.categoria}
            </span>
          )}
          {ev.importancia && <span className="rounded-full border border-accent/40 px-2.5 py-0.5 text-xs text-accent">{ev.importancia}</span>}
        </div>
        {ev.descripcion && <p className="mt-4 whitespace-pre-line leading-relaxed text-fg-secondary">{ev.descripcion}</p>}

        {(ev.capitulo || ev.locacion) && (
          <div className="mt-6 space-y-2 border-t border-border-base pt-4">
            {ev.capitulo && (
              <div className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm">
                <Icon name="ScrollText" size={15} className="text-secondary" />
                <span className="text-fg">Cap. {ev.capitulo.numero} — {ev.capitulo.titulo}</span>
              </div>
            )}
            {ev.locacion && (
              <Link href={`/locaciones/${ev.locacion.id}`} className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm hover:border-border-glow">
                <Icon name="MapPin" size={15} className="text-accent" />
                <span className="text-fg">{ev.locacion.nombre}</span>
                <Icon name="ArrowRight" size={13} className="ml-auto text-fg-muted" />
              </Link>
            )}
          </div>
        )}
      </motion.aside>
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
      style={active ? { borderColor: color ?? "var(--color-primary,#8b7bff)", background: `${color ?? "#8b7bff"}22`, color: color ?? "#cdc4ff" } : { borderColor: "var(--border-base)", color: "var(--fg-muted)" }}
    >
      {icon && <Icon name={icon} size={12} style={active ? undefined : { color }} />}
      {children}
    </button>
  );
}
