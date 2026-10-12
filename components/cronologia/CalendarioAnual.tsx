"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { colorDe, DetallePanel } from "@/components/viz/timelineShared";
import { useModoFecha } from "@/components/fechas/store";
import { cn } from "@/lib/utils";
import type { Suceso } from "@/lib/cronologia";
import { anioDeClave, diasPorAnio, formatoAnio, segmentosOrdenados, type Calendario, type Extremo } from "@/lib/fechas";

/**
 * Vista de calendario de un año (spec §13): sus meses y bloques de días fuera
 * de mes, con los sucesos en su día. Lo que no tiene mes o abarca varios años
 * va en la franja "todo el año"; lo que tiene mes pero no día, en la franja de
 * su mes.
 *
 * `onCrear` (solo en el taller) añade botones para crear un evento en un día,
 * un mes o el año entero.
 */

const MAX_DIAS_POR_SUCESO = 400;

export function CalendarioAnual({
  sucesos,
  cal,
  onCrear,
}: {
  sucesos: Suceso[];
  cal: Calendario;
  onCrear?: (donde: Extremo, etiqueta: string) => void;
}) {
  const modo = useModoFecha();
  const [anio, setAnio] = useState(0);
  const [texto, setTexto] = useState("0");
  const [sel, setSel] = useState<Suceso | null>(null);

  // El año viaja en la URL (?anio=) para poder enlazarlo; se lee ya en el navegador.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("anio");
    if (v && /^-?\d+$/.test(v)) {
      queueMicrotask(() => {
        setAnio(Number(v));
        setTexto(v);
      });
    }
  }, []);
  const ir = (a: number) => {
    setAnio(a);
    setTexto(String(a));
    const url = new URL(window.location.href);
    url.searchParams.set("anio", String(a));
    window.history.replaceState(null, "", url);
  };

  const D = diasPorAnio(cal);
  const segmentos = segmentosOrdenados(cal);
  const inicio = anio * D;
  const fin = inicio + D - 1;

  const { franja, porMes, porDia } = useMemo(() => {
    const franja: Suceso[] = [];
    const porMes = new Map<number, Suceso[]>();
    const porDia = new Map<number, Suceso[]>();
    const add = <K,>(m: Map<K, Suceso[]>, k: K, s: Suceso) => (m.get(k) ?? m.set(k, []).get(k)!).push(s);

    for (const s of sucesos) {
      if (s.claveIni > fin || s.claveFin < inicio) continue;
      const sinMes = s.fecha.ini.segmentoId == null || (s.fecha.fin != null && s.fecha.fin.segmentoId == null);
      if (sinMes || anioDeClave(cal, s.claveIni) !== anioDeClave(cal, s.claveFin)) {
        franja.push(s);
        continue;
      }
      const conDia = s.fecha.ini.dia != null && (s.fecha.fin == null || s.fecha.fin.dia != null);
      if (conDia && s.claveFin - s.claveIni < MAX_DIAS_POR_SUCESO) {
        for (let k = Math.max(s.claveIni, inicio); k <= Math.min(s.claveFin, fin); k++) add(porDia, k, s);
        continue;
      }
      let desde = inicio;
      for (const seg of segmentos) {
        const hasta = desde + seg.dias - 1;
        if (s.claveIni <= hasta && s.claveFin >= desde) add(porMes, seg.id, s);
        desde += seg.dias;
      }
    }
    return { franja, porMes, porDia };
  }, [sucesos, cal, segmentos, inicio, fin]);

  // Años con algo, para saltar sin teclear.
  const anios = useMemo(() => {
    const set = new Set<number>();
    for (const s of sucesos) {
      set.add(anioDeClave(cal, s.claveIni));
      set.add(anioDeClave(cal, s.claveFin));
    }
    return [...set].sort((a, b) => a - b);
  }, [sucesos, cal]);
  const cercanos = [...anios].sort((a, b) => Math.abs(a - anio) - Math.abs(b - anio)).slice(0, 12).sort((a, b) => a - b);

  // Primer día absoluto de cada segmento en este año.
  const inicios = segmentos.reduce<number[]>((acc, seg, i) => {
    acc.push(i === 0 ? inicio : acc[i - 1] + segmentos[i - 1].dias);
    return acc;
  }, []);

  const n = cal.diasSemana.length;
  const lecturaAnio = formatoAnio(cal, anio, modo);

  return (
    <div>
      {/* ── Selector de año ─────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border-base bg-surface/50 p-1">
          <button type="button" onClick={() => ir(anio - 1)} aria-label="Año anterior" className="grid h-8 w-8 place-items-center rounded-full text-fg-secondary hover:bg-surface hover:text-fg">
            <Icon name="ChevronLeft" size={16} />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (/^-?\d+$/.test(texto.trim())) ir(Number(texto));
            }}
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/[^\d-]/g, ""))}
              onBlur={() => /^-?\d+$/.test(texto.trim()) && Number(texto) !== anio && ir(Number(texto))}
              inputMode="numeric"
              aria-label="Año absoluto"
              className="w-20 bg-transparent text-center font-mono text-sm text-fg outline-none"
            />
          </form>
          <button type="button" onClick={() => ir(anio + 1)} aria-label="Año siguiente" className="grid h-8 w-8 place-items-center rounded-full text-fg-secondary hover:bg-surface hover:text-fg">
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>
        <p className="font-display text-xl text-fg">{lecturaAnio}</p>
        {modo === "eras" && lecturaAnio !== `Año ${anio}` && <p className="font-mono text-xs text-fg-muted">año absoluto {anio}</p>}
      </div>

      {cercanos.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-fg-muted">Años con sucesos:</span>
          {cercanos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => ir(a)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono transition-colors",
                a === anio ? "border-accent text-accent" : "border-border-base text-fg-muted hover:text-fg",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* ── Todo el año ─────────────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-border-glow/60 bg-deep/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-xs uppercase tracking-wider text-fg-muted">Todo el año</h2>
          {onCrear && (
            <BotonCrear onClick={() => onCrear({ anio, segmentoId: null, dia: null }, `el año ${anio}`)} titulo="Evento en este año" />
          )}
        </div>
        {franja.length === 0 ? (
          <p className="text-xs italic text-fg-muted">Nada que abarque el año entero.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {franja.map((s) => (
              <ChipSuceso key={s.clave} s={s} onClick={() => setSel(s)} />
            ))}
          </div>
        )}
      </section>

      {segmentos.length === 0 && <p className="text-sm text-fg-muted">El calendario aún no tiene meses configurados.</p>}

      {/* ── Meses ───────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {segmentos.map((seg, si) => {
          const primero = inicios[si];
          const vacio = n ? ((primero % n) + n) % n : 0;
          const delMes = porMes.get(seg.id) ?? [];
          return (
            <section
              key={seg.id}
              className={cn(
                "rounded-2xl border bg-surface/30 p-3",
                seg.tipo === "intercalar" ? "border-dashed border-border-glow/60" : "border-border-base",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-display text-base text-fg">{seg.nombre}</h3>
                {seg.tipo === "intercalar" && <span className="text-[10px] uppercase tracking-wider text-fg-muted">fuera de mes</span>}
                {onCrear && (
                  <BotonCrear
                    onClick={() => onCrear({ anio, segmentoId: seg.id, dia: null }, `${seg.nombre} del año ${anio}`)}
                    titulo="Evento en este mes, sin día"
                  />
                )}
              </div>
              {delMes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {delMes.map((s) => (
                    <ChipSuceso key={s.clave} s={s} onClick={() => setSel(s)} />
                  ))}
                </div>
              )}
              <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${Math.max(1, n || 7)}, minmax(0, 1fr))` }}>
                {cal.diasSemana.map((d, i) => (
                  <span key={i} title={d} className="truncate pb-1 text-center text-[10px] uppercase text-fg-muted">
                    {d.slice(0, 2)}
                  </span>
                ))}
                {Array.from({ length: vacio }, (_, i) => (
                  <span key={`v${i}`} />
                ))}
                {Array.from({ length: seg.dias }, (_, i) => {
                  const clave = primero + i;
                  const delDia = porDia.get(clave) ?? [];
                  return (
                    <div
                      key={i}
                      className={cn(
                        "group relative min-h-12 rounded-md border p-0.5 text-[10px]",
                        delDia.length ? "border-border-glow/70 bg-deep/60" : "border-border-base/50",
                      )}
                    >
                      <span className="block px-0.5 text-fg-muted">{i + 1}</span>
                      {delDia.slice(0, 2).map((s) => (
                        <button
                          key={s.clave}
                          type="button"
                          onClick={() => setSel(s)}
                          title={s.titulo}
                          className="block w-full truncate rounded px-0.5 text-left leading-tight text-fg hover:bg-surface"
                          style={{ borderLeft: `2px solid ${colorDe(s)}` }}
                        >
                          {s.titulo}
                        </button>
                      ))}
                      {delDia.length > 2 && (
                        <button type="button" onClick={() => setSel(delDia[2])} className="px-0.5 text-fg-muted hover:text-fg">
                          +{delDia.length - 2}
                        </button>
                      )}
                      {onCrear && (
                        <button
                          type="button"
                          onClick={() => onCrear({ anio, segmentoId: seg.id, dia: i + 1 }, `el ${i + 1} de ${seg.nombre} del año ${anio}`)}
                          aria-label={`Crear evento el ${i + 1} de ${seg.nombre}`}
                          className="absolute right-0.5 top-0.5 hidden h-4 w-4 place-items-center rounded bg-primary text-void group-hover:grid"
                        >
                          <Icon name="Plus" size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <AnimatePresence>{sel && <DetallePanel ev={sel} onClose={() => setSel(null)} />}</AnimatePresence>
    </div>
  );
}

function ChipSuceso({ s, onClick }: { s: Suceso; onClick: () => void }) {
  const color = colorDe(s);
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs text-fg hover:bg-surface"
      style={{ borderColor: `${color}88` }}
      title={s.titulo}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{s.titulo}</span>
    </button>
  );
}

function BotonCrear({ onClick, titulo }: { onClick: () => void; titulo: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="ml-auto grid h-6 w-6 place-items-center rounded-full border border-border-base text-fg-muted hover:border-border-glow hover:text-fg"
    >
      <Icon name="Plus" size={12} />
    </button>
  );
}
