"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { FechaTexto } from "@/components/fechas/Lectura";
import { metaTipoSuceso, type RefSuceso, type Suceso } from "@/lib/cronologia";

export type Ev = Suceso;

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

/**
 * Color de un suceso: los eventos, el de su categoría (si la tiene y no es
 * "Otro"); lo demás, el de su tipo de suceso.
 */
export function colorDe(ev: Ev): string {
  if (ev.tipo === "evento" && ev.categoria && ev.categoria !== "Otro" && CATEGORIAS[ev.categoria]) return CATEGORIAS[ev.categoria].color;
  return metaTipoSuceso(ev.tipo).color;
}

function iconoDe(ev: Ev): string {
  if (ev.tipo === "evento" && ev.categoria && CATEGORIAS[ev.categoria]) return CATEGORIAS[ev.categoria].icon;
  return metaTipoSuceso(ev.tipo).icono;
}

const ICONO_REF: Record<string, string> = {
  capitulos: "ScrollText",
  actos: "BookOpen",
  locaciones: "MapPin",
  personajes: "Users",
  timeline: "Clock",
};

function Enlace({ r, etiqueta }: { r: RefSuceso; etiqueta?: string }) {
  const contenido = (
    <>
      <Icon name={ICONO_REF[r.tipo] ?? "ArrowRight"} size={15} className="text-secondary" />
      <span className="min-w-0 flex-1 truncate text-fg">
        {etiqueta && <span className="text-fg-muted">{etiqueta}: </span>}
        {r.nombre}
      </span>
      {r.href && <Icon name="ArrowRight" size={13} className="text-fg-muted" />}
    </>
  );
  const cls = "flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm";
  return r.href ? (
    <Link href={r.href} className={`${cls} hover:border-border-glow`}>
      {contenido}
    </Link>
  ) : (
    <div className={cls}>{contenido}</div>
  );
}

/** Panel de detalle deslizante de un suceso (drawer lateral / hoja inferior). */
export function DetallePanel({ ev, onClose }: { ev: Ev; onClose: () => void }) {
  const color = colorDe(ev);
  const tipo = metaTipoSuceso(ev.tipo);
  const lugares = [ev.entidad, ev.capitulo, ev.acto, ev.locacion].filter((r): r is RefSuceso => r != null);
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
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-border-base text-fg-muted hover:text-fg">
          <Icon name="X" size={16} />
        </button>
        <p className="pr-10 font-mono text-sm" style={{ color }}>
          <FechaTexto t={ev.textos} />
        </p>
        <h2 className="mt-1 font-display text-2xl text-fg">{ev.titulo}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs" style={{ background: `${color}1f`, color }}>
            <Icon name={iconoDe(ev)} size={11} /> {ev.categoria ?? tipo.etiqueta}
          </span>
          {ev.era && <span className="rounded-full border border-border-base px-2.5 py-0.5 text-xs text-fg-muted">{ev.era.nombre}</span>}
          {ev.importancia && <span className="rounded-full border border-accent/40 px-2.5 py-0.5 text-xs text-accent">{ev.importancia}</span>}
        </div>
        {ev.descripcion && <p className="mt-4 whitespace-pre-line leading-relaxed text-fg-secondary">{ev.descripcion}</p>}

        {lugares.length > 0 && (
          <div className="mt-6 space-y-2 border-t border-border-base pt-4">
            {lugares.map((r) => (
              <Enlace key={`${r.tipo}:${r.id}`} r={r} etiqueta={r === ev.entidad ? "Ficha" : undefined} />
            ))}
          </div>
        )}

        {ev.personajes.length > 0 && (
          <div className="mt-6 border-t border-border-base pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-fg-muted">
              <Icon name="Users" size={13} /> Protagonistas
            </p>
            <div className="flex flex-wrap gap-2">
              {ev.personajes.map((p) => (
                <Link
                  key={p.id}
                  href={p.href ?? `/personajes/${p.id}`}
                  className="flex items-center gap-2 rounded-full border border-border-base bg-surface/40 py-1 pl-1 pr-3 text-sm hover:border-border-glow"
                >
                  <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full">
                    <EntityImage src={p.imagenUrl ?? null} alt={p.nombre} name={p.nombre} sizes="28px" />
                  </span>
                  <span className="text-fg">{p.nombre}</span>
                </Link>
              ))}
            </div>
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
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
      style={active ? { borderColor: color ?? "var(--color-primary,#8b7bff)", background: `${color ?? "#8b7bff"}22`, color: color ?? "#cdc4ff" } : { borderColor: "var(--border-base)", color: "var(--fg-muted)" }}
    >
      {icon && <Icon name={icon} size={12} style={active ? undefined : { color }} />}
      {children}
    </button>
  );
}
