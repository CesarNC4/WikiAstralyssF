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

// ── Capas ───────────────────────────────────────────────────────────────────
/**
 * El mapa se mira por niveles, no todo a la vez.
 *
 * Antes se pintaban naciones, regiones y locaciones encima unas de otras, y al
 * intentar señalar una región dentro de una nación los dos polígonos competían
 * por el mismo clic. Con capas, en cada momento solo un nivel es interactivo y
 * el resto queda de fondo, atenuado y sin capturar el ratón.
 */
export const CAPAS = [
  { key: "base", label: "Mapa", icon: "Image" },
  { key: "naciones", label: "Naciones", icon: "Globe2" },
  { key: "regiones", label: "Regiones", icon: "MapPinned" },
  { key: "locaciones", label: "Locaciones", icon: "MapPin" },
] as const;

export type CapaKey = (typeof CAPAS)[number]["key"];

// ── Locaciones ──────────────────────────────────────────────────────────────
/**
 * Color e icono por tipo de locación. El tipo dejó de ser un enum de cuatro
 * valores y ahora sale del catálogo, así que esto es solo estilo: un tipo que no
 * esté aquí se pinta con el color neutro en vez de desaparecer del mapa.
 */
export const ESTILO_LOCACION: Record<string, { icon: string; color: string }> = {
  Ciudad: { icon: "Building2", color: "#ffd66b" },
  Capital: { icon: "Crown", color: "#ffc02e" },
  "Pueblo / Aldea": { icon: "Home", color: "#e8c98a" },
  Puerto: { icon: "Anchor", color: "#5fb0d6" },
  Fortaleza: { icon: "Castle", color: "#b0b6c4" },
  "Templo / Santuario": { icon: "Church", color: "#f3e4a8" },
  Academia: { icon: "GraduationCap", color: "#a78bfa" },
  Mazmorra: { icon: "Swords", color: "#f87171" },
  Ruina: { icon: "Landmark", color: "#c08b6a" },
  "Punto de interés": { icon: "Star", color: "#2dd4bf" },
  "Campo de batalla": { icon: "Flame", color: "#ff8c5a" },
  Refugio: { icon: "Tent", color: "#8fbf7f" },
  Otro: { icon: "Circle", color: "#9aa3b2" },
};

export const COLOR_LOCACION_NEUTRO = "#9aa3b2";

export function estiloLocacion(tipo: string | null | undefined) {
  return (tipo && ESTILO_LOCACION[tipo]) || { icon: "Circle", color: COLOR_LOCACION_NEUTRO };
}

/**
 * Escala de asentamiento, de menor a mayor. El índice decide a qué nivel de
 * zoom aparece el pin: con el mapa alejado solo se ven las grandes, y al acercar
 * van saliendo las pequeñas. Una locación sin escala se ve siempre.
 */
export const ESCALAS = ["Aldea", "Pueblo", "Villa", "Ciudad", "Gran ciudad", "Metrópolis", "Capital"] as const;

/**
 * Zoom mínimo a partir del cual se ve cada escala.
 *
 * El mapa va de -2 (todo el mundo) a 2 (detalle). Las capitales se ven siempre;
 * las aldeas solo cuando ya estás mirando de cerca.
 */
export function zoomMinimoDeEscala(escala: string | null | undefined): number {
  if (!escala) return -Infinity;
  const i = ESCALAS.indexOf(escala as (typeof ESCALAS)[number]);
  if (i < 0) return -Infinity;
  // De -2 (Capital, siempre visible) a 1 (Aldea, solo de cerca).
  return -2 + (ESCALAS.length - 1 - i) * 0.5;
}

// ── Geometría: quién está dentro de quién ───────────────────────────────────
/**
 * ¿Está el punto dentro del polígono? Ray casting clásico.
 *
 * Los polígonos ya se guardan como pares 0..1 en `jsonb`, así que esto se
 * resuelve en JavaScript y no hace falta PostGIS ni una extensión en la base.
 */
export function puntoEnPoligono(
  [px, py]: [number, number],
  poligono: [number, number][] | null | undefined,
): boolean {
  if (!poligono || poligono.length < 3) return false;
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    const cruza = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Centro aproximado de un polígono (media de vértices). Basta para contener. */
export function centroDe(poligono: [number, number][] | null | undefined): [number, number] | null {
  if (!poligono || poligono.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const [px, py] of poligono) {
    x += px;
    y += py;
  }
  return [x / poligono.length, y / poligono.length];
}

/**
 * Qué parte de un polígono cae dentro de otro, de 0 a 1.
 *
 * Se mide por vértices y no por área real: es suficiente para decidir si una
 * región pertenece a una nación, y evita meter una librería de geometría entera
 * para un caso que se resuelve contando puntos.
 */
export function fraccionDentro(
  interior: [number, number][] | null | undefined,
  exterior: [number, number][] | null | undefined,
): number {
  if (!interior || interior.length === 0 || !exterior || exterior.length < 3) return 0;
  let dentro = 0;
  for (const v of interior) if (puntoEnPoligono(v, exterior)) dentro++;
  return dentro / interior.length;
}

export interface Contenedor {
  id: number;
  nombre: string;
  poligono: [number, number][] | null;
}

export interface ResultadoContencion {
  /** El contenedor elegido, o null si no cae dentro de ninguno. */
  contenedorId: number | null;
  /** Nombres de los contenedores que también lo tocan, para poder avisarte. */
  solapa: string[];
}

/**
 * Decide en qué contenedor cae un punto (una locación).
 *
 * Si cae en varios —polígonos que se pisan— se queda con el primero pero
 * devuelve todos: el panel lo marca como conflicto en vez de elegir a ciegas.
 */
export function contenedorDePunto(
  punto: [number, number],
  contenedores: Contenedor[],
): ResultadoContencion {
  const dentro = contenedores.filter((c) => puntoEnPoligono(punto, c.poligono));
  return {
    contenedorId: dentro[0]?.id ?? null,
    solapa: dentro.length > 1 ? dentro.map((c) => c.nombre) : [],
  };
}

/**
 * Decide en qué contenedor cae un polígono (una región dentro de una nación).
 *
 * Gana el que más parte contenga, y solo si supera el umbral: una región que
 * apenas roza una frontera no debería quedar asignada a la nación vecina.
 */
export function contenedorDePoligono(
  poligono: [number, number][] | null | undefined,
  contenedores: Contenedor[],
  umbral = 0.6,
): ResultadoContencion {
  const puntuados = contenedores
    .map((c) => ({ c, frac: fraccionDentro(poligono, c.poligono) }))
    .filter((x) => x.frac > 0)
    .sort((a, b) => b.frac - a.frac);

  const mejor = puntuados[0];
  if (!mejor || mejor.frac < umbral) {
    // Cae a caballo entre varias o fuera de todas: no se adivina.
    return { contenedorId: null, solapa: puntuados.map((x) => x.c.nombre) };
  }
  return {
    contenedorId: mejor.c.id,
    // Si otra la toca de forma apreciable, merece un aviso aunque haya ganador.
    solapa: puntuados.length > 1 && puntuados[1].frac > 0.15 ? puntuados.map((x) => x.c.nombre) : [],
  };
}
