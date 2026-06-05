"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useDebounce } from "@/hooks/useDebounce";
import { buscarAction } from "@/lib/actions/search";
import type { SearchResult } from "@/lib/types";

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
  const debounced = useDebounce(query, 220);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    buscarAction(debounced)
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setActive(0);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  const go = (r: SearchResult) => {
    router.push(r.href);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      go(results[active]);
    }
  };

  return (
    <AnimatePresence>
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
              {results.map((r, i) => (
                <button
                  key={`${r.tipo}-${r.id}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    i === active ? "bg-elevated" : "hover:bg-surface"
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-base bg-surface text-[10px] uppercase text-fg-muted">
                    {r.tipoLabel.slice(0, 3)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{r.titulo}</span>
                    {r.subtitulo && (
                      <span className="block truncate text-xs text-fg-muted">{r.subtitulo}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] text-fg-muted">{r.tipoLabel}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
