"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { ParticleField } from "@/components/viz/ParticleField";
import { catMeta, DetallePanel, FiltrosTimeline, type Ev } from "@/components/viz/timelineShared";

// --- Espacio de proyección (viewBox del SVG) ---
const VW = 1000;
const VH = 640;
const CX = VW / 2;
const CY = VH / 2;

// --- Geometría del vórtice (túnel del tiempo) ---
const ANG = 0.42; // giro angular por evento (radianes) — menos vueltas = más legible
const R0 = 20; // radio del origen (punto de fuga)
const R_STEP = 8; // apertura del radio por evento → "se amplía hacia afuera"
const Z_STEP = 60; // separación en profundidad por evento
const CULL_NEAR = 70; // por delante de esto, el evento ya pasó la cámara
const S_MAX = 1.9; // tope de escala (evita orbes gigantes al volar muy adentro)

// Gradiente temporal: frío en el centro (orígenes, fondo) → cálido afuera (presente, frente).
const GRAD_STOPS = [
  { o: 0, c: "#7c6cff" },
  { o: 0.4, c: "#4f93e6" },
  { o: 0.68, c: "#2dd4bf" },
  { o: 0.86, c: "#e0b34a" },
  { o: 1, c: "#f87171" },
];
const ERA_PALETTE = ["#a89bff", "#67e8d6", "#7fb0f5", "#ecc869", "#fa9a9a", "#d3a0ff", "#9fe07d"];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Proyecta un evento (índice fraccionario i) al plano de pantalla dada la rotación y la cámara. */
function project(i: number, rot: number, camZ: number, camback: number, f: number) {
  const ang = i * ANG + rot;
  const r = R0 + i * R_STEP;
  const wx = r * Math.cos(ang);
  const wy = r * Math.sin(ang);
  const wz = i * Z_STEP;
  const depth = camZ + camback - wz; // distancia frente a la cámara
  if (depth < CULL_NEAR) return null; // pasó la cámara
  const s = Math.min(f / depth, S_MAX);
  return { x: CX + wx * s, y: CY + wy * s, s, depth };
}

