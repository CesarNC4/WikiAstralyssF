"use client";

import dynamic from "next/dynamic";
import type { MapaAdmin } from "@/lib/queries/adminMapa";

// Leaflet + geoman acceden a `window`: solo cliente.
const MapaEditor = dynamic(() => import("./MapaEditor").then((m) => m.MapaEditor), {
  ssr: false,
  loading: () => <div className="grid h-[60vh] place-items-center rounded-2xl border border-border-glow bg-deep text-fg-muted">Cargando editor…</div>,
});

export function MapaEditorClient({ data, tiposLocacion }: { data: MapaAdmin; tiposLocacion: string[] }) {
  return <MapaEditor data={data} tiposLocacion={tiposLocacion} />;
}
