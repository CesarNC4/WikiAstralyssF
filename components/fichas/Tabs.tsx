"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Tabs con segmented control fijo + swipe-friendly en móvil (§5.2, §16). */
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-6 overflow-x-auto border-b border-border-base bg-void/80 px-4 backdrop-blur-xl">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-sm transition-colors",
                active === t.id ? "text-fg" : "text-fg-muted hover:text-fg-secondary",
              )}
            >
              {t.label}
              {active === t.id && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {tabs.map((t) => (
        <div key={t.id} className={active === t.id ? "block" : "hidden"}>
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {t.content}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
