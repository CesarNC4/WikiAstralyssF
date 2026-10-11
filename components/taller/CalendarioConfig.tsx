"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { FechaInput } from "@/components/admin/FechaInput";
import { guardarCalendario } from "@/lib/actions/calendario";
import { diasPorAnio, type Calendario, type Fecha, type TipoSegmento } from "@/lib/fechas";
import { cn } from "@/lib/utils";

/**
 * Universo > Calendario (spec §13): meses, días fuera de mes, semana y eras.
 *
 * Se edita todo en local y se guarda de una vez, porque el servidor tiene que
 * recolocar todas las fechas con el calendario completo. Las filas nuevas llevan
 * un id negativo provisional para poder probarlas en el probador antes de
 * guardar; al servidor viajan como null.
 */

const inputCls =
  "rounded-lg border border-border-base bg-surface px-2.5 py-1.5 text-sm text-fg outline-none transition-colors focus:border-border-glow";
const botonCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-border-base px-3 py-1.5 text-xs text-fg-secondary hover:border-border-glow hover:text-fg disabled:opacity-40";

interface SegFila {
  id: number;
  nombre: string;
  dias: string;
  tipo: TipoSegmento;
}

interface EraFila {
  id: number;
  nombre: string;
  abreviatura: string;
  anioInicio: string;
}

let provisional = -1;
const idNuevo = () => provisional--;

