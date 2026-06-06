"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  msg: string;
  tone: ToastTone;
}

const ToastCtx = createContext<(msg: string, tone?: ToastTone) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((msg: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[90vw] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur " +
              (t.tone === "success"
                ? "border-success/40 bg-surface/90 text-success"
                : t.tone === "error"
                  ? "border-error/40 bg-surface/90 text-error"
                  : "border-border-glow bg-surface/90 text-fg-secondary")
            }
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
