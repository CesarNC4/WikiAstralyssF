"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { anchoDe, siluetaDe } from "@/lib/alturas/siluetas";
import type { FiguraComparador } from "@/lib/queries/alturas";

/**
 * Comparador de alturas (spec §12): personajes, bestias y demonios uno al lado
 * del otro, a escala real y en metros.
 *
 *  - Se elige a quién comparar combinando filtros (raza, nación, organización)
 *    y selección libre.
 *  - Alto: las figuras de pie, por su altura. Largo: de perfil, por su longitud.
 *  - Cada figura toma un color distinto de forma automática.
 */

type Opcion = { id: number; nombre: string };
type Modo = "alto" | "largo";

const ALTO_LIENZO = 440;
const ARRIBA = 24;
const ABAJO = 56;
const IZQUIERDA = 56;
const MAX_INICIAL = 8;

const etiquetaTipo: Record<FiguraComparador["tipo"], string> = { personajes: "Personaje", bestias: "Bestia", demonios: "Lord demonio" };

/** Colores bien separados: ángulo áureo sobre la rueda de tonos. */
const colorN = (i: number) => `hsl(${Math.round((i * 137.508 + 250) % 360)} 70% 64%)`;

const metros = (v: number) => `${v.toLocaleString("es-ES", { maximumFractionDigits: v < 10 ? 2 : 1 })} m`;

/** Paso "redondo" para la regla: 1, 2 o 5 por una potencia de diez. */
function pasoRegla(maximo: number): number {
  const bruto = maximo / 6;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  return ([1, 2, 5, 10].find((m) => m * pot >= bruto) ?? 10) * pot;
}

