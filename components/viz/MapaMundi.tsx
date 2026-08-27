"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, ImageOverlay, Polygon, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import { CRS } from "leaflet";
import {
  MAPA_IMG,
  MAPA_BOUNDS,
  normToLatLng,
  poligonoToLatLngs,
  estiloLocacion,
  zoomMinimoDeEscala,
  CAPAS,
  type CapaKey,
} from "@/lib/mapa";
import type { MapaPublico } from "@/lib/queries/mapa";

const ACENTO_NACION = "#7b5cff";
const ACENTO_REGION = "#2dd4bf";

/**
 * Mapa interactivo del mundo (§10).
 *
 * Se mira por niveles: un botón por capa, y solo el nivel elegido responde al
 * ratón. Antes se pintaban naciones, regiones y locaciones a la vez y los
 * polígonos se pisaban entre sí, así que señalar una región dentro de una
 * nación era cuestión de suerte. Los niveles que no están activos siguen
 * viéndose, atenuados, para no perder la referencia de dónde está uno.
 */
export function MapaMundi({ data }: { data: MapaPublico }) {
  const router = useRouter();
  const [capa, setCapa] = useState<CapaKey>("naciones");
  const [zoom, setZoom] = useState(-1);

  const activa = (k: Exclude<CapaKey, "base">) => capa === k;
  const deFondo = (k: Exclude<CapaKey, "base">) => capa !== "base" && capa !== k;
  const visible = capa !== "base";

  return (
    <div className="overflow-hidden rounded-3xl border border-border-glow">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-base bg-deep px-3 py-2">
        {CAPAS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCapa(c.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              capa === c.key
                ? "border-border-glow bg-surface text-fg"
                : "border-border-base text-fg-muted hover:text-fg-secondary"
            }`}
          >
            {c.label}
          </button>
        ))}
        {activa("locaciones") && (
          <span className="ml-auto text-[11px] text-fg-muted">
            Acerca el mapa para ver los asentamientos pequeños
          </span>
        )}
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
        <SeguirZoom onZoom={setZoom} />

        {/* Naciones */}
        {visible &&
          data.naciones
            .filter((n) => n.poligono && n.poligono.length >= 3)
            .map((n) => {
              const color = n.color ?? ACENTO_NACION;
              const enFoco = activa("naciones");
              return (
                <Polygon
                  key={`nac-${n.id}`}
                  positions={poligonoToLatLngs(n.poligono)}
                  pathOptions={{
                    color,
                    weight: enFoco ? 2 : 1,
                    opacity: deFondo("naciones") ? 0.3 : 1,
                    fill: true,
                    fillColor: color,
                    fillOpacity: 0,
                    interactive: enFoco,
                  }}
                  eventHandlers={
                    enFoco
                      ? {
                          click: () => router.push(`/naciones/${n.id}`),
                          mouseover: (e) => e.target.setStyle({ fillOpacity: 0.16, weight: 3 }),
                          mouseout: (e) => e.target.setStyle({ fillOpacity: 0, weight: 2 }),
                        }
                      : undefined
                  }
                >
                  {enFoco && <Tooltip sticky>{n.nombre}</Tooltip>}
                </Polygon>
              );
            })}

        {/* Regiones */}
        {visible &&
          data.regiones
            .filter((r) => r.poligono && r.poligono.length >= 3)
            .map((r) => {
              const color = r.color ?? ACENTO_REGION;
              const enFoco = activa("regiones");
              return (
                <Polygon
                  key={`reg-${r.id}`}
                  positions={poligonoToLatLngs(r.poligono)}
                  pathOptions={{
                    color,
                    weight: enFoco ? 1.5 : 1,
                    opacity: deFondo("regiones") ? 0.3 : 1,
                    dashArray: "4",
                    fill: true,
                    fillColor: color,
                    fillOpacity: 0,
                    interactive: enFoco,
                  }}
                  eventHandlers={
                    enFoco
                      ? {
                          click: () => router.push(`/regiones/${r.id}`),
                          mouseover: (e) => e.target.setStyle({ fillOpacity: 0.14, weight: 2.5 }),
                          mouseout: (e) => e.target.setStyle({ fillOpacity: 0, weight: 1.5 }),
                        }
                      : undefined
                  }
                >
                  {enFoco && <Tooltip sticky>{r.nombre}</Tooltip>}
                </Polygon>
              );
            })}

        {/* Locaciones. Con el mapa alejado solo salen las grandes: si se
            pintaran las cien a la vez, el mapa dejaría de leerse. */}
        {visible &&
          data.locaciones
            .filter((l) => l.x != null && l.y != null)
            .filter((l) => !activa("locaciones") || zoom >= zoomMinimoDeEscala(l.escala))
            .map((l) => {
              const meta = estiloLocacion(l.tipo);
              const enFoco = activa("locaciones");
              return (
                <CircleMarker
                  key={`loc-${l.id}`}
                  center={normToLatLng([l.x as number, l.y as number])}
                  radius={enFoco ? 6 : 3.5}
                  pathOptions={{
                    color: "#0a0a14",
                    weight: 1.5,
                    fillColor: meta.color,
                    fillOpacity: deFondo("locaciones") ? 0.35 : 1,
                    interactive: enFoco,
                  }}
                  eventHandlers={enFoco ? { click: () => router.push(`/locaciones/${l.id}`) } : undefined}
                >
                  {enFoco && (
                    <Tooltip>
                      {l.nombre}
                      {l.escala ? ` · ${l.escala}` : ""}
                    </Tooltip>
                  )}
                </CircleMarker>
              );
            })}
      </MapContainer>
    </div>
  );
}

/** Mantiene el zoom en estado para decidir qué pines caben en pantalla. */
function SeguirZoom({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  return null;
}
