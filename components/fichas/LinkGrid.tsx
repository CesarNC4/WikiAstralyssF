import Link from "next/link";
import { EntityImage } from "@/components/media/EntityImage";

export interface LinkGridItem {
  id: number;
  nombre: string;
  img: string | null;
  nota?: string | null;
  href: string;
}

/** Rejilla de tarjetas-enlace con avatar + nombre + nota (reutilizable en fichas). */
export function LinkGrid({ items }: { items: LinkGridItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((i) => (
        <Link
          key={`${i.href}-${i.id}`}
          href={i.href}
          className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2 pr-4 transition-colors hover:border-border-glow"
        >
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
            <EntityImage src={i.img} alt={i.nombre} name={i.nombre} sizes="36px" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">{i.nombre}</p>
            {i.nota && <p className="truncate text-xs text-fg-muted">{i.nota}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
