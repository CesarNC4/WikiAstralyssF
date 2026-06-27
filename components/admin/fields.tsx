"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Markdown } from "@/components/markdown/Markdown";
import { cn } from "@/lib/utils";

// ── Campos base ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-border-glow";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label && <span className={labelCls}>{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputCls, "font-mono")}
    />
  );
}

// ── Slider 0-100 con valor numérico editable ───────────────────────────────
export function SliderInput({
  value,
  onChange,
  color = "var(--color-primary, #7b5cff)",
}: {
  value: string;
  onChange: (v: string) => void;
  color?: string;
}) {
  const n = value === "" ? null : Math.min(100, Math.max(0, Math.trunc(Number(value)) || 0));
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        value={n ?? 0}
        onChange={(e) => onChange(e.target.value)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface accent-primary"
        style={{ accentColor: color }}
      />
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        value={n ?? ""}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, "w-16 px-2 py-1 text-center font-mono")}
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 text-xs text-fg-muted hover:text-error"
          title="Vaciar"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ── Select estricto (solo elegir de una lista fija; sin texto libre) ─────────
export function Select({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  allowClear = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchable = options.length > 8;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options;
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(inputCls, "flex items-center text-left")}
        >
          <span className={value ? "text-fg" : "text-fg-muted"}>{value || placeholder}</span>
          <span className="ml-auto pl-2 text-fg-muted">▾</span>
        </button>
        {allowClear && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-lg border border-border-base px-2 py-2 text-xs text-fg-muted hover:text-error"
            title="Limpiar"
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border-glow bg-elevated p-1 shadow-xl">
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar…"
              className="mb-1 w-full rounded border border-border-base bg-surface px-2 py-1 text-sm text-fg outline-none"
            />
          )}
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => pick(o)}
              className={cn(
                "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface",
                o === value ? "text-accent" : "text-fg-secondary hover:text-fg",
              )}
            >
              {o}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-fg-muted">
              {options.length === 0 ? "Sin opciones (defínelas en lib/catalogos.ts)." : "Sin coincidencias."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── MagiaPicker (selección estructurada de dos niveles: tipo + variante) ─────
export function MagiaPicker({
  tipo,
  variante,
  onTipo,
  onVariante,
  tipos,
  variantes,
}: {
  tipo: string;
  variante: string;
  onTipo: (v: string) => void;
  onVariante: (v: string) => void;
  tipos: readonly string[];
  variantes: Record<string, readonly string[]>;
}) {
  const variantesDisp = variantes[tipo] ?? [];
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        value={tipo}
        // Al cambiar el tipo se limpia la variante (depende del tipo).
        onChange={(t) => {
          onTipo(t);
          if (t !== tipo) onVariante("");
        }}
        options={tipos}
        placeholder="Tipo de magia"
      />
      {variantesDisp.length > 0 ? (
        <Select value={variante} onChange={onVariante} options={variantesDisp} placeholder="Variante" />
      ) : (
        <div className="grid place-items-center rounded-lg border border-dashed border-border-base text-xs text-fg-muted">
          Sin variantes
        </div>
      )}
    </div>
  );
}

// ── Campo de referencia (enlace FK con buscador) ────────────────────────────
export function ReferenceField({
  value,
  onChange,
  options,
  placeholder = "Buscar y enlazar…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: number; label: string }[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const selected = options.find((o) => String(o.id) === value);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm">
        <span className="text-fg">{selected ? selected.label : `#${value}`}</span>
        <button type="button" className="ml-auto text-fg-muted hover:text-error" onClick={() => onChange("")}>✕</button>
      </div>
    );
  }

  const filtered = options.filter((o) => (q ? o.label.toLowerCase().includes(q.toLowerCase()) : true)).slice(0, 8);
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
      {q && (
        <div className="mt-1 max-h-44 overflow-auto rounded-lg border border-border-base bg-elevated p-1">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(String(o.id)); setQ(""); }}
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

// ── Campo markdown con preview ──────────────────────────────────────────────
export function MarkdownField({
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  return (
    <div className="rounded-lg border border-border-base bg-surface">
      <div className="flex items-center gap-1 border-b border-border-base px-2 py-1">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              tab === t ? "bg-elevated text-fg" : "text-fg-muted hover:text-fg-secondary",
            )}
          >
            {t === "edit" ? "Editar" : "Previsualizar"}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-fg-muted">
          **negrita** · *cursiva* · ||spoiler|| · &gt; cita · - lista · | tabla |
        </span>
      </div>
      {tab === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full resize-y bg-transparent px-3 py-2 text-sm text-fg outline-none"
        />
      ) : (
        <div className="min-h-[6rem] px-3 py-2">
          {value.trim() ? (
            <Markdown source={value} />
          ) : (
            <p className="text-sm text-fg-muted">Nada que previsualizar.</p>
          )}
        </div>
      )}
    </div>
  );
}
