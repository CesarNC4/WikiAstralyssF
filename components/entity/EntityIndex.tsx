"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { EntityCard } from "@/components/entity/EntityCard";
import { Icon } from "@/components/Icon";
import type { EntityMeta } from "@/lib/entities";
import type { EntityCard as EntityCardData } from "@/lib/types";

/** Patrón índice reutilizable (§5.3): cabecera + filtro + grid escalonado. */
export function EntityIndex({
  meta,
  cards,
}: {
  meta: EntityMeta;
  cards: EntityCardData[];
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter(
      (c) =>
        c.titulo.toLowerCase().includes(term) ||
        (c.subtitulo ?? "").toLowerCase().includes(term) ||
        (c.badge ?? "").toLowerCase().includes(term),
    );
  }, [q, cards]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12">
      {/* Cabecera de sección */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
            <Icon name={meta.icon} className={meta.accent} size={22} />
          </span>
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-gradient-cosmic">{meta.plural}</h1>
            <p className="text-sm text-fg-muted">{meta.tagline}</p>
          </div>
        </div>
      </header>

      {/* Filtro local */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Filtrar ${meta.plural.toLowerCase()}…`}
            className="w-full rounded-xl border border-border-base bg-surface/60 py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted outline-none focus:border-border-glow"
          />
        </div>
        <span className="shrink-0 text-sm text-fg-muted">
          {filtered.length} / {cards.length}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-base py-20 text-center text-fg-muted">
          No hay {meta.plural.toLowerCase()} que coincidan.
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5"
        >
          {filtered.map((card) => (
            <motion.div
              key={`${card.href}`}
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
              }}
            >
              <EntityCard card={card} accent={meta.accent} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
