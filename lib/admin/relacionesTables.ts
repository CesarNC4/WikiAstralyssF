import "server-only";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  bestiaNacion,
  bestiaRegion,
  bestiaDrop,
  bestiaRelacion,
  mineralArtefacto,
  mineralUso,
  nacionRaza,
  nacionDiplomacia,
} from "@/db/schema/relacionesNM";
import { entidadElemento } from "@/db/schema/elementos";

/**
 * Registro server-only de los bloques de relación. Clave `${entidad}:${relKey}`.
 * Define la tabla, la columna del dueño, la columna objetivo y las columnas extra
 * permitidas (allowlist contra payloads maliciosos). `tipoPolimorfico` activa el
 * filtrado/escritura de `entidadTipo` para la tabla polimórfica de elementos.
 */
export interface RelTableDef {
  table: PgTable;
  ownerCol: string;
  targetCol?: string;
  libreCols?: string[];
  extraCols: string[];
  orden: boolean;
  tipoPolimorfico?: string;
}

export const REL_TABLES: Record<string, RelTableDef> = {
  "bestias:bestia_nacion": { table: bestiaNacion, ownerCol: "bestiaId", targetCol: "nacionId", extraCols: ["nota"], orden: false },
  "bestias:bestia_region": { table: bestiaRegion, ownerCol: "bestiaId", targetCol: "regionId", extraCols: ["nota"], orden: false },
  "bestias:bestia_drop": { table: bestiaDrop, ownerCol: "bestiaId", targetCol: "mineralId", extraCols: ["rareza", "nota"], orden: true },
  "bestias:bestia_relacion": { table: bestiaRelacion, ownerCol: "bestiaId", targetCol: "relacionadaId", extraCols: ["tipo", "nota"], orden: false },
  "bestias:entidad_elemento": { table: entidadElemento, ownerCol: "entidadId", targetCol: "elementoId", extraCols: ["relacion"], orden: false, tipoPolimorfico: "bestias" },
  "minerales:mineral_artefacto": { table: mineralArtefacto, ownerCol: "mineralId", targetCol: "artefactoId", extraCols: ["nota"], orden: false },
  "minerales:mineral_uso": { table: mineralUso, ownerCol: "mineralId", libreCols: ["nombre", "detalle"], extraCols: [], orden: true },
  "razas:nacion_raza": { table: nacionRaza, ownerCol: "razaId", targetCol: "nacionId", extraCols: ["tipo"], orden: false },
  "razas:entidad_elemento": { table: entidadElemento, ownerCol: "entidadId", targetCol: "elementoId", extraCols: ["relacion"], orden: false, tipoPolimorfico: "razas" },
  "naciones:nacion_diplomacia": { table: nacionDiplomacia, ownerCol: "nacionId", targetCol: "otraNacionId", extraCols: ["tipo", "nota"], orden: false },
};

export function getRelTableDef(entidad: string, relKey: string): RelTableDef | undefined {
  return REL_TABLES[`${entidad}:${relKey}`];
}
