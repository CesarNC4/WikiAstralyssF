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

// ── Opciones de catálogo ────────────────────────────────────────────────────
/**
 * Una opción tal y como vive en la tabla `catalogos`. El `grupo` hace dos
 * papeles distintos según el catálogo: en unos es una dependencia (la variante
 * de un artefacto depende de su tipo) y en otros solo agrupa visualmente (las
 * familias de organización). Quien renderiza decide cuál de los dos.
 */
export interface OpcionCatalogo {
  valor: string;
  grupo: string | null;
}

/** Todos los catálogos que necesita un formulario, por nombre de campo. */
export type MapaCatalogos = Record<string, OpcionCatalogo[]>;

/** Acepta tanto la forma nueva como una lista suelta de textos. */
export type Opciones = readonly OpcionCatalogo[] | readonly string[];

function normalizar(options: Opciones): OpcionCatalogo[] {
  return options.map((o) => (typeof o === "string" ? { valor: o, grupo: null } : o));
}

// ── Select de catálogo ──────────────────────────────────────────────────────
/**
 * Desplegable alimentado por el catálogo.
 *
 * - `grupoActivo`: si se pasa, solo se ofrecen las opciones de ese grupo. Así se
 *   resuelven los campos dependientes (subtipo de relación, variante de
 *   artefacto): sin el campo padre elegido, aquí no hay nada que elegir.
 * - `onCrear`: permite escribir un valor que no está en la lista. Se guarda en
 *   el catálogo y queda disponible para todas las fichas, así que no ensucia.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  allowClear = true,
  grupoActivo,
  onCrear,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opciones;
  placeholder?: string;
  allowClear?: boolean;
  grupoActivo?: string | null;
  onCrear?: (valor: string, grupo: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const todas = normalizar(options);
  // Dependencia: con grupo activo solo valen las de ese grupo.
  const disponibles = grupoActivo === undefined ? todas : todas.filter((o) => o.grupo === grupoActivo);

  const filtradas = query
    ? disponibles.filter((o) => o.valor.toLowerCase().includes(query.toLowerCase()))
    : disponibles;
  const searchable = disponibles.length > 8;

  // Agrupación visual: solo cuando el grupo no se está usando como dependencia.
  const porGrupo: { grupo: string | null; items: OpcionCatalogo[] }[] = [];
  if (grupoActivo === undefined) {
    for (const o of filtradas) {
      const ultimo = porGrupo[porGrupo.length - 1];
      if (ultimo && ultimo.grupo === o.grupo) ultimo.items.push(o);
      else porGrupo.push({ grupo: o.grupo, items: [o] });
    }
  } else {
    porGrupo.push({ grupo: null, items: filtradas });
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const puedeCrear =
    !!onCrear &&
    query.trim().length > 0 &&
    !disponibles.some((o) => o.valor.toLowerCase() === query.trim().toLowerCase());

  const crear = () => {
    const v = query.trim();
    if (!v || !onCrear) return;
    void onCrear(v, grupoActivo ?? null);
    pick(v);
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
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border-glow bg-elevated p-1 shadow-xl">
          {(searchable || onCrear) && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && puedeCrear) {
                  e.preventDefault();
                  crear();
                }
              }}
              placeholder={onCrear ? "Filtrar o escribir uno nuevo…" : "Filtrar…"}
              className="mb-1 w-full rounded border border-border-base bg-surface px-2 py-1 text-sm text-fg outline-none"
            />
          )}
          {porGrupo.map((g) => (
            <div key={g.grupo ?? "__sin__"}>
              {g.grupo && (
                <p className="px-2 pb-0.5 pt-1.5 text-[10px] uppercase tracking-wider text-fg-muted">{g.grupo}</p>
              )}
              {g.items.map((o) => (
                <button
                  key={(g.grupo ?? "") + o.valor}
                  type="button"
                  onClick={() => pick(o.valor)}
                  className={cn(
                    "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface",
                    o.valor === value ? "text-accent" : "text-fg-secondary hover:text-fg",
                  )}
                >
                  {o.valor}
                </button>
              ))}
            </div>
          ))}
          {puedeCrear && (
            <button
              type="button"
              onClick={crear}
              className="mt-1 block w-full rounded border border-dashed border-border-glow px-2 py-1.5 text-left text-sm text-accent hover:bg-surface"
            >
              + Añadir «{query.trim()}» al catálogo
            </button>
          )}
          {filtradas.length === 0 && !puedeCrear && (
            <p className="px-2 py-1.5 text-xs text-fg-muted">
              {grupoActivo === null
                ? "Elige antes el campo del que depende."
                : disponibles.length === 0
                  ? "Sin opciones. Añádelas en Catálogos."
                  : "Sin coincidencias."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── MultiSelect (varios valores del mismo catálogo) ─────────────────────────
/** Para campos donde una ficha puede tener más de un valor: terreno, biomas… */
export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Añadir…",
  onCrear,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: Opciones;
  placeholder?: string;
  onCrear?: (valor: string, grupo: string | null) => void | Promise<void>;
}) {
  const disponibles = normalizar(options).filter((o) => !values.includes(o.valor));
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-base bg-surface/60 px-2.5 py-1 text-xs text-fg-secondary"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-fg-muted hover:text-error"
                aria-label={"Quitar " + v}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <Select
        value=""
        onChange={(v) => v && onChange([...values, v])}
        options={disponibles}
        placeholder={placeholder}
        allowClear={false}
        onCrear={onCrear}
      />
    </div>
  );
}

// ── MagiaPicker (selección estructurada de dos niveles: escuela + elemento) ──
/**
 * La variante de una magia no es una lista suya: es el catálogo elemental
 * filtrado por la familia que corresponde a la escuela elegida. "Antigua" ofrece
 * los Antiguos (Lumino, Umbra); "Elemental", los siete elementales.
 *
 * Antes se ofrecían todas las variantes de todas las escuelas mezcladas, porque
 * el cargador descartaba el grupo del catálogo.
 */
export function MagiaPicker({
  tipo,
  variante,
  onTipo,
  onVariante,
  tipos,
  elementos,
  familias,
}: {
  tipo: string;
  variante: string;
  onTipo: (v: string) => void;
  onVariante: (v: string) => void;
  tipos: Opciones;
  elementos: Opciones;
  /** Escuela → familia de elementos. Las escuelas sin entrada no tienen variante. */
  familias: Record<string, string>;
}) {
  const familia = tipo ? familias[tipo] : undefined;
  const hayVariantes = !!familia && normalizar(elementos).some((e) => e.grupo === familia);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        value={tipo}
        // Al cambiar la escuela se limpia la variante: la de antes pertenecía a
        // otra familia y dejarla ahí sería un dato incoherente.
        onChange={(t) => {
          onTipo(t);
          if (t !== tipo) onVariante("");
        }}
        options={tipos}
        placeholder="Escuela de magia"
      />
      {hayVariantes ? (
        <Select
          value={variante}
          onChange={onVariante}
          options={elementos}
          grupoActivo={familia ?? null}
          placeholder="Elemento"
        />
      ) : (
        <div className="grid place-items-center rounded-lg border border-dashed border-border-base px-2 text-center text-xs text-fg-muted">
          {tipo ? "Sin variantes" : "Elige la escuela"}
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
