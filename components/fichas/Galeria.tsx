"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { cldOptimize } from "@/lib/utils";

export interface GaleriaImagen {
  id: number;
  url: string;
  alt: string | null;
  blurhash: string | null;
}

/** Galería de imágenes de una ficha con lightbox (§5.2). */
export function Galeria({ images, titulo = "Galería" }: { images: GaleriaImagen[]; titulo?: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);
  const mover = useCallback(
    (delta: number) => setAbierta((i) => (i === null ? null : (i + delta + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (abierta === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierta, cerrar, mover]);

  if (!images || images.length === 0) return null;
  const activa = abierta !== null ? images[abierta] : null;

  return (
    <section className="mt-4">
      <h2 className="mb-3 font-display text-xl text-accent">{titulo}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:gap-3">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setAbierta(i)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border-base bg-deep"
            aria-label={img.alt ?? `Imagen ${i + 1}`}
          >
            <Image
              src={cldOptimize(img.url) ?? img.url}
              alt={img.alt ?? ""}
              fill
              sizes="(max-width: 768px) 33vw, 200px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              placeholder={img.blurhash ? "blur" : "empty"}
              blurDataURL={img.blurhash ?? undefined}
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {activa && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={cerrar} />
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

              <button onClick={cerrar} className="absolute -top-3 -right-3 grid h-9 w-9 place-items-center rounded-full border border-border-glow bg-deep text-fg-muted hover:text-error" aria-label="Cerrar">
                <Icon name="X" size={18} />
              </button>
              {images.length > 1 && (
                <>
                  <button onClick={() => mover(-1)} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border-glow bg-deep/80 text-fg hover:bg-elevated" aria-label="Anterior">
                    <Icon name="ChevronLeft" size={20} />
                  </button>
                  <button onClick={() => mover(1)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border-glow bg-deep/80 text-fg hover:bg-elevated" aria-label="Siguiente">
                    <Icon name="ChevronRight" size={20} />
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
