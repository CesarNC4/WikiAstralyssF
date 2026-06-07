"use client";

import dynamic from "next/dynamic";
import type { MapaPublico } from "@/lib/queries/mapa";

// Leaflet accede a `window`, así que se carga solo en cliente (ssr: false).
const MapaMundi = dynamic(() => import("./MapaMundi").then((m) => m.MapaMundi), {
  ssr: false,
  loading: () => (
    <div className="grid h-[60vh] place-items-center rounded-3xl border border-border-glow bg-deep text-fg-muted">
      Cargando mapa…
    </div>
  ),
});

export function MapaMundiClient({ data }: { data: MapaPublico }) {
  return <MapaMundi data={data} />;
}
