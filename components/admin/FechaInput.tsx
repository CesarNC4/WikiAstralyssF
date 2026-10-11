"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatoFecha,
  segmentosOrdenados,
  validarFecha,
  type Calendario,
  type Extremo,
  type Fecha,
} from "@/lib/fechas";

/**
 * Editor de una fecha del lore (spec §13): un punto o un rango, cada extremo con
 * su propia precisión (año · año + mes · año + mes + día), y la marca de
 * aproximada. Enseña debajo cómo la leerá el público en las dos lecturas.
 *
 * Controlado: `value` null es "sin fecha". Mientras el año está a medio escribir
 * (vacío o solo "-") se emite null, así que el padre nunca recibe una fecha rota.
 */

const inputCls =
  "rounded-lg border border-border-base bg-surface px-2.5 py-1.5 text-sm text-fg outline-none transition-colors focus:border-border-glow";

interface ExtremoTexto {
  anio: string;
  segmentoId: string;
  dia: string;
}

const vacio: ExtremoTexto = { anio: "", segmentoId: "", dia: "" };

function aTexto(e: Extremo | null | undefined): ExtremoTexto {
  if (!e) return vacio;
  return { anio: String(e.anio), segmentoId: e.segmentoId != null ? String(e.segmentoId) : "", dia: e.dia != null ? String(e.dia) : "" };
}

function aExtremo(t: ExtremoTexto): Extremo | null {
  if (!/^-?\d+$/.test(t.anio.trim())) return null;
  const segmentoId = t.segmentoId ? Number(t.segmentoId) : null;
  const dia = segmentoId != null && /^\d+$/.test(t.dia.trim()) ? Number(t.dia) : null;
  return { anio: Number(t.anio), segmentoId, dia };
}

export function FechaInput({
  cal,
  value,
  onChange,
}: {
  cal: Calendario;
  value: Fecha | null;
  onChange: (f: Fecha | null) => void;
}) {
  // El texto vive aquí para poder escribir "-" o borrar el año sin perder lo demás.
  const [ini, setIni] = useState<ExtremoTexto>(() => aTexto(value?.ini));
  const [fin, setFin] = useState<ExtremoTexto>(() => aTexto(value?.fin));
  const [esRango, setEsRango] = useState(value?.fin != null);
  const [aproximada, setAproximada] = useState(value?.aproximada ?? false);

  const emitir = (p: { ini?: ExtremoTexto; fin?: ExtremoTexto; esRango?: boolean; aproximada?: boolean }) => {
    const i = aExtremo(p.ini ?? ini);
    const rango = p.esRango ?? esRango;
    const f = rango ? aExtremo(p.fin ?? fin) : null;
    if (!i || (rango && !f)) return onChange(null);
    onChange({ ini: i, fin: f, aproximada: p.aproximada ?? aproximada });
  };

  const errores = value ? validarFecha(cal, value) : [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-border-base text-xs">
          {(["Fecha", "Rango"] as const).map((t) => {
            const activo = (t === "Rango") === esRango;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setEsRango(t === "Rango");
                  emitir({ esRango: t === "Rango" });
                }}
                className={cn("px-3 py-1.5", activo ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
              >
                {t}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
          <input
            type="checkbox"
            checked={aproximada}
            onChange={(e) => {
              setAproximada(e.target.checked);
              emitir({ aproximada: e.target.checked });
            }}
          />
          Aproximada
        </label>
      </div>

      <ExtremoEditor
        cal={cal}
        etiqueta={esRango ? "Desde" : undefined}
        valor={ini}
        onChange={(v) => {
          setIni(v);
          emitir({ ini: v });
        }}
      />
      {esRango && (
        <ExtremoEditor
          cal={cal}
          etiqueta="Hasta"
          valor={fin}
          onChange={(v) => {
            setFin(v);
            emitir({ fin: v });
          }}
        />
      )}

      {value && errores.length === 0 && (
        <p className="text-xs text-fg-muted">
          <span className="text-fg-secondary">{formatoFecha(cal, value, "eras")}</span>
          <span className="mx-2">·</span>
          {formatoFecha(cal, value, "absoluto")}
        </p>
      )}
      {errores.map((e) => (
        <p key={e} className="text-xs text-error">
          {e}
        </p>
      ))}
    </div>
  );
}

function ExtremoEditor({
  cal,
  etiqueta,
  valor,
  onChange,
}: {
  cal: Calendario;
  etiqueta?: string;
  valor: ExtremoTexto;
  onChange: (v: ExtremoTexto) => void;
}) {
  const segmentos = segmentosOrdenados(cal);
  const seg = segmentos.find((s) => String(s.id) === valor.segmentoId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {etiqueta && <span className="w-12 text-xs uppercase tracking-wide text-fg-muted">{etiqueta}</span>}
      <input
        value={valor.anio}
        onChange={(e) => onChange({ ...valor, anio: e.target.value.replace(/[^\d-]/g, "") })}
        placeholder="Año"
        inputMode="numeric"
        aria-label="Año"
        className={cn(inputCls, "w-24 font-mono")}
      />
      <select
        value={valor.segmentoId}
        onChange={(e) => onChange({ ...valor, segmentoId: e.target.value, dia: e.target.value ? valor.dia : "" })}
        aria-label="Mes"
        className={cn(inputCls, "w-44")}
      >
        <option value="">— Todo el año —</option>
        {segmentos.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
            {s.tipo === "intercalar" ? " (fuera de mes)" : ""}
          </option>
        ))}
      </select>
      <input
        value={valor.dia}
        onChange={(e) => onChange({ ...valor, dia: e.target.value.replace(/\D/g, "") })}
        placeholder="Día"
        inputMode="numeric"
        aria-label="Día"
        disabled={!seg}
        title={seg ? `1–${seg.dias}` : "Elige primero un mes"}
        className={cn(inputCls, "w-16 font-mono disabled:opacity-40")}
      />
    </div>
  );
}
