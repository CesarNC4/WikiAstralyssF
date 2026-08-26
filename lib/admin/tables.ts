import "server-only";
import type { PgTable } from "drizzle-orm/pg-core";
import * as s from "@/db/schema";

/** Mapa key de entidad → tabla Drizzle (server-only). */
export const ENTIDAD_TABLES: Record<string, PgTable> = {
  naciones: s.naciones,
  regiones: s.regiones,
  locaciones: s.locaciones,
  razas: s.razas,
  bestias: s.bestias,
  minerales: s.minerales,
  conceptos: s.conceptos,
  magia: s.magiaFundamentos,
  misiones: s.misiones,
  timeline: s.timelineEventos,
  demonios: s.lordDemonio,
  artefactos: s.armasArtefactos,
  economia: s.sistemaMonetario,
  // Narrativa, canciones y catálogo elemental: entraron al admin genérico al
  // recibir estado de publicación y columnas de auditoría.
  capitulos: s.capitulos,
  actos: s.actos,
  arcos: s.tramaArcos,
  hojas: s.tramaHojas,
  hilos: s.hiloNarrativo,
  canciones: s.canciones,
  elementos: s.elementos,
};

export function getEntidadTable(key: string): PgTable | undefined {
  return ENTIDAD_TABLES[key];
}
