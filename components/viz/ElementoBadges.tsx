import { Icon } from "@/components/Icon";
import { elementoMeta } from "@/lib/elementos";

export interface ElementoTag {
  slug: string;
  nombre: string;
  color: string | null;
  icono: string | null;
}

/** Una pastilla de elemento con su color/icono. */
export function ElementoBadge({ el, size = "md" }: { el: ElementoTag; size?: "sm" | "md" }) {
  const meta = elementoMeta(el.slug) ?? elementoMeta(el.nombre);
  const color = el.color ?? meta?.color ?? "#9aa3b2";
  const icono = el.icono ?? meta?.icono ?? "Circle";
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pad}`}
      style={{ borderColor: `${color}66`, background: `${color}1a`, color }}
    >
      <Icon name={icono} size={size === "sm" ? 11 : 13} /> {el.nombre}
    </span>
  );
}

/** Grupo etiquetado de elementos (p.ej. "Debilidades"). */
export function ElementoGroup({ label, icon, items }: { label: string; icon?: string; items: ElementoTag[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-fg-muted">
        {icon && <Icon name={icon} size={12} />} {label}
      </span>
      {items.map((el) => (
        <ElementoBadge key={el.slug + label} el={el} size="sm" />
      ))}
    </div>
  );
}
