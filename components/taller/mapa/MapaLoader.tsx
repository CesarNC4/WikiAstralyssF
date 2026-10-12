"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { MapaRelaciones as Mapa } from "./MapaRelaciones";

// El grafo usa canvas y `window` al cargarse: solo en el navegador.
const MapaRelaciones = dynamic(() => import("./MapaRelaciones").then((m) => m.MapaRelaciones), {
  ssr: false,
  loading: () => <div className="grid h-[60vh] place-items-center text-sm text-fg-muted">Tejiendo el mapa…</div>,
});

export function MapaLoader(props: ComponentProps<typeof Mapa>) {
  return <MapaRelaciones {...props} />;
}
