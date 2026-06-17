import { pgTable, serial, integer, varchar, text, unique } from "drizzle-orm/pg-core";

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
  color: varchar("color"),
  icono: varchar("icono"),
  descripcion: text("descripcion"),
  orden: integer("orden").notNull().default(0),
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
