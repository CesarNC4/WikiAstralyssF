/**
 * Color de cada tipo de entidad en los grafos (Atlas y mapa del taller).
 * Los tokens del diseño son clases; aquí hace falta el hex. Client-safe.
 */
export const COLOR_ENTIDAD: Record<string, string> = {
  personajes: "#8b7bff",
  naciones: "#7b5cff",
  razas: "#9b8cff",
  bestias: "#ef6f6f",
  minerales: "#6fc3d6",
  organizaciones: "#5b8def",
  familias: "#e0a44a",
  artefactos: "#d8a05f",
  locaciones: "#5fb98f",
  regiones: "#4f9d7e",
  misiones: "#e6b450",
  conceptos: "#c08bff",
  magia: "#a78bfa",
  lore: "#8ab4f8",
  demonios: "#e05252",
  timeline: "#9aa3b2",
  capitulos: "#8ab4f8",
  actos: "#b9a6ff",
  arcos: "#c08bff",
};

export const COLOR_ENTIDAD_POR_DEFECTO = "#9aa3b2";

/** Color de las aristas que no son personaje–personaje (el del Atlas). */
export const COLOR_ARISTA = "#6b7280";
