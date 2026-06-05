"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Error boundary raíz / 500 temático (§17). */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En producción aquí se reportaría a Sentry: captureException(error)
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl text-error md:text-8xl">500</p>
      <h1 className="mt-4 font-display text-2xl text-fg">Una distorsión sacudió el cosmos</h1>
      <p className="mt-2 max-w-md text-fg-secondary">
        Algo se quebró en el tejido de Astralys. Puedes intentar reconstruir la
        constelación o regresar al inicio.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-6 py-3 font-medium text-void transition-transform hover:scale-105"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-xl border border-border-glow bg-surface/60 px-6 py-3 font-medium text-fg hover:border-primary"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
