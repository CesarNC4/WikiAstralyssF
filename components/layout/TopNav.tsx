"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useSearch } from "@/components/search/SearchProvider";
import { NAV_GROUPS, ENTITIES } from "@/lib/entities";

export function TopNav() {
  const { open } = useSearch();
  const [drawer, setDrawer] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-border-base bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Icon name="Star" className="text-accent" size={20} />
          <span className="font-display text-xl tracking-wide text-gradient-cosmic">Astralys</span>
        </Link>

        {/* Nav desktop */}
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_GROUPS.map((g) => (
            <div
              key={g.id}
              className="relative"
              onMouseEnter={() => setOpenGroup(g.id)}
              onMouseLeave={() => setOpenGroup(null)}
            >
              <button className="rounded-lg px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:text-fg">
                {g.label}
              </button>
              <AnimatePresence>
                {openGroup === g.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute left-0 top-full w-52 rounded-xl border border-border-glow bg-deep p-1.5 shadow-xl"
                  >
                    {g.keys.map((k) => {
                      const e = ENTITIES[k];
                      return (
                        <Link
                          key={k}
                          href={e.route}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-surface hover:text-fg"
                        >
                          <Icon name={e.icon} size={16} className={e.accent} />
                          {e.plural}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* ⌘K */}
          <button
            onClick={open}
            className="flex items-center gap-2 rounded-lg border border-border-base bg-surface/60 px-3 py-1.5 text-sm text-fg-muted transition-colors hover:border-border-glow hover:text-fg"
          >
            <Icon name="Search" size={15} />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded border border-border-base px-1 text-[10px] sm:inline">⌘K</kbd>
          </button>

          {/* Hamburguesa móvil */}
          <button
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border-base bg-surface/60 md:hidden"
            aria-label="Menú"
          >
            <Icon name="Menu" size={18} />
          </button>
        </div>
      </div>

      {/* Drawer móvil */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="absolute right-0 top-0 h-full w-72 overflow-y-auto border-l border-border-glow bg-deep p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-lg text-gradient-cosmic">Astralys</span>
                <button onClick={() => setDrawer(false)} aria-label="Cerrar">
                  <Icon name="X" size={20} className="text-fg-muted" />
                </button>
              </div>
              {NAV_GROUPS.map((g) => (
                <div key={g.id} className="mb-4">
                  <p className="mb-1 px-2 text-xs uppercase tracking-wider text-fg-muted">{g.label}</p>
                  {g.keys.map((k) => {
                    const e = ENTITIES[k];
                    return (
                      <Link
                        key={k}
                        href={e.route}
                        onClick={() => setDrawer(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-fg-secondary hover:bg-surface hover:text-fg"
                      >
                        <Icon name={e.icon} size={16} className={e.accent} />
                        {e.plural}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
