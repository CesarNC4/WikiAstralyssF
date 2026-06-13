"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import type { TimelineEventoPublico } from "@/lib/queries/extra";

export type Ev = TimelineEventoPublico;

/** Identidad de color/icono por categoría de evento (compartida entre diseños). */
export const CATEGORIAS: Record<string, { color: string; icon: string }> = {
  Magico: { color: "#8b7bff", icon: "Sparkles" },
  Mágico: { color: "#8b7bff", icon: "Sparkles" },
  Politico: { color: "#5b8def", icon: "Landmark" },
  Político: { color: "#5b8def", icon: "Landmark" },
  Militar: { color: "#f87171", icon: "Swords" },
  Cosmico: { color: "#2dd4bf", icon: "Star" },
  Cósmico: { color: "#2dd4bf", icon: "Star" },
  Otro: { color: "#9aa3b2", icon: "Circle" },
};
export const catMeta = (c: string | null) => (c && CATEGORIAS[c]) || { color: "#9aa3b2", icon: "Circle" };

/** Panel de detalle deslizante de un evento (drawer lateral / hoja inferior). */
export function DetallePanel({ ev, onClose }: { ev: Ev; onClose: () => void }) {
  const meta = catMeta(ev.categoria);
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[90] bg-void/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed inset-x-0 bottom-0 z-[91] max-h-[80vh] overflow-y-auto rounded-t-3xl border border-border-glow bg-deep p-6 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-l-3xl sm:rounded-tr-none"
        initial={{ y: "100%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      >
        <button onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-border-base text-fg-muted hover:text-fg">
          <Icon name="X" size={16} />
        </button>
        <p className="font-mono text-sm" style={{ color: meta.color }}>{ev.fechaLore}</p>
        <h2 className="mt-1 font-display text-2xl text-fg">{ev.titulo}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ev.era && <span className="rounded-full border border-border-base px-2.5 py-0.5 text-xs text-fg-muted">{ev.era}</span>}
          {ev.categoria && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs" style={{ background: `${meta.color}1f`, color: meta.color }}>
              <Icon name={meta.icon} size={11} /> {ev.categoria}
            </span>
          )}
          {ev.importancia && <span className="rounded-full border border-accent/40 px-2.5 py-0.5 text-xs text-accent">{ev.importancia}</span>}
        </div>
        {ev.descripcion && <p className="mt-4 whitespace-pre-line leading-relaxed text-fg-secondary">{ev.descripcion}</p>}

        {(ev.capitulo || ev.locacion) && (
          <div className="mt-6 space-y-2 border-t border-border-base pt-4">
            {ev.capitulo && (
              <div className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm">
                <Icon name="ScrollText" size={15} className="text-secondary" />
                <span className="text-fg">Cap. {ev.capitulo.numero} — {ev.capitulo.titulo}</span>
              </div>
            )}
            {ev.locacion && (
              <Link href={`/locaciones/${ev.locacion.id}`} className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm hover:border-border-glow">
                <Icon name="MapPin" size={15} className="text-accent" />
                <span className="text-fg">{ev.locacion.nombre}</span>
                <Icon name="ArrowRight" size={13} className="ml-auto text-fg-muted" />
              </Link>
            )}
          </div>
        )}
      </motion.aside>
    </>
  );
}

/** Chip de filtro reutilizable. */
export function Chip({
  active,
  onClick,
  children,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
      style={active ? { borderColor: color ?? "var(--color-primary,#8b7bff)", background: `${color ?? "#8b7bff"}22`, color: color ?? "#cdc4ff" } : { borderColor: "var(--border-base)", color: "var(--fg-muted)" }}
    >
      {icon && <Icon name={icon} size={12} style={active ? undefined : { color }} />}
      {children}
    </button>
  );
}

/** Barra de filtros (categoría + solo mayores) común a los diseños. */
export function FiltrosTimeline({
  categorias,
  cat,
  setCat,
  soloMayor,
  setSoloMayor,
}: {
  categorias: string[];
  cat: string | null;
  setCat: (c: string | null) => void;
  soloMayor: boolean;
  setSoloMayor: (v: boolean) => void;
}) {
  return (
    <div className="sticky top-14 z-30 mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border-base bg-deep/70 p-2 backdrop-blur-xl">
      <Chip active={!cat} onClick={() => setCat(null)}>Todo</Chip>
      {categorias.map((c) => (
        <Chip key={c} active={cat === c} color={catMeta(c).color} icon={catMeta(c).icon} onClick={() => setCat(cat === c ? null : c)}>
          {c}
        </Chip>
      ))}
      <span className="mx-1 h-5 w-px bg-border-base" />
      <Chip active={soloMayor} color="#e0b34a" icon="Star" onClick={() => setSoloMayor(!soloMayor)}>
        Solo mayores
      </Chip>
    </div>
  );
}