/** Cronología — "túnel del tiempo": vórtice 3D real con perspectiva propia. */
export function TimelineEspiral({ eventos }: { eventos: Ev[] }) {
  const reduce = useReducedMotion();
  const n = eventos.length;
  const maxZ = Math.max(0, n - 1) * Z_STEP;
  // Profundidad moderada (~2×) en función del nº de eventos: ni plano ni túnel infinito.
  const CAMBACK = maxZ * 0.85 + 360;
  const F = CAMBACK * 1.04; // escala ≈1 en el evento enfocado

  const listRef = useRef<HTMLDivElement>(null);

  const [sel, setSel] = useState<Ev | null>(null);
  const [focus, setFocus] = useState(n - 1); // arranca en el presente, mirando hacia el fondo
  const [hover, setHover] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [soloMayor, setSoloMayor] = useState(false);
  // El render inicial (SSR + primer paint del cliente) debe ser idéntico → diferimos lo que depende
  // de useReducedMotion(), que difiere servidor/cliente y rompía la hidratación.
  const [mounted, setMounted] = useState(false);
  const anim = mounted && !reduce; // adornos animados continuos (pulso, latidos, anillo)
  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      if (!reduce) setPlaying(true); // autoplay solo si el usuario no pidió reducir movimiento
    });
  }, [reduce]);

  // Vista renderizada (única fuente de verdad para el render): rotación + cámara.
  const [view, setView] = useState({ rot: 0, camZ: maxZ });

  // Estado de animación en refs (se leen solo fuera del render: rAF, handlers).
  const rotRef = useRef(0);
  const camRef = useRef(maxZ);
  const camTarget = useRef(maxZ);
  const focusRef = useRef(n - 1);
  const tour = useRef(0); // ms acumulados parado en el nodo actual (recorrido guiado)
  const suppressClick = useRef(false); // ignora el click espurio tras un arrastre
  const drag = useRef<{
    x: number;
    y: number;
    rot: number;
    cam: number;
    moved: boolean;
    captured: boolean;
    id: number;
    el: HTMLElement;
  } | null>(null);

  const categorias = [...new Set(eventos.map((e) => e.categoria).filter((x): x is string => !!x))];
  const visible = useCallback(
    (ev: Ev) => (!cat || ev.categoria === cat) && (!soloMayor || ev.importancia === "Mayor"),
    [cat, soloMayor],
  );

  // Vuela la cámara hasta el evento `i`.
  const goTo = useCallback(
    (i: number, openDrawer = false) => {
      const idx = clamp(i, 0, n - 1);
      setPlaying(false);
      camTarget.current = idx * Z_STEP;
      if (openDrawer) setSel(eventos[idx]);
    },
    [n, eventos],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      let i = focusRef.current;
      for (let k = 0; k < n; k++) {
        i += dir;
        if (i < 0 || i >= n) return;
        if (visible(eventos[i])) break;
      }
      goTo(i);
    },
    [n, eventos, visible, goTo],
  );

  // Bucle de animación: giro autónomo + suavizado de la cámara + foco. Solo re-renderiza si cambia algo.
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const DWELL = 1000; // pausa en cada evento (ms)
    const loop = (t: number) => {
      const dt = Math.min(64, t - prev);
      prev = t;
      // Recorrido guiado (acción explícita: funciona aunque haya reduce-motion).
      // Vuela de un nodo al siguiente, hace una pausa y al final vuelve al primero.
      if (playing && !drag.current) {
        rotRef.current += dt * 0.00004; // deriva sutil "viva"
        if (Math.abs(camTarget.current - camRef.current) < 3) {
          tour.current += dt;
          if (tour.current > DWELL) {
            tour.current = 0;
            camTarget.current = ((focusRef.current + 1) % n) * Z_STEP;
          }
        } else {
          tour.current = 0;
        }
      }
      const k = Math.min(1, dt * 0.006);
      camRef.current += (camTarget.current - camRef.current) * k;

      const f = clamp(Math.round(camRef.current / Z_STEP), 0, n - 1);
      if (f !== focusRef.current) {
        focusRef.current = f;
        setFocus(f);
      }
      setView((v) =>
        Math.abs(v.rot - rotRef.current) > 1e-4 || Math.abs(v.camZ - camRef.current) > 0.05
          ? { rot: rotRef.current, camZ: camRef.current }
          : v,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, n]);

  // Arrastrar: horizontal = girar el vórtice · vertical = avanzar/retroceder en el tiempo.
  // Solo capturamos el puntero tras superar un umbral → los clics en nodos/botones llegan intactos.
  const onPointerDown = (e: React.PointerEvent) => {
    suppressClick.current = false;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      rot: rotRef.current,
      cam: camTarget.current,
      moved: false,
      captured: false,
      id: e.pointerId,
      el: e.currentTarget as HTMLElement,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) {
      d.moved = true;
      d.captured = true;
      setPlaying(false);
      setGrabbing(true);
      d.el.setPointerCapture(d.id);
    }
    if (!d.moved) return;
    rotRef.current = d.rot + dx * 0.006;
    const target = clamp(d.cam - dy * 1.6, 0, maxZ); // arrastrar hacia arriba → avanzar al presente
    camTarget.current = target;
    camRef.current = target; // respuesta directa mientras se arrastra
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (d?.moved) {
      camTarget.current = focusRef.current * Z_STEP; // imanta al evento más cercano
      suppressClick.current = true;
    }
    if (d?.captured) d.el.releasePointerCapture?.(d.id);
    drag.current = null;
    setGrabbing(false);
  };

  // Teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") step(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // Auto-scroll de la lista.
  useEffect(() => {
    listRef.current?.querySelector(`[data-ev="${focus}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus]);

  // --- Cálculo del fotograma actual ---
  const { rot: R, camZ: C } = view;

  // Línea/estela del vórtice (muestreo fino mientras esté delante de la cámara).
  let path = "";
  for (let i = 0; i <= n - 1 + 0.001; i += 0.28) {
    const p = project(i, R, C, CAMBACK, F);
    if (!p) {
      if (path) break;
      continue;
    }
    path += `${path ? "L" : "M"} ${p.x.toFixed(1)},${p.y.toFixed(1)} `;
  }

  // Nodos proyectados, ordenados de lejos a cerca (pintor).
  type N = { i: number; ev: Ev; x: number; y: number; s: number; depth: number };
  const nodos: N[] = [];
  for (let i = 0; i < n; i++) {
    const p = project(i, R, C, CAMBACK, F);
    if (p) nodos.push({ i, ev: eventos[i], ...p });
  }
  nodos.sort((a, b) => b.depth - a.depth);

  // Etiquetas de era en el nodo medio de cada tramo.
  const eras: { i: number; label: string; color: string }[] = [];
  {
    let gi = 0;
    let k = 0;
    while (k < n) {
      const era = eventos[k].era ?? null;
      let j = k;
      while (j < n && (eventos[j].era ?? null) === era) j++;
      if (era) eras.push({ i: Math.floor((k + j - 1) / 2), label: era, color: ERA_PALETTE[gi++ % ERA_PALETTE.length] });
      k = j;
    }
  }

  const fog = (depth: number) => clamp((maxZ + CAMBACK * 2 - depth) / (maxZ + CAMBACK), 0.14, 1);
  const origen = project(0, R, C, CAMBACK, F);
  const focusEv = eventos[focus];

  // Glow barato: un gradiente radial por color (en lugar de feGaussianBlur por nodo, carísimo).
  const haloColors = [...new Set([...eventos.map((e) => catMeta(e.categoria).color), "#cdc4ff"])];
  const haloId = (c: string) => `h-${c.replace("#", "")}`;

  return (
    <div>
      <FiltrosTimeline categorias={categorias} cat={cat} setCat={setCat} soloMayor={soloMayor} setSoloMayor={setSoloMayor} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* === Túnel del tiempo === */}
        <div
          className="relative h-[440px] select-none overflow-hidden rounded-3xl border border-border-glow bg-gradient-to-b from-deep to-void md:h-[560px]"
          style={{ touchAction: "none", cursor: grabbing ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <ParticleField />

          <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" className="absolute inset-0" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="tl-grad" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={VW * 0.62}>
                {GRAD_STOPS.map((s) => (
                  <stop key={s.o} offset={s.o} stopColor={s.c} />
                ))}
              </radialGradient>
              {/* Halos: un gradiente radial por color (glow sin filtros). */}
              {haloColors.map((c) => (
                <radialGradient key={c} id={haloId(c)}>
                  <stop offset="0%" stopColor={c} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={c} stopOpacity={0} />
                </radialGradient>
              ))}
            </defs>

            {/* Estela del vórtice (glow por capas superpuestas, sin filtros) */}
            <path d={path} fill="none" stroke="url(#tl-grad)" strokeOpacity={0.1} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" />
            <path d={path} fill="none" stroke="url(#tl-grad)" strokeOpacity={0.32} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            <path d={path} fill="none" stroke="url(#tl-grad)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
            {/* Pulso de energía fluyendo hacia el frente */}
            {anim && (
              <motion.path
                d={path}
                fill="none"
                stroke="#fff"
                strokeOpacity={0.6}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeDasharray="3 260"
                animate={{ strokeDashoffset: [0, -263] }}
                transition={{ duration: 5, ease: "linear", repeat: Infinity }}
              />
            )}

            {/* Punto de fuga (origen) */}
            {origen && (
              <>
                <circle cx={origen.x} cy={origen.y} r={24} fill={`url(#${haloId("#cdc4ff")})`} />
                <circle cx={origen.x} cy={origen.y} r={3} fill="#cdc4ff" />
              </>
            )}

            {/* Nodos de evento */}
            {nodos.map((nd) => {
              const meta = catMeta(nd.ev.categoria);
              const mayor = nd.ev.importancia === "Mayor";
              const vis = visible(nd.ev);
              const isFocus = nd.i === focus;
              const isHover = nd.i === hover;
              const baseR = mayor ? 7 : 4.6;
              const rr = baseR * nd.s * (isFocus || isHover ? 1.32 : 1);
              const op = fog(nd.depth) * (vis ? 1 : 0.12);
              return (
                <g
                  key={nd.ev.id}
                  style={{ cursor: "pointer", opacity: op }}
                  onMouseEnter={() => setHover(nd.i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (suppressClick.current) return;
                    goTo(nd.i, true);
                  }}
                >
                  <circle cx={nd.x} cy={nd.y} r={rr * 2.7} fill={`url(#${haloId(meta.color)})`} />
                  {isFocus && (
                    <circle cx={nd.x} cy={nd.y} r={rr + 7} fill="none" stroke={meta.color} strokeWidth={1.5} strokeOpacity={0.85}>
                      {anim && <animate attributeName="r" values={`${rr + 5};${rr + 11};${rr + 5}`} dur="2.2s" repeatCount="indefinite" />}
                    </circle>
                  )}
                  <circle cx={nd.x} cy={nd.y} r={rr} fill={meta.color} />
                  <circle cx={nd.x - rr * 0.3} cy={nd.y - rr * 0.3} r={rr * 0.42} fill="#ffffff" fillOpacity={0.55} />
                </g>
              );
            })}

            {/* Etiquetas de era */}
            {eras.map((e, idx) => {
              const p = project(e.i, R, C, CAMBACK, F);
              if (!p) return null;
              const fs = clamp(11 * p.s, 9, 22);
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={p.y - clamp(16 * p.s, 12, 34)}
                  textAnchor="middle"
                  style={{ fontSize: fs, fill: e.color, fontWeight: 600, opacity: fog(p.depth) }}
                >
                  {e.label}
                </text>
              );
            })}
          </svg>

          {/* Controles */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-base bg-deep/80 px-2 py-1.5 backdrop-blur-xl"
          >
            <Ctrl label="Evento anterior" icon="ChevronLeft" onClick={() => step(-1)} />
            <Ctrl label={playing ? "Pausar" : "Reanudar"} icon={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)} />
            <Ctrl label="Evento siguiente" icon="ChevronRight" onClick={() => step(1)} />
          </div>

          {/* Tarjeta fija del evento enfocado */}
          <AnimatePresence mode="wait">
            {focusEv && (
              <motion.div
                key={focusEv.id}
                className="absolute left-3 top-3 z-30 max-w-[78%] cursor-pointer rounded-2xl border border-border-glow bg-deep/85 p-3 backdrop-blur-xl sm:max-w-[260px]"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setSel(focusEv)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs" style={{ color: catMeta(focusEv.categoria).color }}>
                    {focusEv.fechaLore}
                  </span>
                  {focusEv.era && <span className="text-[10px] text-fg-muted">· {focusEv.era}</span>}
                </div>
                <h3 className="mt-0.5 font-display text-base leading-tight text-fg">{focusEv.titulo}</h3>
                {focusEv.descripcion && <p className="mt-1 line-clamp-2 text-xs leading-snug text-fg-muted">{focusEv.descripcion}</p>}
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-secondary">
                  Ver detalle <Icon name="ArrowRight" size={11} />
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="pointer-events-none absolute bottom-3 right-3 z-20 hidden text-[10px] text-fg-muted/70 sm:block">
            Arrastra ↔ para girar · ↕ para viajar en el tiempo
          </p>
        </div>

        {/* === Lista sincronizada === */}
        <aside className="rounded-3xl border border-border-base bg-deep/40 p-2 lg:max-h-[560px]">
          <div ref={listRef} className="max-h-[340px] overflow-y-auto pr-1 lg:max-h-[540px]">
            <ol className="space-y-1">
              {eventos.map((ev, i) => {
                const meta = catMeta(ev.categoria);
                const vis = visible(ev);
                const active = i === focus;
                return (
                  <li key={ev.id} data-ev={i} hidden={!vis}>
                    <button
                      onClick={() => goTo(i)}
                      onDoubleClick={() => setSel(ev)}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      className="flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors"
                      style={{ borderColor: active ? meta.color : "transparent", background: active ? `${meta.color}1a` : "transparent" }}
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                      <span className="min-w-0">
                        <span className="block font-mono text-[11px] text-fg-muted">{ev.fechaLore}</span>
                        <span className={`block truncate text-sm ${active ? "text-fg" : "text-fg-secondary"}`}>{ev.titulo}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>

      <AnimatePresence>{sel && <DetallePanel ev={sel} onClose={() => setSel(null)} />}</AnimatePresence>
    </div>
  );
}

function Ctrl({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-fg-secondary transition-colors hover:bg-surface hover:text-fg"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
