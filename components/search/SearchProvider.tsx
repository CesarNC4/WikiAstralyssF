"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { useDebounce } from "@/hooks/useDebounce";
import { buscarAction } from "@/lib/actions/search";
import { ENTITIES, ENTITY_LIST, type EntityKey } from "@/lib/entities";
import type { SearchResult } from "@/lib/types";

/** Orden estable de los grupos de resultados según el catálogo de entidades. */
const TIPO_ORDER = new Map(ENTITY_LIST.map((e, i) => [e.key, i] as const));

/** Agrupa los resultados por tipo conservando el ranking y asigna un índice plano para la navegación con teclado. */
function agruparResultados(results: SearchResult[]) {
  const groups = new Map<EntityKey, { result: SearchResult; flatIndex: number }[]>();
  results.forEach((result, flatIndex) => {
    const arr = groups.get(result.tipo) ?? [];
    arr.push({ result, flatIndex });
    groups.set(result.tipo, arr);
  });
  return [...groups.entries()].sort(
    (a, b) => (TIPO_ORDER.get(a[0]) ?? 99) - (TIPO_ORDER.get(b[0]) ?? 99),
  );
}

interface SearchCtx {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<SearchCtx | null>(null);

export function useSearch() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSearch debe usarse dentro de SearchProvider");
  return c;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  // Atajo ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={{ open, close, isOpen }}>
      {children}
      <CommandPalette isOpen={isOpen} close={close} />
    </Ctx.Provider>
  );
}

function CommandPalette({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [tipo, setTipo] = useState<EntityKey | "todos">("todos");
  const debounced = useDebounce(query, 220);

  useEffect(() => {
    let cancelled = false;
    const term = debounced.trim();
    // Envuelto en async para que las actualizaciones de estado no sean síncronas
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    void (async () => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await buscarAction(term);
        if (!cancelled) {
          setResults(r);
          setActive(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Conteo por sección sobre el total, para que los chips no cambien de número
  // al filtrar.
  const conteos = useMemo(() => {
    const m = new Map<EntityKey, number>();
    for (const r of results) m.set(r.tipo, (m.get(r.tipo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => (TIPO_ORDER.get(a[0]) ?? 99) - (TIPO_ORDER.get(b[0]) ?? 99));
  }, [results]);

  // Si la sección elegida desaparece al reescribir la búsqueda, se vuelve a
  // "todos" por derivación: así nunca se queda un filtro fantasma ocultando
  // resultados, y sin gastar un render extra en corregirlo.
  const hayTipo = conteos.some(([t]) => t === tipo);
  const tipoActivo: EntityKey | "todos" = tipo !== "todos" && !hayTipo ? "todos" : tipo;

  const visibles = useMemo(
    () => (tipoActivo === "todos" ? results : results.filter((r) => r.tipo === tipoActivo)),
    [results, tipoActivo],
  );

  // `flatIndex` se calcula sobre lo VISIBLE: si se agrupara el total, las
  // flechas saltarían a posiciones que el filtro ha ocultado.
  const grouped = useMemo(() => agruparResultados(visibles), [visibles]);
  const activo = Math.min(active, Math.max(0, visibles.length - 1));

  const go = (r: SearchResult) => {
    router.push(r.href);
    close();
  };

  const goAll = () => {
    if (debounced.trim().length < 2) return;
    router.push(`/buscar?q=${encodeURIComponent(debounced.trim())}`);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, visibles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && visibles[activo]) {
      go(visibles[activo]);
    }
  };

  return (
    <AnimatePresence
      onExitComplete={() => {
        setQuery("");
        setResults([]);
        setTipo("todos");
      }}
    >
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={close} />
          <motion.div
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border-glow bg-deep shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
          >
            <div className="flex items-center gap-3 border-b border-border-base px-4">
              <Icon name="Search" size={18} className="text-fg-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Buscar en Astralys…"
                className="w-full bg-transparent py-4 text-fg outline-none placeholder:text-fg-muted"
              />
              <kbd className="hidden rounded border border-border-base px-1.5 py-0.5 text-[10px] text-fg-muted sm:block">
                ESC
              </kbd>
            </div>

            {results.length > 0 && conteos.length > 1 && (
              <div className="flex flex-wrap gap-1 border-b border-border-base px-3 py-2">
                <ChipBusqueda activo={tipoActivo === "todos"} onClick={() => { setTipo("todos"); setActive(0); }} label="Todo" n={results.length} />
                {conteos.map(([t, n]) => (
                  <ChipBusqueda
                    key={t}
                    activo={tipoActivo === t}
                    onClick={() => { setTipo(t); setActive(0); }}
                    label={ENTITIES[t]?.plural ?? t}
                    n={n}
                  />
                ))}
              </div>
            )}

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {loading && <p className="px-3 py-6 text-center text-sm text-fg-muted">Buscando…</p>}
              {!loading && debounced.trim().length >= 2 && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-fg-muted">Sin resultados para “{debounced}”.</p>
              )}
              {!loading && debounced.trim().length < 2 && (
                <p className="px-3 py-6 text-center text-sm text-fg-muted">
                  Escribe para buscar personajes, naciones, lore…
                </p>
              )}
              {grouped.map(([tipo, items]) => {
                const meta = ENTITIES[tipo];
                return (
                  <div key={tipo} className="mb-1">
                    <div className="flex items-center gap-2 px-3 pb-1 pt-2">
                      <Icon name={meta?.icon ?? "Circle"} size={13} className={meta?.accent ?? "text-fg-muted"} />
                      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
                        {meta?.plural ?? tipo}
                      </span>
                    </div>
                    {items.map(({ result: r, flatIndex }) => (
                      <button
                        key={`${r.tipo}-${r.id}`}
                        onClick={() => go(r)}
                        onMouseEnter={() => setActive(flatIndex)}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                          flatIndex === activo ? "bg-elevated" : "hover:bg-surface"
                        }`}
                      >
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border-base">
                          <EntityImage src={r.imagenUrl} alt={r.titulo} name={r.titulo} sizes="36px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">{r.titulo}</span>
                          {r.subtitulo && (
                            <span className="block truncate text-xs text-fg-muted">{r.subtitulo}</span>
                          )}
                        </span>
                        <Icon name="ArrowRight" size={14} className="shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {results.length > 0 && (
              <button
                onClick={goAll}
                className="flex w-full items-center justify-center gap-2 border-t border-border-base py-2.5 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
              >
                Ver todos los resultados de “{debounced.trim()}”
                <Icon name="ArrowRight" size={13} />
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Chip de sección de la paleta ⌘K. */
function ChipBusqueda({
  activo,
  onClick,
  label,
  n,
}: {
  activo: boolean;
  onClick: () => void;
  label: string;
  n: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        activo
          ? "border-border-glow bg-elevated text-fg"
          : "border-border-base text-fg-muted hover:text-fg"
      }`}
    >
      {label} <span className="opacity-60">{n}</span>
    </button>
  );
}
