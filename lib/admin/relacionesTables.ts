import "server-only";
import type { PgTable } from "drizzle-orm/pg-core";
import { mineralUso } from "@/db/schema/relacionesNM";

/**
 * Registro server-only de las sub-listas de texto. Clave `${entidad}:${relKey}`.
 * Las relaciones entre fichas viven en `lib/relaciones/tablas.ts`.
 */
export interface RelTableDef {
  table: PgTable;
  ownerCol: string;
  libreCols: string[];
  orden: boolean;
}

export const REL_TABLES: Record<string, RelTableDef> = {
  "minerales:mineral_uso": { table: mineralUso, ownerCol: "mineralId", libreCols: ["nombre", "detalle"], orden: true },
};

export function getRelTableDef(entidad: string, relKey: string): RelTableDef | undefined {
  return REL_TABLES[`${entidad}:${relKey}`];
}
