"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { cldOptimize } from "@/lib/utils";

const sinSuscripcion = () => () => {};

export interface ImagenVisor {
  id: number;
  url: string;
  alt: string | null;
}

/**
 * Una imagen a pantalla completa, sobre la página: la galería y la imagen de perfil de las
 * fichas. Se cierra con Esc, con la X o pulsando fuera; con varias, las flechas pasan de una a
 * otra. Va en un portal al final del `body`: dentro de la ficha, un antepasado con animación
 * (transform) lo encerraría en su caja en vez de en la pantalla.
 */
export function Visor({
  imagenes,
  indice,
  onCerrar,
  onMover,
}: {
  imagenes: ImagenVisor[];
  /** La que se ve; null, cerrado. */
  indice: number | null;
  onCerrar: () => void;
  onMover?: (delta: number) => void;
}) {
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const activa = indice !== null ? imagenes[indice] : null;
  const varias = imagenes.length > 1 && !!onMover;

  useEffect(() => {
    if (!activa) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (varias && e.key === "ArrowRight") onMover?.(1);
      if (varias && e.key === "ArrowLeft") onMover?.(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activa, varias, onCerrar, onMover]);

  // En el servidor y al hidratar no hay portal (no hay `body` al que llevarlo); después, sí.
  if (!montado) return null;

  return createPortal(
    <AnimatePresence>
      {activa && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activa.alt ?? "Imagen ampliada"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={onCerrar} />
          <motion.div
            key={activa.id}
            className="relative max-h-[88vh] w-full max-w-3xl"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
          >
            <div className="relative mx-auto flex max-h-[88vh] items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cldOptimize(activa.url) ?? activa.url}
                alt={activa.alt ?? ""}
                className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl"
              />
            </div>
            {activa.alt && <p className="mt-2 text-center text-sm text-fg-secondary">{activa.alt}</p>}

            <button onClick={onCerrar} className="absolute -top-3 -right-3 grid h-9 w-9 place-items-center rounded-full border border-border-glow bg-deep text-fg-muted hover:text-error" aria-label="Cerrar">
              <Icon name="X" size={18} />
            </button>
            {varias && (
              <>
                <button onClick={() => onMover?.(-1)} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border-glow bg-deep/80 text-fg hover:bg-elevated" aria-label="Anterior">
                  <Icon name="ChevronLeft" size={20} />
                </button>
                <button onClick={() => onMover?.(1)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border-glow bg-deep/80 text-fg hover:bg-elevated" aria-label="Siguiente">
                  <Icon name="ChevronRight" size={20} />
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
