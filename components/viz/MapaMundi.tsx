"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, ImageOverlay, Polygon, CircleMarker, Tooltip } from "react-leaflet";
import { CRS } from "leaflet";
import {
  MAPA_IMG,
  MAPA_BOUNDS,
  normToLatLng,
  poligonoToLatLngs,
  TIPOS_LOCACION,
  type TipoLocacionKey,
} from "@/lib/mapa";
import type { MapaPublico } from "@/lib/queries/mapa";

const ACENTO_NACION = "#7b5cff";
const ACENTO_REGION = "#2dd4bf";

/** Mapa interactivo del mundo (§10): naciones/regiones poligonales + locaciones. */
export function MapaMundi({ data }: { data: MapaPublico }) {
  const router = useRouter();
  const [tipos, setTipos] = useState<Record<TipoLocacionKey, boolean>>({
    ciudad: true,
    mazmorra: true,
    interes: true,
    batalla: true,
  });

  return (
    <div className="overflow-hidden rounded-3xl border border-border-glow">
      <div className="flex flex-wrap gap-2 border-b border-border-base bg-deep px-3 py-2">
        {(Object.keys(TIPOS_LOCACION) as TipoLocacionKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setTipos((t) => ({ ...t, [k]: !t[k] }))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              tipos[k] ? "border-border-glow text-fg" : "border-border-base text-fg-muted opacity-50"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIPOS_LOCACION[k].color }} />
            {TIPOS_LOCACION[k].label}
          </button>
        ))}
      </div>

      <MapContainer
        crs={CRS.Simple}
        bounds={MAPA_BOUNDS}
        maxBounds={MAPA_BOUNDS}
        maxBoundsViscosity={1}
        minZoom={-2}
        maxZoom={2}
        attributionControl={false}
        style={{ height: "min(75vh, 720px)", width: "100%", background: "#0a0a14" }}
      >
        <ImageOverlay url={MAPA_IMG} bounds={MAPA_BOUNDS} />

        {/* Naciones — solo contorno; relleno suave al pasar el ratón */}
        {data.naciones
          .filter((n) => n.poligono && n.poligono.length >= 3)
          .map((n) => {
            const color = n.color ?? ACENTO_NACION;
            return (
              <Polygon
                key={`nac-${n.id}`}
                positions={poligonoToLatLngs(n.poligono)}
                pathOptions={{ color, weight: 2, fill: true, fillColor: color, fillOpacity: 0 }}
                eventHandlers={{
                  click: () => router.push(`/naciones/${n.id}`),
                  mouseover: (e) => e.target.setStyle({ fillOpacity: 0.16, weight: 3 }),
                  mouseout: (e) => e.target.setStyle({ fillOpacity: 0, weight: 2 }),
                }}
              >
                <Tooltip sticky>{n.nombre}</Tooltip>
              </Polygon>
            );
          })}

        {/* Regiones — contorno punteado; relleno suave al pasar el ratón */}
        {data.regiones
          .filter((r) => r.poligono && r.poligono.length >= 3)
          .map((r) => {
            const color = r.color ?? ACENTO_REGION;
            return (
              <Polygon
                key={`reg-${r.id}`}
                positions={poligonoToLatLngs(r.poligono)}
                pathOptions={{ color, weight: 1.5, dashArray: "4", fill: true, fillColor: color, fillOpacity: 0 }}
                eventHandlers={{
                  click: () => router.push(`/regiones/${r.id}`),
                  mouseover: (e) => e.target.setStyle({ fillOpacity: 0.14, weight: 2.5 }),
                  mouseout: (e) => e.target.setStyle({ fillOpacity: 0, weight: 1.5 }),
                }}
              >
                <Tooltip sticky>{r.nombre}</Tooltip>
              </Polygon>
            );
          })}

        {/* Locaciones */}
        {data.locaciones
          .filter((l) => l.x != null && l.y != null && tipos[l.tipo as TipoLocacionKey])
          .map((l) => {
            const meta = TIPOS_LOCACION[l.tipo as TipoLocacionKey];
            return (
              <CircleMarker
                key={`loc-${l.id}`}
                center={normToLatLng([l.x as number, l.y as number])}
                radius={6}
                pathOptions={{ color: "#0a0a14", weight: 1.5, fillColor: meta.color, fillOpacity: 1 }}
                eventHandlers={{ click: () => router.push(`/locaciones/${l.id}`) }}
              >
                <Tooltip>{l.nombre}</Tooltip>
              </CircleMarker>
            );
          })}
      </MapContainer>
    </div>
  );
}
