import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";

/** Dominio Narrativa: capítulos, actos, arcos, hojas, hilos. */

export const capitulos = pgTable("capitulos", {
  id: serial("id").primaryKey(),
  numero: varchar("numero").notNull(),
  libro: varchar("libro"),
  titulo: varchar("titulo").notNull(),
  tipo: varchar("tipo"),
  tipoTemporal: varchar("tipo_temporal"),
  marcoNarrativo: varchar("marco_narrativo"),
  narrador: varchar("narrador"),
  paraleloACapituloId: integer("paralelo_a_capitulo_id"),
  notasPrivadas: text("notas_privadas"),
  descripcion: text("descripcion"),
  discordUrl: varchar("discord_url"),
  fechaLore: varchar("fecha_lore"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

export const actos = pgTable("actos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  capituloId: integer("capitulo_id"),
  numeroOrden: integer("numero_orden"),
  descripcion: text("descripcion"),
  estado: varchar("estado"),
  fechaInicioLore: varchar("fecha_inicio_lore"),
  fechaFinLore: varchar("fecha_fin_lore"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

export const tramaArcos = pgTable("trama_arcos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  descripcion: text("descripcion"),
  libro: varchar("libro"),
  tipo: varchar("tipo"),
  color: varchar("color"),
  orden: integer("orden"),
});

export const tramaHojas = pgTable("trama_hojas", {
  id: serial("id").primaryKey(),
  arcoId: integer("arco_id"),
  capituloId: integer("capitulo_id"),
  actoId: integer("acto_id"),
  titulo: varchar("titulo").notNull(),
  orden: integer("orden"),
  estado: varchar("estado"),
  conflictoCentral: text("conflicto_central"),
  giroArgumental: text("giro_argumental"),
  secretosRevelados: text("secretos_revelados"),
  consecuencias: text("consecuencias"),
  notasPrivadas: text("notas_privadas"),
});

export const hiloNarrativo = pgTable("hilo_narrativo", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  descripcion: text("descripcion"),
  estado: varchar("estado"),
  arcoId: integer("arco_id"),
  capituloAperturaId: integer("capitulo_apertura_id"),
  capituloCierreId: integer("capitulo_cierre_id"),
  personajesInvolucrados: text("personajes_involucrados"),
  notasAutor: text("notas_autor"),
  pistasEntregadas: text("pistas_entregadas"),
  orden: integer("orden"),
});
