"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import {
  ELEMENTOS,
  NATURALEZAS,
  NATURALEZA_LABEL,
  TIPOS_MAGIA,
  magiaVisual,
} from "@/lib/magia";
import type { MagiaIndexItem } from "@/lib/queries/magia";

/** Explorador de magia (§ puntos 11-12): sistema + hechizos por tipo, con filtros. */
export function MagiaExplorer({ items }: { items: MagiaIndexItem[] }) {
  const [q, setQ] = useState("");
  const [naturaleza, setNaturaleza] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [elemento, setElemento] = useState<string | null>(null);

  // Valores presentes en los datos.
  const present = useMemo(() => {
    const nat = new Set<string>();
    const tip = new Set<string>();
    const ele = new Set<string>();
    for (const it of items) {
      if (it.naturaleza) nat.add(it.naturaleza);
      if (it.tipo) tip.add(it.tipo);
      if (it.subcategoria && ELEMENTOS[it.subcategoria]) ele.add(it.subcategoria);
    }
    return { nat, tip, ele };
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((it) => {
      if (naturaleza && it.naturaleza !== naturaleza) return false;
      if (tipo && it.tipo !== tipo) return false;
      if (elemento && it.subcategoria !== elemento) return false;
      if (term) {
        const hit =
          it.nombre.toLowerCase().includes(term) ||
          (it.descripcion ?? "").toLowerCase().includes(term);
        if (!hit) return false;
      }
      return true;
    });
  }, [items, q, naturaleza, tipo, elemento]);

  // Secciones ordenadas: primero el sistema (por naturaleza), luego hechizos por tipo.
  const secciones = useMemo(() => {
    const out: { key: string; label: string; icon: string; color: string; items: MagiaIndexItem[] }[] = [];
    // Sistema
    for (const nat of NATURALEZAS.filter((n) => n.sistema)) {
      const subset = filtered.filter((it) => it.naturaleza === nat.key);
      if (subset.length) out.push({ key: `nat-${nat.key}`, label: nat.label, icon: nat.icon, color: nat.color, items: subset });
    }
    // Hechizos por tipo
    const hechizos = filtered.filter((it) => it.naturaleza === "Hechizo");
    const tipos = [...new Set(hechizos.map((it) => it.tipo).filter(Boolean) as string[])];
    for (const t of tipos) {
      const meta = TIPOS_MAGIA[t] ?? { label: t, icon: "Sparkles", color: "#8b7bff" };
      out.push({
        key: `tipo-${t}`,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        items: hechizos.filter((it) => it.tipo === t),
      });
    }
    // Hechizos sin tipo (por si acaso)
    const sinTipo = hechizos.filter((it) => !it.tipo);
    if (sinTipo.length) out.push({ key: "tipo-otros", label: "Otros hechizos", icon: "Sparkles", color: "#8b7bff", items: sinTipo });
    return out;
  }, [filtered]);

  const hayFiltros = !!(naturaleza || tipo || elemento || q.trim());
  const limpiar = () => {
    setQ("");
    setNaturaleza(null);
    setTipo(null);
    setElemento(null);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12">
      {/* Cabecera */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
            <Icon name="Sparkles" className="text-primary" size={22} />
          </span>
          <div>
            <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Magia</h1>
            <p className="text-sm text-fg-muted">El sistema arcano de Astralys: fundamentos, conceptos y hechizos.</p>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="mb-8 space-y-3 rounded-2xl border border-border-base bg-surface/40 p-4">
        <div className="relative max-w-sm">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar magia…"
            className="w-full rounded-xl border border-border-base bg-deep/60 py-2 pl-9 pr-3 text-sm text-fg outline-none focus:border-border-glow"
          />
        </div>

        <FilterRow label="Naturaleza">
          {NATURALEZAS.filter((n) => present.nat.has(n.key)).map((n) => (
            <Chip key={n.key} active={naturaleza === n.key} color={n.color} icon={n.icon} onClick={() => setNaturaleza(naturaleza === n.key ? null : n.key)}>
              {n.label}
            </Chip>
          ))}
        </FilterRow>

        {present.tip.size > 0 && (
          <FilterRow label="Tipo">
            {[...present.tip].map((t) => {
              const meta = TIPOS_MAGIA[t] ?? { label: t, icon: "Sparkles", color: "#8b7bff" };
              return (
                <Chip key={t} active={tipo === t} color={meta.color} icon={meta.icon} onClick={() => setTipo(tipo === t ? null : t)}>
                  {meta.label}
                </Chip>
              );
            })}
          </FilterRow>
        )}

        {present.ele.size > 0 && (
          <FilterRow label="Elemento">
            {Object.keys(ELEMENTOS).filter((e) => present.ele.has(e)).map((e) => (
              <Chip key={e} active={elemento === e} color={ELEMENTOS[e].color} icon={ELEMENTOS[e].icon} onClick={() => setElemento(elemento === e ? null : e)}>
                {ELEMENTOS[e].label}
              </Chip>
            ))}
          </FilterRow>
        )}

        {hayFiltros && (
          <button onClick={limpiar} className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
            <Icon name="X" size={12} /> Limpiar filtros · {filtered.length} resultados
          </button>
        )}
      </div>

      {/* Secciones */}
      {secciones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-base py-20 text-center text-fg-muted">
          No hay magia que coincida con los filtros.
        </div>
      ) : (
        <div className="space-y-10">
          {secciones.map((sec) => (
            <section key={sec.key}>
              <div className="mb-4 flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 place-items-center rounded-lg border"
                  style={{ borderColor: `${sec.color}66`, background: `${sec.color}18`, color: sec.color }}
                >
                  <Icon name={sec.icon} size={16} />
                </span>
                <h2 className="font-display text-xl text-fg">{sec.label}</h2>
                <span className="text-xs text-fg-muted">{sec.items.length}</span>
                <span className="ml-2 h-px flex-1" style={{ background: `linear-gradient(to right, ${sec.color}44, transparent)` }} />
              </div>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4"
              >
                {sec.items.map((it) => (
                  <motion.div
                    key={it.id}
                    variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
                  >
                    <MagiaCard item={it} />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MagiaCard({ item }: { item: MagiaIndexItem }) {
  const vis = magiaVisual(item);
  return (
    <Link
      href={`/magia/${item.id}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-surface/50 p-4 transition-all duration-300 hover:-translate-y-1"
      style={{ borderColor: `${vis.color}33` }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: vis.color }}
      />
      <span
        className="grid h-11 w-11 place-items-center rounded-xl border"
        style={{ borderColor: `${vis.color}55`, background: `${vis.color}1a`, color: vis.color }}
      >
        <Icon name={vis.icon} size={20} />
      </span>
      <div className="min-w-0">
        <h3 className="truncate font-display text-base text-fg">{item.nombre}</h3>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.naturaleza && item.naturaleza !== "Hechizo" && (
            <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] text-fg-muted">
              {NATURALEZA_LABEL[item.naturaleza] ?? item.naturaleza}
            </span>
          )}
          {item.subcategoria && (
            <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: `${vis.color}22`, color: vis.color }}>
              {item.subcategoria}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  color,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  icon: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
      style={
        active
          ? { borderColor: color, background: `${color}22`, color }
          : { borderColor: "var(--border-base)", color: "var(--fg-muted)" }
      }
    >
      <Icon name={icon} size={13} style={active ? undefined : { color }} />
      {children}
    </button>
  );
}
