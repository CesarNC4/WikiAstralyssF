/**
 * geoman (@geoman-io/leaflet-geoman-free) espera la global `L` de Leaflet antes
 * de evaluarse. Con bundlers (Turbopack) no existe, así que la exponemos en
 * window ANTES de importar geoman. Este módulo debe importarse justo antes del
 * side-effect de geoman.
 */
import L from "leaflet";

if (typeof window !== "undefined") {
  (window as unknown as { L?: typeof L }).L = L;
}

export default L;
