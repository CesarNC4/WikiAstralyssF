import { pgTable, serial, integer, varchar, text, timestamp, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { estadoPublicacion, tipoLocacion } from "./enums";
import { auditColumns } from "./_audit";

/**
 * Dominio Mapa (§10). Jerarquía nación → región → locación sobre una imagen
 * del mundo (Leaflet CRS.Simple). Coordenadas y polígonos en espacio normalizado
 * 0..1 respecto a la imagen, para ser independientes de su resolución.
 */

/** Subdivisión de una nación, con contorno poligonal y ficha propia. */
export const regiones = pgTable("regiones", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  nacionId: integer("nacion_id"),
  nombre: varchar("nombre").notNull(),
  subtitulo: varchar("subtitulo"),
  descripcion: text("descripcion"),
  historia: text("historia"),
  /** Polígono: array de pares [x, y] normalizados 0..1. */
  poligono: jsonb("poligono").$type<[number, number][]>(),
  centroX: doublePrecision("centro_x"),
  centroY: doublePrecision("centro_y"),
  color: varchar("color"),
  imagenUrl: varchar("imagen_url"),
  bannerUrl: varchar("banner_url"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

/** Punto concreto dentro de una región (ciudad, mazmorra, hito, batalla). */
export const locaciones = pgTable("locaciones", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  regionId: integer("region_id"),
  nacionId: integer("nacion_id"),
  tipo: tipoLocacion("tipo").notNull().default("interes"),
  nombre: varchar("nombre").notNull(),
  subtitulo: varchar("subtitulo"),
  descripcion: text("descripcion"),
  historia: text("historia"),
  x: doublePrecision("x"),
  y: doublePrecision("y"),
  imagenUrl: varchar("imagen_url"),
  bannerUrl: varchar("banner_url"),
  /** Vínculo opcional con un evento de la cronología (locaciones de batalla). */
  eventoId: integer("evento_id"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});
