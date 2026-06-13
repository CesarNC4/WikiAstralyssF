import { pgTable, serial, integer, varchar, boolean, text } from "drizzle-orm/pg-core";

/** Tablas de relación N:M entre dominios. */

/** Eventos clave del personaje: vínculo a la cronología global con nota propia del PJ. */
export const personajeEvento = pgTable("personaje_evento", {
  id: serial("id").primaryKey(),
  personajeId: integer("personaje_id").notNull(),
  timelineEventoId: integer("timeline_evento_id").notNull(),
  nota: text("nota"),
  orden: integer("orden").notNull().default(0),
});

/** Objetos/armas/artefactos del personaje: vínculo al catálogo global con nota propia del PJ. */
export const personajeObjeto = pgTable("personaje_objeto", {
  id: serial("id").primaryKey(),
  personajeId: integer("personaje_id").notNull(),
  armaArtefactoId: integer("arma_artefacto_id").notNull(),
  nota: text("nota"),
  orden: integer("orden").notNull().default(0),
});

export const capituloPersonaje = pgTable("capitulo_personaje", {
  id: serial("id").primaryKey(),
  capituloId: integer("capitulo_id").notNull(),
  personajeId: integer("personaje_id").notNull(),
  rolEnCapitulo: varchar("rol_en_capitulo"),
});

export const personajeNacion = pgTable("personaje_nacion", {
  id: serial("id").primaryKey(),
  personajeId: integer("personaje_id").notNull(),
  nacionId: integer("nacion_id").notNull(),
  tipo: varchar("tipo"),
  descripcion: varchar("descripcion"),
});

export const personajeRaza = pgTable("personaje_raza", {
  id: serial("id").primaryKey(),
  personajeId: integer("personaje_id").notNull(),
  razaId: integer("raza_id").notNull(),
  esMixta: boolean("es_mixta"),
  nota: varchar("nota"),
});

export const personajeOrganizacion = pgTable("personaje_organizacion", {
  id: serial("id").primaryKey(),
  personajeId: integer("personaje_id").notNull(),
  organizacionId: integer("organizacion_id").notNull(),
  rol: varchar("rol"),
  tipo: varchar("tipo"),
  descripcion: varchar("descripcion"),
});

export const nacionOrganizacion = pgTable("nacion_organizacion", {
  id: serial("id").primaryKey(),
  nacionId: integer("nacion_id").notNull(),
  organizacionId: integer("organizacion_id").notNull(),
  tipo: varchar("tipo"),
  descripcion: varchar("descripcion"),
});

export const nacionRaza = pgTable("nacion_raza", {
  id: serial("id").primaryKey(),
  nacionId: integer("nacion_id").notNull(),
  razaId: integer("raza_id").notNull(),
  tipo: varchar("tipo"),
});

export const hojaPersonaje = pgTable("hoja_personaje", {
  id: serial("id").primaryKey(),
  hojaId: integer("hoja_id").notNull(),
  personajeId: integer("personaje_id").notNull(),
  rolEnTrama: varchar("rol_en_trama"),
});

export const hojaDependencia = pgTable("hoja_dependencia", {
  id: serial("id").primaryKey(),
  hojaId: integer("hoja_id").notNull(),
  dependeDeId: integer("depende_de_id").notNull(),
  nota: varchar("nota"),
});
