import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";
import { auditColumns } from "./_audit";

/** Dominio Media: canciones y sus tablas de unión con narrativa/personajes. */

export const canciones = pgTable("canciones", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo").notNull(),
  artista: varchar("artista"),
  tipoFuente: varchar("tipo_fuente"), // 'LOCAL' | 'YOUTUBE' | 'SPOTIFY' | 'SOUNDCLOUD'
  url: varchar("url"),
  notas: text("notas"),
  imagenUrl: varchar("imagen_url"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  ...auditColumns(),
});

// ── Catálogo de medios centralizado (§1, problema 3) ──
export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  storage: varchar("storage").notNull().default("cloudinary"),
  publicId: varchar("public_id"),
  urlPublica: varchar("url_publica").notNull(),
  tipo: varchar("tipo").notNull().default("imagen"),
  mime: varchar("mime"),
  alt: varchar("alt"),
  ancho: integer("ancho"),
  alto: integer("alto"),
  bytes: integer("bytes"),
  blurhash: varchar("blurhash"),
  creadoEn: timestamp("creado_en", { mode: "date" }).defaultNow(),
});

export const entidadMedia = pgTable("entidad_media", {
  id: serial("id").primaryKey(),
  entidadTipo: varchar("entidad_tipo").notNull(),
  entidadId: integer("entidad_id").notNull(),
  assetId: integer("asset_id").notNull(),
  rol: varchar("rol").notNull().default("galeria"),
  orden: integer("orden").notNull().default(0),
});

export const actoCancion = pgTable("acto_cancion", {
  id: serial("id").primaryKey(),
  actoId: integer("acto_id").notNull(),
  cancionId: integer("cancion_id").notNull(),
  contexto: varchar("contexto"),
});

export const capituloCancion = pgTable("capitulo_cancion", {
  id: serial("id").primaryKey(),
  capituloId: integer("capitulo_id").notNull(),
  cancionId: integer("cancion_id").notNull(),
  contexto: varchar("contexto"),
});

export const personajeCancion = pgTable("personaje_cancion", {
  id: serial("id").primaryKey(),
  personajeId: integer("personaje_id").notNull(),
  cancionId: integer("cancion_id").notNull(),
  contexto: varchar("contexto"),
});

export const hojaCancion = pgTable("hoja_cancion", {
  id: serial("id").primaryKey(),
  hojaId: integer("hoja_id").notNull(),
  cancionId: integer("cancion_id").notNull(),
  nota: varchar("nota"),
});
