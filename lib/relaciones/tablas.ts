import "server-only";
import type { PgTable } from "drizzle-orm/pg-core";
import * as s from "@/db/schema";

/**
 * La mitad de base de datos del registro de relaciones. Aquí y sólo aquí se
 * dice qué tabla y qué columnas hay detrás de cada relación declarada en
 * `registro.ts`. Es server-only para que el registro siga siendo importable
 * desde componentes de cliente.
 */

/** Cómo leer una ficha de cada entidad: nombre, imagen y visibilidad. */
export interface EntidadInfo {
  tabla: PgTable;
  /** Columna que da el nombre visible. */
  label: string;
  /** Columna secundaria que ayuda a distinguir homónimos en el selector. */
  detalle?: string;
  imagen?: string;
  /** Falta en las tablas que no se publican por separado (capítulos, gremio). */
  estado?: boolean;
  /** Falta en las tablas sin papelera. */
  papelera?: boolean;
  /** Ruta pública de la ficha, para enlazar desde los bloques. */
  ruta?: string;
}

export const ENTIDAD_INFO: Record<string, EntidadInfo> = {
  personajes: { tabla: s.personajes, label: "nombre", detalle: "titulo", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/personajes" },
  naciones: { tabla: s.naciones, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/naciones" },
  organizaciones: { tabla: s.organizaciones, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/organizaciones" },
  familias: { tabla: s.familias, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/familias" },
  razas: { tabla: s.razas, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/razas" },
  bestias: { tabla: s.bestias, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/bestias" },
  minerales: { tabla: s.minerales, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/minerales" },
  artefactos: { tabla: s.armasArtefactos, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/artefactos" },
  locaciones: { tabla: s.locaciones, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/locaciones" },
  regiones: { tabla: s.regiones, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/regiones" },
  misiones: { tabla: s.misiones, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/misiones" },
  lore: { tabla: s.paginasLore, label: "titulo", detalle: "slug", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/lore" },
  timeline: { tabla: s.timelineEventos, label: "titulo", estado: true, papelera: true, ruta: "/timeline" },
  demonios: { tabla: s.lordDemonio, label: "nombre", detalle: "titulo", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/demonios" },
  conceptos: { tabla: s.conceptos, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/conceptos" },
  magia: { tabla: s.magiaFundamentos, label: "nombre", imagen: "imagenUrl", estado: true, papelera: true, ruta: "/magia" },
  capitulos: { tabla: s.capitulos, label: "titulo", detalle: "numero", estado: true },
  canciones: { tabla: s.canciones, label: "titulo", detalle: "artista", imagen: "imagenUrl", estado: true },
  gremio: { tabla: s.gremio, label: "nombre", imagen: "imagenUrl", ruta: "/gremio" },
  elementos: { tabla: s.elementos, label: "nombre", detalle: "slug" },
  // Sin `ruta`: la economía tiene página propia pero no ficha por moneda.
  economia: { tabla: s.sistemaMonetario, label: "nombre", detalle: "denominacion" },
};

export function infoDe(entidad: string): EntidadInfo | undefined {
  return ENTIDAD_INFO[entidad];
}

/** Tabla y columnas de una relación guardada en tabla propia. */
export interface TablaRel {
  tabla: PgTable;
  /** Columna que apunta al lado A del registro. */
  colA: string;
  /** Columna que apunta al lado B. */
  colB: string;
  /** Clave primaria. `relaciones` usa `idRr` en lugar de `id`. */
  pk: string;
  /** Columna de posición, si la relación es ordenable. */
  orden?: string;
  /**
   * Filtro fijo sobre el lado A. Lo usa la tabla polimórfica de elementos, que
   * comparte filas entre entidades y se distingue por `entidadTipo`.
   */
  filtroA?: { col: string; valor: string };
  /**
   * La fila puede existir sin apuntar a ninguna ficha, guardando un nombre
   * suelto (miembros de una jerarquía sin ficha propia). El espejo las ignora.
   */
  colLibre?: string;
}

const jer = (tabla: PgTable, colA: string): TablaRel => ({
  tabla, colA, colB: "personajeId", pk: "id", orden: "orden", colLibre: "nombre",
});

export const TABLAS_REL: Record<string, TablaRel> = {
  personaje_nacion: { tabla: s.personajeNacion, colA: "personajeId", colB: "nacionId", pk: "id" },
  personaje_raza: { tabla: s.personajeRaza, colA: "personajeId", colB: "razaId", pk: "id" },
  org_jerarquia: jer(s.orgJerarquia, "organizacionId"),
  familia_jerarquia: jer(s.familiaJerarquia, "familiaId"),
  gremio_jerarquia: jer(s.gremioJerarquia, "gremioId"),
  personaje_objeto: { tabla: s.personajeObjeto, colA: "personajeId", colB: "armaArtefactoId", pk: "id", orden: "orden" },
  personaje_evento: { tabla: s.personajeEvento, colA: "personajeId", colB: "timelineEventoId", pk: "id", orden: "orden" },
  relaciones: { tabla: s.relaciones, colA: "personajeId", colB: "personajeRelacionadoId", pk: "idRr", colLibre: "nombreExterno" },
  nacion_organizacion: { tabla: s.nacionOrganizacion, colA: "nacionId", colB: "organizacionId", pk: "id" },
  nacion_raza: { tabla: s.nacionRaza, colA: "nacionId", colB: "razaId", pk: "id" },
  nacion_diplomacia: { tabla: s.nacionDiplomacia, colA: "nacionId", colB: "otraNacionId", pk: "id" },
  bestia_nacion: { tabla: s.bestiaNacion, colA: "bestiaId", colB: "nacionId", pk: "id" },
  bestia_region: { tabla: s.bestiaRegion, colA: "bestiaId", colB: "regionId", pk: "id" },
  bestia_drop: { tabla: s.bestiaDrop, colA: "bestiaId", colB: "mineralId", pk: "id", orden: "orden" },
  bestia_relacion: { tabla: s.bestiaRelacion, colA: "bestiaId", colB: "relacionadaId", pk: "id" },
  mineral_artefacto: { tabla: s.mineralArtefacto, colA: "mineralId", colB: "artefactoId", pk: "id" },
  capitulo_personaje: { tabla: s.capituloPersonaje, colA: "capituloId", colB: "personajeId", pk: "id" },
  personaje_cancion: { tabla: s.personajeCancion, colA: "personajeId", colB: "cancionId", pk: "id" },
  capitulo_cancion: { tabla: s.capituloCancion, colA: "capituloId", colB: "cancionId", pk: "id" },
};

// Elementos: una entrada por entidad sobre la misma tabla polimórfica.
for (const entidad of ["bestias", "razas", "personajes", "naciones", "artefactos", "minerales"]) {
  TABLAS_REL[`entidad_elemento:${entidad}`] = {
    tabla: s.entidadElemento,
    colA: "entidadId",
    colB: "elementoId",
    pk: "id",
    orden: "orden",
    filtroA: { col: "entidadTipo", valor: entidad },
  };
}

export function tablaDe(relId: string): TablaRel | undefined {
  return TABLAS_REL[relId];
}
