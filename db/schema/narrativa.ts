import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";
import { auditColumns } from "./_audit";

/** Dominio Narrativa: capítulos, actos, arcos, hojas, hilos y estructura. */

/**
 * Plantilla de estructura (spec del taller §7): una lista de fases propia del
 * autor. Cada capítulo usa una y cada uno de sus actos se coloca en una fase.
 */
export const estructuraPlantilla = pgTable("estructura_plantilla", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  descripcion: text("descripcion"),
  /** La que viene preseleccionada al crear un capítulo. Como mucho una. */
  predeterminada: boolean("predeterminada").notNull().default(false),
  orden: integer("orden").notNull().default(0),
});

export const estructuraFase = pgTable("estructura_fase", {
  id: serial("id").primaryKey(),
  plantillaId: integer("plantilla_id").notNull(),
  orden: integer("orden").notNull().default(0),
  nombre: varchar("nombre").notNull(),
  /** Insignia de la tarjeta en el tablero (A1, Nudo…). */
  abreviatura: varchar("abreviatura"),
  color: varchar("color"),
  /** Qué debería ocurrir en esta fase: recordatorio al escribir. */
  guia: text("guia"),
});

export const capitulos = pgTable("capitulos", {
  id: serial("id").primaryKey(),
  /**
   * Rótulo calculado ("Capítulo 3", "Prólogo"): lo reescribe el servidor cada
   * vez que cambia el orden, el tipo o el libro (lib/narrativa/numeracion.ts).
   * Se guarda en lugar de calcularse al leer para que el buscador y las fichas
   * lo sigan leyendo como siempre.
   */
  numero: varchar("numero").notNull(),
  /** Posición dentro de su libro. */
  orden: integer("orden").notNull().default(0),
  /** Plantilla de estructura. Obligatoria salvo en los capítulos anteriores al taller. */
  plantillaId: integer("plantilla_id"),
  libro: varchar("libro"),
  titulo: varchar("titulo").notNull(),
  tipo: varchar("tipo"),
  tipoTemporal: varchar("tipo_temporal"),
  marcoNarrativo: varchar("marco_narrativo"),
  /** Texto libre, para narradores sin ficha. */
  narrador: varchar("narrador"),
  /** Y si el narrador tiene ficha, se enlaza. */
  narradorPersonajeId: integer("narrador_personaje_id"),
  /** Como narra: omnisciente, primera persona... */
  narradorTipo: varchar("narrador_tipo"),
  paraleloACapituloId: integer("paralelo_a_capitulo_id"),
  notasPrivadas: text("notas_privadas"),
  /** Intro propia. La ficha añade debajo los resúmenes de sus actos (§3). */
  descripcion: text("descripcion"),
  discordUrl: varchar("discord_url"),
  /** Texto viejo: la fecha del capítulo se calcula de sus actos. Se retirará. */
  fechaLore: varchar("fecha_lore"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  ...auditColumns(),
});

export const actos = pgTable("actos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  capituloId: integer("capitulo_id"),
  /** Posición dentro del capítulo; de ella sale "Acto I, II…". */
  numeroOrden: integer("numero_orden"),
  /** Resumen del acto. */
  descripcion: text("descripcion"),
  estado: varchar("estado"),
  /** Fase de la plantilla de su capítulo (§7). */
  faseId: integer("fase_id"),
  notasPrivadas: text("notas_privadas"),
  discordUrl: varchar("discord_url"),
  /** Textos viejos: la fecha vive en `fecha_lore`. Se retirarán. */
  fechaInicioLore: varchar("fecha_inicio_lore"),
  fechaFinLore: varchar("fecha_fin_lore"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  ...auditColumns(),
});

export const tramaArcos = pgTable("trama_arcos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  descripcion: text("descripcion"),
  libro: varchar("libro"),
  tipo: varchar("tipo"),
  color: varchar("color"),
  orden: integer("orden"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  ...auditColumns(),
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
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  ...auditColumns(),
});

export const hiloNarrativo = pgTable("hilo_narrativo", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  descripcion: text("descripcion"),
  estado: varchar("estado"),
  arcoId: integer("arco_id"),
  capituloAperturaId: integer("capitulo_apertura_id"),
  capituloCierreId: integer("capitulo_cierre_id"),
  /** Acto concreto en que se abre o se cierra el hilo (§4). */
  actoAperturaId: integer("acto_apertura_id"),
  actoCierreId: integer("acto_cierre_id"),
  personajesInvolucrados: text("personajes_involucrados"),
  notasAutor: text("notas_autor"),
  pistasEntregadas: text("pistas_entregadas"),
  orden: integer("orden"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  ...auditColumns(),
});
