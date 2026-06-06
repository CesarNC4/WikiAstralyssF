import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

/** Dominio Admin: notas privadas del autor. */
export const notaPrivada = pgTable("nota_privada", {
  id: serial("id").primaryKey(),
  entidadTipo: varchar("entidad_tipo").notNull(),
  entidadId: integer("entidad_id").notNull(),
  contenido: text("contenido").notNull(),
  creadoEn: timestamp("creado_en", { mode: "date" }).defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { mode: "date" }).defaultNow(),
});

/** Visibilidad a nivel de campo (ausente = visible) (§13). */
export const campoVisibilidad = pgTable("campo_visibilidad", {
  id: serial("id").primaryKey(),
  entidadTipo: varchar("entidad_tipo").notNull(),
  entidadId: integer("entidad_id").notNull(),
  campo: varchar("campo").notNull(),
  visible: boolean("visible").notNull().default(true),
});

/**
 * Catálogo de valores para los combobox del admin. `campo` identifica el grupo
 * (genero, rango_aventurero, nivel_consciencia, magia_tipo, magia_variante,
 * habilidad_categoria, habilidad_tipo, tipo_relacion, subtipo_relacion...).
 * `grupo` se usa en combobox de dos niveles (p.ej. magia_variante.grupo = tipo).
 * Valores nuevos escritos en el admin se insertan aquí (on conflict do nothing).
 */
export const catalogos = pgTable("catalogos", {
  id: serial("id").primaryKey(),
  campo: varchar("campo").notNull(),
  valor: varchar("valor").notNull(),
  grupo: varchar("grupo"),
  orden: integer("orden").notNull().default(0),
});
