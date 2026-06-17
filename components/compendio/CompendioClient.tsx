"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EntityImage } from "@/components/media/EntityImage";
import { Icon } from "@/components/Icon";
import { STATS_POR_ENTIDAD } from "@/lib/stats";
import type { CompendioData, CompendioRow } from "@/lib/queries/compendio";

type EntidadKey = "bestias" | "minerales" | "razas" | "naciones";

const TABS: { key: EntidadKey; label: string; icon: string; route: string }[] = [
  { key: "bestias", label: "Bestias", icon: "PawPrint", route: "/bestias" },
  { key: "minerales", label: "Minerales", icon: "Gem", route: "/minerales" },
  { key: "razas", label: "Razas", icon: "Rabbit", route: "/razas" },
  { key: "naciones", label: "Naciones", icon: "Globe2", route: "/naciones" },
];

const ATTR_COLS: Record<EntidadKey, { key: string; label: string }[]> = {
  bestias: [
    { key: "nivelAmenaza", label: "Amenaza" },
    { key: "categoria", label: "Categoría" },
    { key: "tamano", label: "Tamaño" },
  ],
  minerales: [
    { key: "rareza", label: "Rareza" },
    { key: "tipo", label: "Tipo" },
    { key: "elemento", label: "Elemento" },
  ],
  razas: [
    { key: "clasificacion", label: "Clase" },
    { key: "afinidad", label: "Afinidad" },
    { key: "dieta", label: "Dieta" },
  ],
  naciones: [
    { key: "gobierno", label: "Gobierno" },
    { key: "clima", label: "Clima" },
    { key: "elementoFundamental", label: "Elemento" },
  ],
};

interface SortState {
  col: string;
  dir: "asc" | "desc";
}

export function CompendioClient({ data }: { data: CompendioData }) {
  const [tab, setTab] = useState<EntidadKey>("bestias");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortState>({ col: "nombre", dir: "asc" });

  const statCols = useMemo(
    () => (STATS_POR_ENTIDAD[tab] ?? []).flatMap((g) => g.stats.map((st) => ({ ...st, color: g.color }))),
    [tab],
  );
  const attrCols = ATTR_COLS[tab];
  const accent = STATS_POR_ENTIDAD[tab]?.[0]?.color ?? "#7b5cff";

  const rows = useMemo(() => {
    const base = (data[tab] as CompendioRow[]).filter((r) => (q ? r.nombre.toLowerCase().includes(q.toLowerCase()) : true));
    const { col, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    const isStat = statCols.some((c) => c.key === col);
    return [...base].sort((a, b) => {
      if (col === "nombre") return a.nombre.localeCompare(b.nombre) * mul;
      if (isStat) {
        const av = a.stats[col];
        const bv = b.stats[col];
        if (av == null && bv == null) return 0;
        if (av == null) return 1; // nulls al final
        if (bv == null) return -1;
        return (av - bv) * mul;
      }
      const av = a.attrs[col] ?? "";
      const bv = b.attrs[col] ?? "";
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return av.localeCompare(bv) * mul;
    });
  }, [data, tab, q, sort, statCols]);

  const toggleSort = (col: string) =>
    setSort((prev) => (prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "nombre" ? "asc" : "desc" }));

  const sortHead = (col: string, label: string, alignRight?: boolean) => (
    <th key={col} className={"whitespace-nowrap px-3 py-2 " + (alignRight ? "text-right" : "text-left")}>
      <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-fg-muted hover:text-fg">
        {label}
        {sort.col === col && <span style={{ color: accent }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );

  return (
    <div>
      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setSort({ col: "nombre", dir: "asc" }); }}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors " +
              (tab === t.key ? "border-border-glow bg-surface text-fg" : "border-border-base text-fg-muted hover:text-fg")
            }
          >
            <Icon name={t.icon} size={14} /> {t.label}
            <span className="text-xs text-fg-muted">{(data[t.key] as CompendioRow[]).length}</span>
          </button>
        ))}
      </div>

      {/* Filtro */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por nombre…"
            className="w-full rounded-lg border border-border-base bg-surface py-2 pl-9 pr-3 text-sm text-fg outline-none focus:border-border-glow"
          />
        </div>
        <p className="text-xs text-fg-muted">{rows.length} resultado{rows.length === 1 ? "" : "s"}</p>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-border-base">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border-base bg-surface/60">
            <tr>
              {sortHead("nombre", "Nombre")}
              {attrCols.map((c) => sortHead(c.key, c.label))}
              {statCols.map((c) => sortHead(c.key, c.label, true))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={"border-b border-border-base/50 " + (i % 2 ? "bg-surface/20" : "")}>
                <td className="px-3 py-2">
                  <Link href={`/${tab}/${r.id}`} className="flex items-center gap-2 hover:text-primary-glow">
                    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
                      <EntityImage src={r.imagenUrl} alt={r.nombre} name={r.nombre} sizes="28px" />
                    </span>
                    <span className="truncate text-fg">{r.nombre}</span>
                  </Link>
                </td>
                {attrCols.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-fg-secondary">{r.attrs[c.key] ?? "—"}</td>
                ))}
                {statCols.map((c) => {
                  const v = r.stats[c.key];
                  return (
                    <td key={c.key} className="px-3 py-2">
                      {v == null ? (
                        <span className="block text-right text-fg-muted">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface sm:block">
                            <div className="h-full rounded-full" style={{ width: `${v}%`, background: c.color }} />
                          </div>
                          <span className="w-7 text-right font-mono text-xs text-fg">{v}</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={1 + attrCols.length + statCols.length} className="px-3 py-8 text-center text-sm text-fg-muted">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
