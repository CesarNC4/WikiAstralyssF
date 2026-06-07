/**
 * Tipos compartidos (cliente + servidor) para las entidades complejas:
 * organizaciones, familias y gremio. Cada sub-fila lleva una `key` estable de
 * cliente para poder referenciarse entre tablas ANTES de tener id en la BD
 * (p. ej. la jerarquía apunta a un rango/facción aún sin guardar). Al guardar,
 * el servidor reescribe todo el bloque y resuelve key → id real.
 */

export type Estado = "borrador" | "publicado" | "oculto";

export interface RangoRow {
  key: string;
  id?: number;
  nombre: string;
  /** Calculado por posición al guardar; mayor = más arriba. */
  peso: number;
}

export interface FaccionRow {
  key: string;
  id?: number;
  nombre: string;
  color: string; // hex (#rrggbb) o ""
}

export interface JerarquiaRow {
  key: string;
  id?: number;
  personajeId: number | null;
  nombre: string; // libre, si el miembro no tiene ficha
  faccionKey: string | null; // → FaccionRow.key
  // org / gremio:
  rangoKey: string | null; // → RangoRow.key
  tituloApodo: string;
  // familia:
  tituloNobiliario: string;
  tituloFamilia: string;
}

export interface HistorialRow {
  key: string;
  id?: number;
  nombre: string;
  personajeId: number | null;
  estado: string;
  rol: string;
  periodo: string;
  destacado: boolean;
  motivoDestacado: string;
  notas: string;
}

export interface ArbolRow {
  key: string;
  id?: number;
  nombre: string;
  personajeId: number | null;
  generacion: number;
  padreKey: string | null; // → ArbolRow.key
  madreKey: string | null; // → ArbolRow.key
  estado: string;
  destacado: boolean;
  motivoDestacado: string;
  notas: string;
}

/** Payload de organización que viaja del form a la server action. */
export interface OrgPayload {
  campos: Record<string, string | null>;
  imagenUrl: string | null;
  bannerUrl: string | null;
  estadoPublicacion: Estado;
  rangos: RangoRow[];
  facciones: FaccionRow[];
  jerarquia: JerarquiaRow[];
  historial: HistorialRow[];
}

/** Payload de familia (sin rangos ni historial; con árbol). */
export interface FamiliaPayload {
  campos: Record<string, string | null>;
  imagenUrl: string | null;
  bannerUrl: string | null;
  estadoPublicacion: Estado;
  facciones: FaccionRow[];
  jerarquia: JerarquiaRow[];
  arbol: ArbolRow[];
}

/** Payload de gremio (singleton, sin estado de publicación ni papelera). */
export interface GremioPayload {
  campos: Record<string, string | null>;
  imagenUrl: string | null;
  bannerUrl: string | null;
  rangos: RangoRow[];
  facciones: FaccionRow[];
  jerarquia: JerarquiaRow[];
  historial: HistorialRow[];
}

let _k = 0;
/** Clave de cliente estable para filas nuevas. */
export function newKey(prefix = "k"): string {
  _k += 1;
  return `${prefix}_${Date.now().toString(36)}_${_k}`;
}

/** Reordena un array moviendo `from` a la posición `to` (inmutable). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}
