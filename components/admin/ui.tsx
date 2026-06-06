"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EstadoPublicacion } from "@/db/schema/enums";

// ── Sección en acordeón ─────────────────────────────────────────────────────
export function AccordionSection({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-border-base bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className={cn("text-fg-muted transition-transform", open && "rotate-90")}>▸</span>
        <span className="font-display text-base text-fg">{title}</span>
        {subtitle && <span className="text-xs text-fg-muted">{subtitle}</span>}
        <span className="ml-auto">{badge}</span>
      </button>
      {open && <div className="border-t border-border-base px-4 py-4">{children}</div>}
    </section>
  );
}

// ── Badge de estado de publicación ──────────────────────────────────────────
export function EstadoBadge({ estado }: { estado: EstadoPublicacion }) {
  const map: Record<EstadoPublicacion, string> = {
    publicado: "border-success/40 text-success",
    borrador: "border-warning/40 text-warning",
    oculto: "border-fg-muted/40 text-fg-muted",
  };
  const label: Record<EstadoPublicacion, string> = {
    publicado: "Publicado",
    borrador: "Borrador",
    oculto: "Oculto",
  };
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", map[estado])}>
      {label[estado]}
    </span>
  );
}

// ── Repetidor de listas (añadir / quitar / reordenar) ───────────────────────
export function Repeater<T>({
  items,
  onChange,
  blank,
  addLabel,
  emptyLabel = "Nada añadido aún.",
  renderItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  addLabel: string;
  emptyLabel?: string;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}) {
  const update = (i: number, patch: Partial<T>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-fg-muted">{emptyLabel}</p>}
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-border-base bg-deep/40 p-3">
          <div className="mb-2 flex items-center gap-1">
            <span className="text-xs text-fg-muted">#{i + 1}</span>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} className="rounded px-1.5 text-fg-muted hover:text-fg" title="Subir">↑</button>
              <button type="button" onClick={() => move(i, 1)} className="rounded px-1.5 text-fg-muted hover:text-fg" title="Bajar">↓</button>
              <button type="button" onClick={() => remove(i)} className="rounded px-1.5 text-fg-muted hover:text-error" title="Quitar">✕</button>
            </div>
          </div>
          {renderItem(item, (patch) => update(i, patch), i)}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, blank()])}
        className="rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg"
      >
        + {addLabel}
      </button>
    </div>
  );
}

// ── Selector múltiple con buscador (para N:M) ───────────────────────────────
export function MultiPicker({
  options,
  selectedIds,
  onAdd,
  placeholder = "Buscar…",
}: {
  options: { id: number; label: string }[];
  selectedIds: number[];
  onAdd: (id: number, label: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = options
    .filter((o) => !selectedIds.includes(o.id))
    .filter((o) => (q ? o.label.toLowerCase().includes(q.toLowerCase()) : true))
    .slice(0, 8);
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-border-glow"
      />
      {q && (
        <div className="mt-1 max-h-44 overflow-auto rounded-lg border border-border-base bg-elevated p-1">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onAdd(o.id, o.label);
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
  );
}
