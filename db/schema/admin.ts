import { pgTable, serial, integer, varchar, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

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
  /**
   * Datos extra de una opción, según el catálogo: `{ numerado: false }` en
   * `capitulo_tipo` para los tipos que no consumen número de capítulo.
   */
  meta: jsonb("meta").$type<Record<string, unknown>>(),
});

/**
 * Avisos a Discord (docs/arquitectura.md §14). El canal por defecto de cada tipo
 * de ficha; sin fila, ese tipo no avisa salvo que se elija un canal al publicar.
 */
export const discordCanal = pgTable("discord_canal", {
  entidadTipo: varchar("entidad_tipo").primaryKey(),
  canalId: varchar("canal_id").notNull(),
  actualizadoEn: timestamp("actualizado_en", { mode: "date" }).notNull().defaultNow(),
});

/** Cada aviso enviado a Discord: el de un cambio va por defecto al canal del estreno. */
export const discordAviso = pgTable("discord_aviso", {
  id: serial("id").primaryKey(),
  entidadTipo: varchar("entidad_tipo").notNull(),
  entidadId: integer("entidad_id").notNull(),
  /** 'estreno' | 'cambio' | 'prueba' */
  clase: varchar("clase").notNull(),
  canalId: varchar("canal_id").notNull(),
  mensajeId: varchar("mensaje_id"),
  nota: text("nota"),
  enviadoEn: timestamp("enviado_en", { mode: "date" }).notNull().defaultNow(),
});