export function Comparador({
  figuras,
  razas,
  naciones,
  organizaciones,
}: {
  figuras: FiguraComparador[];
  razas: Opcion[];
  naciones: Opcion[];
  organizaciones: Opcion[];
}) {
  const [modo, setModo] = useState<Modo>("alto");
  const [raza, setRaza] = useState("");
  const [nacion, setNacion] = useState("");
  const [org, setOrg] = useState("");
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(1);
  const [elegidos, setElegidos] = useState<string[]>(() => figuras.filter((f) => f.altura != null).slice(0, MAX_INICIAL).map((f) => f.id));

  const medida = (f: FiguraComparador) => (modo === "alto" ? f.altura : f.longitud);
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  const candidatos = useMemo(() => {
    const t = norm(q.trim());
    return figuras.filter(
      (f) =>
        (!t || norm(f.nombre).includes(t)) &&
        (!raza || f.razas.includes(Number(raza))) &&
        (!nacion || f.naciones.includes(Number(nacion))) &&
        (!org || f.organizaciones.includes(Number(org))),
    );
  }, [figuras, q, raza, nacion, org]);

  const porId = useMemo(() => new Map(figuras.map((f) => [f.id, f])), [figuras]);
  const seleccion = elegidos.map((id) => porId.get(id)).filter((f): f is FiguraComparador => !!f);
  const dibujables = seleccion.filter((f) => medida(f) != null);
  const sinMedida = seleccion.filter((f) => medida(f) == null);

  const alternar = (id: string) => setElegidos((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // ── Geometría, en metros ──────────────────────────────────────────────
  const piezas = dibujables.map((f) => {
    const s = siluetaDe(f.silueta, f.tipo === "personajes" ? "humana" : "humanoide");
    const ancho = anchoDe(s);
    const m = medida(f)!;
    const [wM, hM] = modo === "alto" ? [(m * ancho) / s.alto, m] : [m, (m * s.alto) / ancho];
    return { f, s, wM, hM, m };
  });
  const maxH = Math.max(0.5, ...piezas.map((p) => p.hM));
  const hueco = Math.max(0.3, maxH * 0.18);
  // Cada figura empieza donde acaba la anterior, más el hueco.
  const colocadas = piezas.reduce<(typeof piezas[number] & { x: number })[]>((acc, p) => {
    const prev = acc[acc.length - 1];
    acc.push({ ...p, x: prev ? prev.x + prev.wM + hueco : 0 });
    return acc;
  }, []);
  const ultima = colocadas[colocadas.length - 1];
  const totalW = ultima ? ultima.x + ultima.wM : 0;

  const ppm = ((ALTO_LIENZO - ARRIBA - ABAJO) / maxH) * zoom;
  const ancho = IZQUIERDA + Math.max(totalW * ppm, 200) + 32;
  const alto = ARRIBA + maxH * ppm + ABAJO;
  const suelo = ARRIBA + maxH * ppm;
  const paso = pasoRegla(maxH);
  const lineas = Array.from({ length: Math.floor(maxH / paso) + 1 }, (_, i) => i * paso);

  const sel = "rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow";

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ── Quién se compara ─────────────────────────────────── */}
      <aside className="space-y-3 rounded-2xl border border-border-base bg-surface/30 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" aria-label="Buscar" className={`${sel} w-full`} />
        <div className="grid grid-cols-1 gap-2">
          <select value={raza} onChange={(e) => setRaza(e.target.value)} className={sel} aria-label="Raza">
            <option value="">Todas las razas</option>
            {razas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <select value={nacion} onChange={(e) => setNacion(e.target.value)} className={sel} aria-label="Nación">
            <option value="">Todas las naciones</option>
            {naciones.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <select value={org} onChange={(e) => setOrg(e.target.value)} className={sel} aria-label="Organización">
            <option value="">Todas las organizaciones</option>
            {organizaciones.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setElegidos((p) => [...new Set([...p, ...candidatos.map((f) => f.id)])])}
            className="rounded-full border border-border-base px-2.5 py-1 text-fg-secondary hover:text-fg"
          >
            Añadir los {candidatos.length}
          </button>
          <button type="button" onClick={() => setElegidos([])} className="rounded-full border border-border-base px-2.5 py-1 text-fg-secondary hover:text-fg">
            Quitar todos
          </button>
        </div>
        <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto pr-1">
          {candidatos.map((f) => {
            const i = elegidos.indexOf(f.id);
            return (
              <li key={f.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface">
                  <input type="checkbox" checked={i >= 0} onChange={() => alternar(f.id)} />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i >= 0 ? colorN(i) : "transparent", border: "1px solid var(--border-base)" }} />
                  <span className="min-w-0 flex-1 truncate text-fg">{f.nombre}</span>
                  <span className="shrink-0 text-[11px] text-fg-muted">{medida(f) != null ? metros(medida(f)!) : "—"}</span>
                </label>
              </li>
            );
          })}
          {candidatos.length === 0 && <li className="px-2 py-4 text-center text-xs text-fg-muted">Nadie coincide con los filtros.</li>}
        </ul>
      </aside>

      {/* ── Lienzo ───────────────────────────────────────────── */}
      <section className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Medida" className="inline-flex overflow-hidden rounded-full border border-border-base text-xs">
            {(
              [
                ["alto", "Alto (de pie)"],
                ["largo", "Largo (de perfil)"],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={cn("px-3 py-1.5", modo === m ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z / 1.4))} aria-label="Alejar" className="grid h-8 w-8 place-items-center rounded-full border border-border-base text-fg-secondary hover:text-fg">
              −
            </button>
            <input
              type="range"
              min={-2}
              max={3}
              step={0.05}
              value={Math.log2(zoom)}
              onChange={(e) => setZoom(2 ** Number(e.target.value))}
              aria-label="Zoom"
              className="w-28"
            />
            <button type="button" onClick={() => setZoom((z) => Math.min(8, z * 1.4))} aria-label="Acercar" className="grid h-8 w-8 place-items-center rounded-full border border-border-base text-fg-secondary hover:text-fg">
              +
            </button>
            <button type="button" onClick={() => setZoom(1)} className="rounded-full border border-border-base px-3 py-1 text-xs text-fg-secondary hover:text-fg">
              Ajustar
            </button>
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-border-glow bg-gradient-to-b from-deep to-void">
          {colocadas.length === 0 ? (
            <p className="grid h-[440px] place-items-center px-6 text-center text-sm text-fg-muted">
              {seleccion.length === 0
                ? "Elige a quién comparar en la lista."
                : modo === "largo"
                  ? "Nadie de la selección tiene longitud registrada."
                  : "Nadie de la selección tiene altura registrada."}
            </p>
          ) : (
            <svg width={ancho} height={alto} role="img" aria-label="Comparación a escala" className="block">
              {/* Regla */}
              {lineas.map((v) => {
                const y = suelo - v * ppm;
                return (
                  <g key={v}>
                    <line x1={IZQUIERDA - 6} x2={ancho - 8} y1={y} y2={y} stroke="var(--border-base)" strokeDasharray={v === 0 ? undefined : "3 5"} />
                    <text x={IZQUIERDA - 10} y={y + 4} textAnchor="end" className="fill-fg-muted font-mono text-[10px]">
                      {metros(v)}
                    </text>
                  </g>
                );
              })}
              {colocadas.map((p) => {
                const i = elegidos.indexOf(p.f.id);
                const c = colorN(i);
                const x = IZQUIERDA + p.x * ppm;
                const wPx = p.wM * ppm;
                const hPx = p.hM * ppm;
                return (
                  <a key={p.f.id} href={p.f.href} aria-label={`${p.f.nombre}, ${metros(p.m)}`}>
                    <title>{`${p.f.nombre} · ${etiquetaTipo[p.f.tipo]} · ${metros(p.m)}`}</title>
                    <g transform={`translate(${x} ${suelo - hPx}) scale(${wPx / p.s.ancho} ${hPx / p.s.alto})`}>
                      <path d={p.s.d} fill={c} fillOpacity={0.85} stroke={c} strokeWidth={0} />
                    </g>
                    <text x={x + wPx / 2} y={suelo + 18} textAnchor="middle" className="fill-fg text-[11px]">
                      {p.f.nombre.length > 18 ? `${p.f.nombre.slice(0, 17)}…` : p.f.nombre}
                    </text>
                    <text x={x + wPx / 2} y={suelo + 34} textAnchor="middle" className="font-mono text-[10px]" fill={c}>
                      {metros(p.m)}
                    </text>
                  </a>
                );
              })}
            </svg>
          )}
        </div>

        {sinMedida.length > 0 && (
          <p className="text-xs text-fg-muted">
            Sin {modo === "alto" ? "altura" : "longitud"}: {sinMedida.map((f) => f.nombre).join(", ")}.
          </p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
          <Icon name="Ruler" size={12} /> Escala real en metros. Pulsa una figura para abrir su ficha.{" "}
          <Link href="/atlas" className="ml-auto text-accent hover:underline">
            Ver el Atlas
          </Link>
        </p>
      </section>
    </div>
  );
}
