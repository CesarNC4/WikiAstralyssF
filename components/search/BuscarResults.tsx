"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { EntityCard } from "@/components/entity/EntityCard";
import { Icon } from "@/components/Icon";
import { ENTITIES, ENTITY_LIST, type EntityKey } from "@/lib/entities";
import type { SearchResult } from "@/lib/types";
import type { EntityCard as EntityCardData } from "@/lib/types";

const TIPO_ORDER = new Map(ENTITY_LIST.map((e, i) => [e.key, i] as const));

/** Resultados de la página /buscar: barra de búsqueda + chips de tipo + grid. */
export function BuscarResults({ query, results }: { query: string; results: SearchResult[] }) {
  const router = useRouter();
  const [term, setTerm] = useState(query);
  const [tipo, setTipo] = useState<EntityKey | "todos">("todos");

  // Conteo por tipo, ordenado según el catálogo de entidades.
  const tipos = useMemo(() => {
    const counts = new Map<EntityKey, number>();
    for (const r of results) counts.set(r.tipo, (counts.get(r.tipo) ?? 0) + 1);
    return [...counts.entries()].sort(
      (a, b) => (TIPO_ORDER.get(a[0]) ?? 99) - (TIPO_ORDER.get(b[0]) ?? 99),
    );
  }, [results]);

  const filtered = useMemo(
    () => (tipo === "todos" ? results : results.filter((r) => r.tipo === tipo)),
    [results, tipo],
  );

  const cards: (EntityCardData & { tipo: EntityKey })[] = filtered.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    subtitulo: r.subtitulo,
    imagenUrl: r.imagenUrl,
    href: r.href,
    badge: ENTITIES[r.tipo]?.singular ?? r.tipoLabel,
    tipo: r.tipo,
  }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = term.trim();
    if (t.length >= 2) router.push(`/buscar?q=${encodeURIComponent(t)}`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12">
      <header className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
            <Icon name="Search" className="text-primary" size={22} />
          </span>
          <div>
            <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Buscar</h1>
            <p className="text-sm text-fg-muted">
              {query
                ? `${results.length} resultado${results.length === 1 ? "" : "s"} para “${query}”.`
                : "Explora todo el universo de Astralys."}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="relative max-w-xl">
          <Icon name="Search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar personajes, naciones, magia, bestias…"
            className="w-full rounded-2xl border border-border-base bg-surface/60 py-3 pl-12 pr-4 text-fg outline-none focus:border-border-glow"
          />
        </form>
      </header>

      {/* Chips de tipo */}
      {results.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Chip active={tipo === "todos"} onClick={() => setTipo("todos")} label="Todos" count={results.length} />
          {tipos.map(([t, n]) => (
            <Chip
              key={t}
              active={tipo === t}
              onClick={() => setTipo(t)}
              label={ENTITIES[t]?.plural ?? t}
              icon={ENTITIES[t]?.icon}
              accent={ENTITIES[t]?.accent}
              count={n}
            />
          ))}
        </div>
      )}

      {/* Grid */}
      {query.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-border-base py-20 text-center text-fg-muted">
          Escribe al menos 2 caracteres para buscar.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-base py-20 text-center text-fg-muted">
          Sin resultados para “{query}”.
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.025 } } }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5"
        >
          {cards.map((card) => (
            <motion.div
              key={`${card.tipo}-${card.href}`}
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
            >
              <EntityCard card={card} accent={ENTITIES[card.tipo]?.accent} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
  icon,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: string;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-border-glow bg-elevated text-fg"
          : "border-border-base bg-surface/50 text-fg-muted hover:text-fg"
      }`}
    >
      {icon && <Icon name={icon} size={13} className={accent} />}
      {label}
      <span className="text-fg-muted">{count}</span>
    </button>
  );
}
