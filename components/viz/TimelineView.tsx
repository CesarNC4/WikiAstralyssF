"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Evento {
  id: number;
  fechaLore: string;
  titulo: string;
  descripcion: string | null;
  importancia: string | null;
  categoria: string | null;
}

/**
 * Cronología vertical (§10.2, §16). Degrada de forma natural en móvil (scroll).
 * Filtro por categoría en cliente sobre el dataset (pequeño).
 */
export function TimelineView({ eventos }: { eventos: Evento[] }) {
  const categorias = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.categoria).filter(Boolean))) as string[],
    [eventos],
  );
  const [filtro, setFiltro] = useState<string | null>(null);
  const visibles = filtro ? eventos.filter((e) => e.categoria === filtro) : eventos;

  return (
    <div>
      {categorias.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Chip active={filtro === null} onClick={() => setFiltro(null)}>
            Todo
          </Chip>
          {categorias.map((c) => (
            <Chip key={c} active={filtro === c} onClick={() => setFiltro(c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}

      <ol className="relative border-l-2 border-border-glow pl-6">
        {visibles.map((e, i) => (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3) }}
            className="relative mb-8"
          >
            <span
              className={cn(
                "absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-void",
                e.importancia === "Crítica" || e.importancia === "Mayor"
                  ? "bg-accent"
                  : "bg-primary",
              )}
            />
            <p className="font-mono text-sm text-secondary">{e.fechaLore}</p>
            <h3 className="font-display text-lg text-fg">{e.titulo}</h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {e.categoria && (
                <span className="rounded-full border border-border-base px-2 py-0.5 text-[11px] text-fg-muted">
                  {e.categoria}
                </span>
              )}
              {e.importancia && (
                <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent">
                  {e.importancia}
                </span>
              )}
            </div>
            {e.descripcion && <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{e.descripcion}</p>}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary/15 text-primary" : "border-border-base text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
