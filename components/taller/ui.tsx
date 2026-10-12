"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Piezas visuales compartidas por las pantallas del taller. */

export const inputCls =
  "w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-border-glow";
export const botonCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-border-base px-3 py-1.5 text-xs text-fg-secondary transition-colors hover:border-border-glow hover:text-fg disabled:opacity-40";
export const botonPrimarioCls =
  "inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-void transition-opacity disabled:opacity-40";

export function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">{children}</span>;
}

export function Campo({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <Etiqueta>{label}</Etiqueta>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}
    </label>
  );
}

/** Desplegable de textos, con opción vacía. Conserva un valor que ya no esté en la lista. */
export function SelectTexto({
  value,
  onChange,
  opciones,
  vacio = "—",
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
  vacio?: string;
}) {
  const lista = value && !opciones.includes(value) ? [value, ...opciones] : opciones;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{vacio}</option>
      {lista.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Desplegable de fichas por id. */
export function SelectId({
  value,
  onChange,
  opciones,
  vacio = "—",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  opciones: { id: number; label: string }[];
  vacio?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={inputCls}
    >
      <option value="">{vacio}</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const COLOR_ESTADO: Record<string, string> = {
  publicado: "bg-success",
  borrador: "bg-fg-muted",
  oculto: "bg-warning",
};

/** Punto de color del estado de publicación, con su nombre al pasar el ratón. */
export function PuntoEstado({ estado }: { estado: string }) {
  return (
    <span
      title={estado.charAt(0).toUpperCase() + estado.slice(1)}
      className={cn("inline-block size-2 shrink-0 rounded-full", COLOR_ESTADO[estado] ?? "bg-fg-muted")}
    />
  );
}

/** Insignia de una fase de estructura, con su color. */
export function InsigniaFase({ fase }: { fase: { nombre: string; abreviatura: string | null; color: string | null } | null | undefined }) {
  if (!fase) return null;
  const color = fase.color || "#9aa3b2";
  return (
    <span
      title={fase.nombre}
      className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }}
    >
      {fase.abreviatura || fase.nombre}
    </span>
  );
}

export const ESTADOS_PUBLICACION = [
  { valor: "borrador", label: "Borrador" },
  { valor: "publicado", label: "Publicado" },
  { valor: "oculto", label: "Oculto" },
] as const;

export function SelectEstado({ value, onChange }: { value: string; onChange: (v: "borrador" | "publicado" | "oculto") => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "borrador" | "publicado" | "oculto")}
      className={cn(inputCls, "w-auto")}
    >
      {ESTADOS_PUBLICACION.map((e) => (
        <option key={e.valor} value={e.valor}>
          {e.label}
        </option>
      ))}
    </select>
  );
}
