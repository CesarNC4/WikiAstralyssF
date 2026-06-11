"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { EntityCard } from "@/components/entity/EntityCard";
import { Icon } from "@/components/Icon";
import { ENTITY_FACETS, type EntityMeta } from "@/lib/entities";
import type { EntityCard as EntityCardData } from "@/lib/types";

/** Patrón índice reutilizable (§5.3): cabecera + filtro + facetas + grid escalonado. */
export function EntityIndex({
  meta,
  cards,
}: {
  meta: EntityMeta;
  cards: EntityCardData[];
}) {
  const [q, setQ] = useState("");
  // Selección por dimensión de faceta: dimKey → valores activos (OR dentro, AND entre).
  const [facetSel, setFacetSel] = useState<Record<string, string[]>>({});

  // Dimensiones de faceta con valores realmente presentes en los datos.
  const facetGroups = useMemo(() => {
    const defs = ENTITY_FACETS[meta.key] ?? [];
    return defs
      .map((def) => {
        const values = [
          ...new Set(
            cards
              .map((c) => c.facets?.[def.key])
              .filter((v): v is string => !!v && v.trim() !== ""),
          ),
        ].sort((a, b) => a.localeCompare(b));
        return { ...def, values };
      })
      .filter((g) => g.values.length > 0);
  }, [meta.key, cards]);

  const toggleFacet = (dim: string, value: string) =>
    setFacetSel((prev) => {
      const cur = prev[dim] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [dim]: next };
    });

  const activeFacetCount = Object.values(facetSel).reduce((n, v) => n + v.length, 0);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (term) {
        const hit =
          c.titulo.toLowerCase().includes(term) ||
          (c.subtitulo ?? "").toLowerCase().includes(term) ||
          (c.badge ?? "").toLowerCase().includes(term);
        if (!hit) return false;
      }
      for (const [dim, vals] of Object.entries(facetSel)) {
        if (vals.length === 0) continue;
        const cv = c.facets?.[dim];
        if (!cv || !vals.includes(cv)) return false;
      }
      return true;
    });
  }, [q, cards, facetSel]);

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

      {/* Filtros facetados (solo dimensiones con datos) */}
      {facetGroups.length > 0 && (
        <div className="mb-6 space-y-3">
          {facetGroups.map((g) => (
            <div key={g.key} className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-fg-muted">
                {g.label}
              </span>
              {g.values.map((v) => {
                const on = (facetSel[g.key] ?? []).includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => toggleFacet(g.key, v)}
                    className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                      on
                        ? "border-border-glow bg-elevated text-fg"
                        : "border-border-base bg-surface/50 text-fg-muted hover:text-fg"
                    }`}
                  >
                    {v.toLowerCase()}
                  </button>
                );
              })}
            </div>
          ))}
          {activeFacetCount > 0 && (
            <button
              onClick={() => setFacetSel({})}
              className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
            >
              <Icon name="X" size={12} /> Limpiar filtros
            </button>
          )}
        </div>
      )}

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
