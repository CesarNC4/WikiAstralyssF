import "server-only";
import { asc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { catalogos } from "@/db/schema/admin";
import { elementos } from "@/db/schema/elementos";
import type { OpcionCatalogo } from "@/components/admin/fields";

/**
 * Catálogos que necesita el formulario de personaje.
 *
 * Cada lista conserva el `grupo`, que en unos casos agrupa visualmente y en
 * otros es una dependencia de verdad: los subtipos de relación solo valen para
 * su tipo, y las variantes de magia solo para su escuela. Descartarlo era el
 * fallo que hacía que salieran todas mezcladas.
 */
export interface CatalogosPersonaje {
  genero: OpcionCatalogo[];
  rango_aventurero: OpcionCatalogo[];
  nivel_consciencia: OpcionCatalogo[];
  tipo_invocacion: OpcionCatalogo[];
  ocupacion: OpcionCatalogo[];
  estado_vital: OpcionCatalogo[];
  magiaTipos: OpcionCatalogo[];
  /** El catálogo elemental, agrupado por familia. */
  elementos: OpcionCatalogo[];
  habilidad_categoria: OpcionCatalogo[];
  tipo_relacion: OpcionCatalogo[];
  /** Agrupados por tipo de relación: el subtipo depende del tipo. */
  subtipo_relacion: OpcionCatalogo[];
  afecto: OpcionCatalogo[];
  nacion_rol: OpcionCatalogo[];
  org_rol: OpcionCatalogo[];
  artefacto_tipo: OpcionCatalogo[];
  timeline_importancia: OpcionCatalogo[];
  timeline_categoria: OpcionCatalogo[];
}

/** Carga todos los catálogos que necesita el formulario de personaje. */
export async function getCatalogosPersonaje(): Promise<CatalogosPersonaje> {
  const [rows, els] = await Promise.all([
    db
      .select({ campo: catalogos.campo, valor: catalogos.valor, grupo: catalogos.grupo })
      .from(catalogos)
      .orderBy(asc(catalogos.grupo), asc(catalogos.orden), asc(catalogos.valor)),
    db
      .select({ nombre: elementos.nombre, familia: elementos.familia })
      .from(elementos)
      .where(isNull(elementos.eliminadoEn))
      .orderBy(asc(elementos.orden), asc(elementos.nombre)),
  ]);

  const pick = (campo: string): OpcionCatalogo[] =>
    rows.filter((r) => r.campo === campo).map((r) => ({ valor: r.valor, grupo: r.grupo }));

  return {
    genero: pick("genero"),
    rango_aventurero: pick("rango_aventurero"),
    nivel_consciencia: pick("nivel_consciencia"),
    tipo_invocacion: pick("tipo_invocacion"),
    ocupacion: pick("ocupacion"),
    estado_vital: pick("estado_vital"),
    magiaTipos: pick("magia_tipo"),
    elementos: els.map((e) => ({ valor: e.nombre, grupo: e.familia })),
    habilidad_categoria: pick("habilidad_categoria"),
    tipo_relacion: pick("tipo_relacion"),
    subtipo_relacion: pick("subtipo_relacion"),
    afecto: pick("afecto"),
    nacion_rol: pick("nacion_rol"),
    org_rol: pick("org_rol"),
    artefacto_tipo: pick("artefacto_tipo"),
    timeline_importancia: pick("timeline_importancia"),
    timeline_categoria: pick("timeline_categoria"),
  };
}
