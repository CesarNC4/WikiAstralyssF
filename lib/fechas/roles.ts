/**
 * Qué fechas tiene cada ficha (spec del taller §13, "Qué fichas tienen fecha").
 * Client-safe: lo leen los editores, las fichas públicas y la cronología.
 *
 * Es la única lista de roles. Añadir una fecha a una entidad es añadir una línea
 * aquí: `fecha_lore` es polimórfica y no necesita migración.
 */

/**
 * Cómo agrupa la cronología los sucesos para filtrarlos (§14). Los capítulos no
 * tienen fecha propia: la calculan de sus actos, pero caen en el mismo grupo.
 */
export type TipoSuceso = "evento" | "vida" | "fundacion" | "narrativa" | "otro";

export const TIPOS_SUCESO: { id: TipoSuceso; etiqueta: string; color: string; icono: string }[] = [
  { id: "evento", etiqueta: "Eventos", color: "#8b7bff", icono: "Sparkles" },
  { id: "vida", etiqueta: "Nacimientos y muertes", color: "#f0a3c4", icono: "Users" },
  { id: "fundacion", etiqueta: "Fundaciones y caídas", color: "#5b8def", icono: "Landmark" },
  { id: "narrativa", etiqueta: "Capítulos y actos", color: "#e0b34a", icono: "BookOpen" },
  { id: "otro", etiqueta: "Otros sucesos", color: "#2dd4bf", icono: "Circle" },
];

export interface RolFecha {
  rol: string;
  /** Rótulo en el editor y en la ficha: "Nacimiento", "Disolución o caída". */
  etiqueta: string;
  /** Título del suceso en la cronología; `{n}` es el nombre de la ficha. */
  suceso: string;
  tipo: TipoSuceso;
}

const r = (rol: string, etiqueta: string, suceso: string, tipo: TipoSuceso): RolFecha => ({ rol, etiqueta, suceso, tipo });

const fundada = (tipo: string): RolFecha[] => [
  r("fundacion", "Fundación", `Fundación de ${tipo}{n}`, "fundacion"),
  r("caida", "Disolución o caída", `Caída de ${tipo}{n}`, "fundacion"),
];

export const ROLES_FECHA: Record<string, RolFecha[]> = {
  timeline: [r("principal", "Fecha", "{n}", "evento")],
  actos: [r("principal", "Fecha", "{n}", "narrativa")],
  misiones: [r("principal", "Fecha", "Misión: {n}", "otro")],
  lore: [r("principal", "Fecha", "{n}", "otro")],
  demonios: [r("aparicion", "Aparición", "Aparición de {n}", "otro")],
  personajes: [r("nacimiento", "Nacimiento", "Nacimiento de {n}", "vida"), r("muerte", "Muerte", "Muerte de {n}", "vida")],
  naciones: fundada(""),
  organizaciones: fundada(""),
  familias: fundada("la familia "),
  gremio: fundada(""),
  regiones: [
    r("fundacion", "Fundación o descubrimiento", "Descubrimiento de {n}", "fundacion"),
    r("destruccion", "Destrucción", "Destrucción de {n}", "fundacion"),
  ],
  locaciones: [
    r("fundacion", "Fundación o descubrimiento", "Fundación de {n}", "fundacion"),
    r("destruccion", "Destrucción", "Destrucción de {n}", "fundacion"),
  ],
  artefactos: [r("creacion", "Creación", "Creación de {n}", "otro"), r("destruccion", "Destrucción o pérdida", "Pérdida de {n}", "otro")],
  razas: [r("origen", "Origen o aparición", "Origen de {n}", "otro"), r("extincion", "Extinción", "Extinción de {n}", "otro")],
  bestias: [r("origen", "Origen o aparición", "Aparición de {n}", "otro"), r("extincion", "Extinción", "Extinción de {n}", "otro")],
};

/** Roles de fecha de una entidad; vacío si no tiene ninguno. */
export function rolesDe(entidad: string): RolFecha[] {
  return ROLES_FECHA[entidad] ?? [];
}

export function rolDe(entidad: string, rol: string): RolFecha | undefined {
  return rolesDe(entidad).find((x) => x.rol === rol);
}

/** "Nacimiento de Kael". */
export function tituloSuceso(def: RolFecha, nombre: string): string {
  return def.suceso.replace("{n}", nombre);
}
