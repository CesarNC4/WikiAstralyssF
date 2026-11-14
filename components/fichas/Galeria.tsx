"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Visor } from "@/components/media/Visor";
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

  if (!images || images.length === 0) return null;

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

      <Visor imagenes={images} indice={abierta} onCerrar={cerrar} onMover={mover} />
    </section>
  );
}
