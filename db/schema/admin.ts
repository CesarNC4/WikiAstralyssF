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