/** Mueve un elemento una posición arriba (-1) o abajo (+1). */
function mover<T>(xs: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const out = [...xs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function CalendarioConfig({ inicial, uso }: { inicial: Calendario; uso: Record<number, number> }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [segs, setSegs] = useState<SegFila[]>(() =>
    inicial.segmentos.map((s) => ({ id: s.id, nombre: s.nombre, dias: String(s.dias), tipo: s.tipo })),
  );
  const [semana, setSemana] = useState<string[]>(inicial.diasSemana);
  const [nuevoDia, setNuevoDia] = useState("");
  const [eras, setEras] = useState<EraFila[]>(() =>
    inicial.eras.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      abreviatura: e.abreviatura ?? "",
      anioInicio: e.anioInicio != null ? String(e.anioInicio) : "",
    })),
  );
  const [cambios, setCambios] = useState(false);
  const [prueba, setPrueba] = useState<Fecha | null>(null);

  const marcar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setCambios(true);
  };
  const cambiarSegs = marcar(setSegs);
  const cambiarSemana = marcar(setSemana);
  const cambiarEras = marcar(setEras);

  /** El calendario tal y como está en pantalla, sin guardar: alimenta el probador. */
  const actual: Calendario = useMemo(
    () => ({
      segmentos: segs.map((s, orden) => ({ id: s.id, orden, nombre: s.nombre || "(sin nombre)", dias: Math.max(1, Number(s.dias) || 1), tipo: s.tipo })),
      diasSemana: semana,
      eras: eras.map((e, orden) => ({
        id: e.id,
        orden,
        nombre: e.nombre || "(sin nombre)",
        abreviatura: e.abreviatura || null,
        anioInicio: orden > 0 && /^-?\d+$/.test(e.anioInicio) ? Number(e.anioInicio) : null,
      })),
    }),
    [segs, semana, eras],
  );

  const guardar = () =>
    start(async () => {
      const r = await guardarCalendario({
        segmentos: segs.map((s) => ({ id: s.id > 0 ? s.id : null, nombre: s.nombre, dias: Number(s.dias) || 0, tipo: s.tipo })),
        diasSemana: semana,
        eras: eras.map((e, i) => ({
          id: e.id > 0 ? e.id : null,
          nombre: e.nombre,
          abreviatura: e.abreviatura,
          anioInicio: i > 0 && /^-?\d+$/.test(e.anioInicio.trim()) ? Number(e.anioInicio) : null,
        })),
      });
      if (!r.ok) return toast(r.error, "error");
      setCambios(false);
      toast(
        r.recalculadas > 0 ? `Calendario guardado. ${r.recalculadas} fechas recolocadas.` : "Calendario guardado.",
        "success",
      );
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      {/* ── El año ─────────────────────────────────────────────────────── */}
      <Bloque
        titulo="El año"
        resumen={`Tu año dura ${diasPorAnio(actual)} días`}
        ayuda="Los meses y los bloques de días fuera de mes, en el orden en que ocurren. Un mes que ya usa alguna fecha no se puede quitar."
      >
        <div className="space-y-2">
          {segs.map((s, i) => {
            const usos = uso[s.id] ?? 0;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2",
                  s.tipo === "intercalar" ? "border-accent/40 bg-accent/5" : "border-border-base bg-surface/40",
                )}
              >
                <Orden onArriba={() => cambiarSegs(mover(segs, i, -1))} onAbajo={() => cambiarSegs(mover(segs, i, 1))} />
                <input
                  value={s.nombre}
                  onChange={(e) => cambiarSegs(segs.map((x) => (x.id === s.id ? { ...x, nombre: e.target.value } : x)))}
                  placeholder="Nombre"
                  className={cn(inputCls, "flex-1")}
                />
                <input
                  value={s.dias}
                  onChange={(e) =>
                    cambiarSegs(segs.map((x) => (x.id === s.id ? { ...x, dias: e.target.value.replace(/\D/g, "") } : x)))
                  }
                  inputMode="numeric"
                  aria-label="Días"
                  className={cn(inputCls, "w-20 text-right font-mono")}
                />
                <span className="w-8 text-xs text-fg-muted">días</span>
                <span className="w-28 text-xs text-fg-muted">{s.tipo === "intercalar" ? "Fuera de mes" : "Mes"}</span>
                {usos > 0 && <span className="text-xs text-fg-muted">{usos} fechas</span>}
                <button
                  type="button"
                  disabled={usos > 0}
                  title={usos > 0 ? "Hay fechas en este mes" : "Quitar"}
                  onClick={() => cambiarSegs(segs.filter((x) => x.id !== s.id))}
                  className="rounded p-1 text-fg-muted hover:text-error disabled:opacity-30 disabled:hover:text-fg-muted"
                >
                  <Icon name="X" size={15} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={botonCls}
            onClick={() => cambiarSegs([...segs, { id: idNuevo(), nombre: `Mes ${segs.filter((s) => s.tipo === "mes").length + 1}`, dias: "30", tipo: "mes" }])}
          >
            <Icon name="Plus" size={14} /> Mes
          </button>
          <button
            type="button"
            className={botonCls}
            onClick={() => cambiarSegs([...segs, { id: idNuevo(), nombre: "", dias: "1", tipo: "intercalar" }])}
          >
            <Icon name="Plus" size={14} /> Días fuera de mes
          </button>
        </div>
      </Bloque>

      {/* ── La semana ─────────────────────────────────────────────────── */}
      <Bloque
        titulo="La semana"
        resumen={`${semana.length} días por semana`}
        ayuda="El primer día del año 0 es el primer día de la semana. Los días fuera de mes también avanzan la semana."
      >
        <div className="flex flex-wrap gap-2">
          {semana.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border-base bg-surface px-1 py-1 text-sm">
              <button type="button" onClick={() => cambiarSemana(mover(semana, i, -1))} className="px-1 text-fg-muted hover:text-fg" aria-label="Antes">
                <Icon name="ChevronLeft" size={13} />
              </button>
              <input
                value={d}
                onChange={(e) => cambiarSemana(semana.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-24 bg-transparent text-center text-fg outline-none"
              />
              <button type="button" onClick={() => cambiarSemana(mover(semana, i, 1))} className="px-1 text-fg-muted hover:text-fg" aria-label="Después">
                <Icon name="ChevronRight" size={13} />
              </button>
              <button type="button" onClick={() => cambiarSemana(semana.filter((_, j) => j !== i))} className="px-1 text-fg-muted hover:text-error" aria-label="Quitar">
                <Icon name="X" size={13} />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nuevoDia.trim()) return;
            cambiarSemana([...semana, nuevoDia.trim()]);
            setNuevoDia("");
          }}
        >
          <input value={nuevoDia} onChange={(e) => setNuevoDia(e.target.value)} placeholder="Nombre del día…" className={cn(inputCls, "w-56")} />
          <button type="submit" className={botonCls}>
            <Icon name="Plus" size={14} /> Añadir
          </button>
        </form>
      </Bloque>

      {/* ── Las eras ──────────────────────────────────────────────────── */}
      <Bloque
        titulo="Las eras"
        resumen={`${eras.length} eras`}
        ayuda="Cada era empieza en un año del eje absoluto y termina donde empieza la siguiente. La primera no tiene inicio: se cuenta hacia atrás desde su fin. Una era sin año de inicio se ignora al mostrar fechas."
      >
        <div className="space-y-2">
          {eras.map((e, i) => (
            <div key={e.id} className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2">
              <Orden onArriba={() => cambiarEras(mover(eras, i, -1))} onAbajo={() => cambiarEras(mover(eras, i, 1))} />
              <input
                value={e.nombre}
                onChange={(ev) => cambiarEras(eras.map((x) => (x.id === e.id ? { ...x, nombre: ev.target.value } : x)))}
                placeholder="Nombre"
                className={cn(inputCls, "flex-1")}
              />
              <input
                value={e.abreviatura}
                onChange={(ev) => cambiarEras(eras.map((x) => (x.id === e.id ? { ...x, abreviatura: ev.target.value } : x)))}
                placeholder="Abrev."
                className={cn(inputCls, "w-24")}
              />
              {i === 0 ? (
                <span className="w-40 text-xs italic text-fg-muted">Sin inicio (la primera)</span>
              ) : (
                <input
                  value={e.anioInicio}
                  onChange={(ev) =>
                    cambiarEras(eras.map((x) => (x.id === e.id ? { ...x, anioInicio: ev.target.value.replace(/[^\d-]/g, "") } : x)))
                  }
                  placeholder="Año de inicio"
                  inputMode="numeric"
                  className={cn(inputCls, "w-40 font-mono", !e.anioInicio && "border-warning/60")}
                />
              )}
              <button
                type="button"
                onClick={() => cambiarEras(eras.filter((x) => x.id !== e.id))}
                className="rounded p-1 text-fg-muted hover:text-error"
                aria-label="Quitar era"
              >
                <Icon name="X" size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={cn(botonCls, "mt-3")}
          onClick={() => cambiarEras([...eras, { id: idNuevo(), nombre: "", abreviatura: "", anioInicio: "" }])}
        >
          <Icon name="Plus" size={14} /> Era
        </button>
      </Bloque>

      {/* ── Probador ──────────────────────────────────────────────────── */}
      <Bloque
        titulo="Probar una fecha"
        ayuda="Escribe una fecha para ver cómo la leerá el público con el calendario de arriba, aunque aún no lo hayas guardado. No se guarda nada."
      >
        <FechaInput cal={actual} value={prueba} onChange={setPrueba} />
      </Bloque>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t border-border-base bg-deep/90 px-6 py-3 backdrop-blur">
        {cambios && <span className="text-xs text-warning">Hay cambios sin guardar</span>}
        <button
          type="button"
          onClick={guardar}
          disabled={pending || !cambios}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-void disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Guardar calendario"}
        </button>
      </div>
    </div>
  );
}

function Bloque({
  titulo,
  resumen,
  ayuda,
  children,
}: {
  titulo: string;
  resumen?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-base bg-deep/40 p-5">
      <div className="mb-1 flex items-baseline gap-3">
        <h2 className="font-display text-lg text-fg">{titulo}</h2>
        {resumen && <span className="text-sm text-accent">{resumen}</span>}
      </div>
      {ayuda && <p className="mb-4 text-xs text-fg-muted">{ayuda}</p>}
      {children}
    </section>
  );
}

function Orden({ onArriba, onAbajo }: { onArriba: () => void; onAbajo: () => void }) {
  return (
    <div className="flex flex-col text-fg-muted">
      <button type="button" onClick={onArriba} className="hover:text-fg" aria-label="Subir">
        <Icon name="ChevronUp" size={14} />
      </button>
      <button type="button" onClick={onAbajo} className="hover:text-fg" aria-label="Bajar">
        <Icon name="ChevronDown" size={14} />
      </button>
    </div>
  );
}
