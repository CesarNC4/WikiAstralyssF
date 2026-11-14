"use client";

import { useCallback, useState } from "react";
import { Visor } from "@/components/media/Visor";
import { cn } from "@/lib/utils";

/**
 * La imagen de perfil de una ficha: con un clic se abre grande en el visor. Sin imagen (o con
 * ella oculta al público, que llega como null) es una caja normal con las iniciales.
 * `children` es la imagen tal cual se pinta en la cabecera; `className`, la de su caja.
 */
export function ImagenAmpliable({
  src,
  alt,
  className,
  children,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const cerrar = useCallback(() => setAbierta(false), []);

  if (!src) return <div className={className}>{children}</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className={cn("block cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-glow", className)}
        aria-label={`Ampliar la imagen de ${alt}`}
        title="Ampliar"
      >
        {children}
      </button>
      <Visor imagenes={[{ id: 0, url: src, alt }]} indice={abierta ? 0 : null} onCerrar={cerrar} />
    </>
  );
}
