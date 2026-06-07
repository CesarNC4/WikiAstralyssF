/**
 * Utilidades compartidas del mapa (§10). Client-safe (sin imports de servidor).
 * Las coordenadas se guardan normalizadas 0..1 con (0,0) en la esquina superior
 * izquierda de la imagen. Leaflet (CRS.Simple) usa lat/lng con la lat creciendo
 * hacia arriba, por lo que se invierte el eje Y al convertir.
 */

export const MAPA_IMG = "/MapaAstralys.png";
export const MAPA_W = 1467;
export const MAPA_H = 1072;

/** Bounds de la imagen en CRS.Simple: [[sur,oeste],[norte,este]] = [[0,0],[H,W]]. */
export const MAPA_BOUNDS: [[number, number], [number, number]] = [
  [0, 0],
  [MAPA_H, MAPA_W],
];

/** Punto normalizado 0..1 (x derecha, y hacia abajo) → latlng de Leaflet. */
export function normToLatLng([nx, ny]: [number, number]): [number, number] {
  return [MAPA_H * (1 - ny), MAPA_W * nx];
}

/** latlng de Leaflet → punto normalizado 0..1 (x derecha, y hacia abajo). */
export function latLngToNorm(lat: number, lng: number): [number, number] {
  return [lng / MAPA_W, 1 - lat / MAPA_H];
}

export function poligonoToLatLngs(poligono: [number, number][] | null | undefined): [number, number][] {
  return (poligono ?? []).map(normToLatLng);
}

export type TipoLocacionKey = "ciudad" | "mazmorra" | "interes" | "batalla";

/** Metadatos de cada tipo de locación (icono lucide + color + etiqueta). */
export const TIPOS_LOCACION: Record<TipoLocacionKey, { label: string; icon: string; color: string }> = {
  ciudad: { label: "Ciudad / Capital", icon: "Building2", color: "#ffd66b" },
  mazmorra: { label: "Mazmorra / Ruina", icon: "Swords", color: "#f87171" },
  interes: { label: "Punto de interés", icon: "Star", color: "#2dd4bf" },
  batalla: { label: "Batalla / Evento", icon: "Flame", color: "#ff8c5a" },
};
