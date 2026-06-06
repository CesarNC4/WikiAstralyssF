import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogos } from "@/db/schema/admin";

export interface CatalogosPersonaje {
  genero: string[];
  rango_aventurero: string[];
  nivel_consciencia: string[];
  magiaTipos: string[];
  /** tipo de magia → variantes disponibles (vacío si el tipo no tiene). */
  magiaVariantes: Record<string, string[]>;
  habilidad_categoria: string[];
  habilidad_tipo: string[];
  tipo_relacion: string[];
  subtipo_relacion: string[];
}

/** Carga todos los catálogos que necesita el formulario de personaje. */
export async function getCatalogosPersonaje(): Promise<CatalogosPersonaje> {
  const rows = await db
    .select({ campo: catalogos.campo, valor: catalogos.valor, grupo: catalogos.grupo })
    .from(catalogos)
    .orderBy(asc(catalogos.orden), asc(catalogos.valor));

  const pick = (campo: string) => rows.filter((r) => r.campo === campo).map((r) => r.valor);

  const magiaVariantes: Record<string, string[]> = {};
  for (const r of rows) {
    if (r.campo === "magia_variante" && r.grupo) {
      (magiaVariantes[r.grupo] ??= []).push(r.valor);
    }
  }

  return {
    genero: pick("genero"),
    rango_aventurero: pick("rango_aventurero"),
    nivel_consciencia: pick("nivel_consciencia"),
    magiaTipos: pick("magia_tipo"),
    magiaVariantes,
    habilidad_categoria: pick("habilidad_categoria"),
    habilidad_tipo: pick("habilidad_tipo"),
    tipo_relacion: pick("tipo_relacion"),
    subtipo_relacion: pick("subtipo_relacion"),
  };
}
