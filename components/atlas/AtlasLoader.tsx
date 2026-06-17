"use client";

import dynamic from "next/dynamic";
import type { AtlasNodo, AtlasArista } from "@/lib/queries/atlas";

// El grafo es una herramienta interactiva pesada: se renderiza solo en cliente
// (sin SSR/prerender) para no ejecutar la simulación durante el build.
const AtlasClient = dynamic(() => import("@/components/atlas/AtlasClient").then((m) => m.AtlasClient), {
  ssr: false,
  loading: () => <div className="grid h-[70vh] place-items-center rounded-2xl border border-border-base bg-deep text-fg-muted">Tejiendo el atlas…</div>,
});

export function AtlasLoader({ nodos, aristas }: { nodos: AtlasNodo[]; aristas: AtlasArista[] }) {
  return <AtlasClient nodos={nodos} aristas={aristas} />;
}
