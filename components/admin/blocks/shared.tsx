"use client";

import { useRef, useState } from "react";
import { moveItem } from "@/lib/admin/complejas";

export const subInp =
  "rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow";

/**
 * Reordenado por arrastrar (HTML5 nativo) sobre un array controlado por el
 * padre. El estado de las filas vive en el padre, así que cada render recrea
 * los handlers con `items` actuales — sin refs ni startTransition.
 */
export function useDragList<T>(items: T[], onChange: (next: T[]) => void) {
  const dragIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const rowProps = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragIndex.current = i;
      setDragging(i);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragEnter: () => {
      const from = dragIndex.current;
      if (from === null || from === i) return;
      onChange(moveItem(items, from, i));
      dragIndex.current = i;
      setDragging(i);
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragEnd: () => {
      dragIndex.current = null;
      setDragging(null);
    },
  });

  return { rowProps, dragging };
}

export function DragHandle() {
  return (
    <span className="cursor-grab select-none px-1 text-fg-muted" title="Arrastrar para ordenar">
      ⠿
    </span>
  );
}

export function IconButton({
  onClick,
  title,
  children,
  danger,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "rounded border px-2 py-1 text-xs " +
        (danger
          ? "border-error/40 text-error hover:bg-error/10"
          : "border-border-base text-fg-secondary hover:text-fg")
      }
    >
      {children}
    </button>
  );
}

export interface Opcion {
  id: number;
  label: string;
}

/**
 * Identidad de un miembro: o bien una ficha de personaje enlazada, o bien un
 * nombre libre (NPC sin ficha). Devuelve { personajeId, nombre }.
 */
export function MiembroPicker({
  personajeId,
  nombre,
  options,
  onChange,
}: {
  personajeId: number | null;
  nombre: string;
  options: Opcion[];
  onChange: (v: { personajeId: number | null; nombre: string }) => void;
}) {
  const [q, setQ] = useState("");
  const linked = personajeId != null ? options.find((o) => o.id === personajeId) : undefined;

  if (personajeId != null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/5 px-2 py-1.5 text-sm text-fg">
        <span className="text-accent">◆</span>
        {linked ? linked.label : `Ficha #${personajeId}`}
        <button
          type="button"
          className="ml-1 text-fg-muted hover:text-error"
          title="Desvincular ficha"
          onClick={() => onChange({ personajeId: null, nombre: linked?.label ?? nombre })}
        >
          ✕
        </button>
      </span>
    );
  }

  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  return (
    <div className="relative flex min-w-[12rem] items-center gap-1">
      <input
        value={nombre}
        onChange={(e) => onChange({ personajeId: null, nombre: e.target.value })}
        placeholder="Nombre del miembro"
        className={subInp + " flex-1"}
      />
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔗 ficha"
          className={subInp + " w-24"}
          title="Buscar y enlazar una ficha de personaje"
        />
        {q && (
          <div className="absolute right-0 z-30 mt-1 max-h-44 w-56 overflow-auto rounded-lg border border-border-glow bg-elevated p-1 shadow-xl">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange({ personajeId: o.id, nombre: "" });
                  setQ("");
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-fg-secondary hover:bg-surface hover:text-fg"
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2 py-1.5 text-xs text-fg-muted">Sin coincidencias.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Selector de color: presets del tema + hex ───────────────────────────────
const PRESETS = [
  "#c0392b", // rojo sangre
  "#d35400", // ámbar
  "#f1c40f", // oro
  "#27ae60", // esmeralda
  "#16a085", // jade
  "#2980b9", // zafiro
  "#8e44ad", // amatista
  "#c2185b", // carmesí
  "#7f8c8d", // acero
  "#2c3e50", // pizarra
];

export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = value || "";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className={
              "h-6 w-6 rounded-full border transition-transform hover:scale-110 " +
              (v.toLowerCase() === c.toLowerCase() ? "border-2 border-fg" : "border-border-base")
            }
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#888888"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-border-base bg-surface"
          title="Color personalizado"
        />
        <input
          value={v}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#rrggbb"
          className={subInp + " w-24 font-mono"}
        />
        {v && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-fg-muted hover:text-error" title="Sin color">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
