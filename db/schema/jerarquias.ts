import { pgTable, serial, integer, varchar, text, boolean } from "drizzle-orm/pg-core";

/** Soporte de familias, organizaciones y gremios: árboles, jerarquías, facciones, rangos, historial. */

// ── Familia ──────────────────────────────────────────────
export const familiaArbol = pgTable("familia_arbol", {
  id: serial("id").primaryKey(),
  familiaId: integer("familia_id").notNull(),
  nombre: varchar("nombre").notNull(),
  personajeId: integer("personaje_id"),
  generacion: integer("generacion"),
  padreId: integer("padre_id"),
  madreId: integer("madre_id"),
  estado: varchar("estado"),
  destacado: boolean("destacado"),
  motivoDestacado: varchar("motivo_destacado"),
  notas: text("notas"),
});

export const familiaJerarquia = pgTable("familia_jerarquia", {
  id: serial("id").primaryKey(),
  familiaId: integer("familia_id").notNull(),
  personajeId: integer("personaje_id"),
  nombre: varchar("nombre"),
  tituloNobiliario: varchar("titulo_nobiliario"),
  tituloFamilia: varchar("titulo_familia"),
  faccionId: integer("faccion_id"),
  orden: integer("orden"),
});

export const familiaFacciones = pgTable("familia_facciones", {
  id: serial("id").primaryKey(),
  familiaId: integer("familia_id").notNull(),
  nombre: varchar("nombre").notNull(),
  color: varchar("color"),
});

// ── Organización ─────────────────────────────────────────
export const orgFacciones = pgTable("org_facciones", {
  id: serial("id").primaryKey(),
  organizacionId: integer("organizacion_id").notNull(),
  nombre: varchar("nombre").notNull(),
  color: varchar("color"),
});

export const orgRangos = pgTable("org_rangos", {
  id: serial("id").primaryKey(),
  organizacionId: integer("organizacion_id").notNull(),
  nombre: varchar("nombre").notNull(),
  peso: integer("peso"),
});

export const orgJerarquia = pgTable("org_jerarquia", {
  id: serial("id").primaryKey(),
  organizacionId: integer("organizacion_id").notNull(),
  personajeId: integer("personaje_id"),
  nombre: varchar("nombre"),
  rangoId: integer("rango_id"),
  tituloApodo: varchar("titulo_apodo"),
  faccionId: integer("faccion_id"),
  orden: integer("orden"),
});

export const orgHistorial = pgTable("org_historial", {
  id: serial("id").primaryKey(),
  organizacionId: integer("organizacion_id").notNull(),
  nombre: varchar("nombre").notNull(),
  personajeId: integer("personaje_id"),
  estado: varchar("estado"),
  rol: varchar("rol"),
  periodo: varchar("periodo"),
  destacado: boolean("destacado"),
  motivoDestacado: varchar("motivo_destacado"),
  notas: text("notas"),
  orden: integer("orden"),
});

// ── Gremio ───────────────────────────────────────────────
export const gremioFacciones = pgTable("gremio_facciones", {
  id: serial("id").primaryKey(),
  gremioId: integer("gremio_id").notNull(),
  nombre: varchar("nombre").notNull(),
  color: varchar("color"),
});

export const gremioRangos = pgTable("gremio_rangos", {
  id: serial("id").primaryKey(),
  gremioId: integer("gremio_id").notNull(),
  nombre: varchar("nombre").notNull(),
  peso: integer("peso"),
});

export const gremioJerarquia = pgTable("gremio_jerarquia", {
  id: serial("id").primaryKey(),
  gremioId: integer("gremio_id").notNull(),
  personajeId: integer("personaje_id"),
  nombre: varchar("nombre"),
  rangoId: integer("rango_id"),
  tituloApodo: varchar("titulo_apodo"),
  faccionId: integer("faccion_id"),
  orden: integer("orden"),
});

export const gremioHistorial = pgTable("gremio_historial", {
  id: serial("id").primaryKey(),
  gremioId: integer("gremio_id").notNull(),
  nombre: varchar("nombre").notNull(),
  personajeId: integer("personaje_id"),
  estado: varchar("estado"),
  rol: varchar("rol"),
  periodo: varchar("periodo"),
  destacado: boolean("destacado"),
  motivoDestacado: varchar("motivo_destacado"),
  notas: text("notas"),
  orden: integer("orden"),
});
