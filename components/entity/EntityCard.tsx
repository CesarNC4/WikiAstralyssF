import Link from "next/link";
import { EntityImage } from "@/components/media/EntityImage";
import { Badge } from "@/components/entity/Badge";
import { cn, truncate } from "@/lib/utils";
import type { EntityCard as EntityCardData } from "@/lib/types";

/** Card de entidad para páginas índice (§5.1). Ratio fijo → cero layout shift. */
export function EntityCard({ card, accent }: { card: EntityCardData; accent?: string }) {
  return (
    <Link
      href={card.href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border-base bg-surface/50",
        "transition-all duration-300 hover:border-border-glow hover:-translate-y-1",
        "hover:shadow-[var(--shadow-glow-primary)]",
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <EntityImage
          src={card.imagenUrl}
          alt={card.titulo}
          name={card.titulo}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-transparent" />
        {card.badge && (
          <div className="absolute right-2 top-2">
            <Badge tone="primary">{card.badge}</Badge>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3
            className={cn(
              "font-display text-lg leading-tight text-fg drop-shadow",
              accent && `group-hover:${accent}`,
            )}
          >
            {card.titulo}
          </h3>
          {card.subtitulo && (
            <p className="mt-0.5 text-xs text-fg-secondary">{truncate(card.subtitulo, 48)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
