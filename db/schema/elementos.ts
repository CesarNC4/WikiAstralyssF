import { pgTable, serial, integer, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";
import { auditColumns } from "./_audit";

/**
 * Catálogo elemental unificado (§overhaul mundo). Un único origen de verdad
 * para los elementos (Pyro, Hydro, Cryo…) con color e icono, reutilizado por
 * naciones, razas, bestias, minerales y magia para afinidades, debilidades y
 * resistencias consistentes y filtrables en toda la web.
 */
export const elementos = pgTable("elementos", {
  id: serial("id").primaryKey(),
  slug: varchar("slug").notNull().unique(),
  nombre: varchar("nombre").notNull(),
  /**
   * Familia del elemento (Elementales, Antiguos, Oscuros, Sacros, Sin elemento).
   * Agrupa los desplegables, filtra la web pública y decide qué variantes ofrece
   * cada escuela de magia.
   */
  familia: varchar("familia"),
  color: varchar("color"),
  icono: varchar("icono"),
  descripcion: text("descripcion"),
  orden: integer("orden").notNull().default(0),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  ...auditColumns(),
});

/**
 * Relación polimórfica entidad ↔ elemento. `relacion` distingue afinidad /
 * debilidad / resistencia. `entidadTipo` es la key de entidad (bestias, razas…).
 */
export const entidadElemento = pgTable(
  "entidad_elemento",
  {
    id: serial("id").primaryKey(),
    entidadTipo: varchar("entidad_tipo").notNull(),
    entidadId: integer("entidad_id").notNull(),
    elementoId: integer("elemento_id").notNull(),
    /** afinidad | debilidad | resistencia */
    relacion: varchar("relacion").notNull(),
    orden: integer("orden").notNull().default(0),
  },
  (t) => [unique("entidad_elemento_unico").on(t.entidadTipo, t.entidadId, t.elementoId, t.relacion)],
);
