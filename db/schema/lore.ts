import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";
import { auditColumns } from "./_audit";

/** Dominio Lore: conceptos, magia, páginas de lore, misiones, timeline. */

export const conceptos = pgTable("conceptos", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  categoria: varchar("categoria"),
  /** Sube el concepto arriba del indice. Antes se apanaba con una categoria. */
  destacado: boolean("destacado").notNull().default(false),
  descripcion: text("descripcion"),
  contenido: text("contenido"),
  imagenUrl: varchar("imagen_url"),
  orden: integer("orden"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

export const magiaFundamentos = pgTable("magia_fundamentos", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  categoria: varchar("categoria"),
  /** Naturaleza conceptual: Fundamento | Concepto (teoría) | Tecnica | Tecnica Avanzada (§ punto 12). */
  naturaleza: varchar("naturaleza"),
  /** Que cuesta usarla. */
  coste: varchar("coste"),
  /** Si esta permitida, regulada o prohibida. */
  legalidad: varchar("legalidad"),
  /** Tipo/escuela de la técnica: Elemental | Demoniaca | … (NULL para teoría: fundamentos/conceptos). */
  tipo: varchar("tipo"),
  /** Jerarquía opcional: fundamento del que depende un hechizo. */
  fundamentoPadreId: integer("fundamento_padre_id"),
  subcategoria: varchar("subcategoria"),
  descripcion: text("descripcion"),
  contenido: text("contenido"),
  imagenUrl: varchar("imagen_url"),
  orden: integer("orden"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

export const paginasLore = pgTable("paginas_lore", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  slug: varchar("slug").notNull(),
  titulo: varchar("titulo"),
  subtitulo: varchar("subtitulo"),
  introduccion: text("introduccion"),
  imagenUrl: varchar("imagen_url"),
  bannerUrl: varchar("banner_url"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

/** Secciones ordenadas y extensibles de una página de lore (§1, problema 2). */
export const paginaSecciones = pgTable("pagina_secciones", {
  id: serial("id").primaryKey(),
  paginaId: integer("pagina_id").notNull(),
  orden: integer("orden").notNull().default(0),
  titulo: varchar("titulo"),
  contenido: text("contenido"),
  tipo: varchar("tipo").notNull().default("texto"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("publicado"),
});

export const misiones = pgTable("misiones", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  tipo: varchar("tipo"),
  nivelRiesgo: varchar("nivel_riesgo"),
  estado: varchar("estado"),
  rangoMinimo: varchar("rango_minimo"),
  descripcion: text("descripcion"),
  objetivo: text("objetivo"),
  recompensa: text("recompensa"),
  /** Texto libre, para lugares sin ficha. */
  ubicacion: varchar("ubicacion"),
  // Y si el lugar si tiene ficha, se enlaza de verdad y la mision aparece alli.
  ubicacionNacionId: integer("ubicacion_nacion_id"),
  ubicacionRegionId: integer("ubicacion_region_id"),
  ubicacionLocacionId: integer("ubicacion_locacion_id"),
  tamanoGrupo: varchar("tamano_grupo"),
  personajeId: integer("personaje_id"),
  encarganteNombre: varchar("encargante_nombre"),
  imagenUrl: varchar("imagen_url"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

export const timelineEventos = pgTable("timeline_eventos", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  // La fecha, su importancia y su era salen de `fecha_lore` (spec del taller §13).
  titulo: varchar("titulo").notNull(),
  descripcion: text("descripcion"),
  /**
   * Escala descriptiva (Anécdota… Definitorio). Lo que decide si sale en la
   * cronología destacada es `fecha_lore.importante`.
   */
  importancia: varchar("importancia"),
  categoria: varchar("categoria"),
  capituloId: integer("capitulo_id"),
  /** Acto opcional dentro del capítulo (§14). */
  actoId: integer("acto_id"),
  /** Desempata los eventos del mismo día; el orden lo da la fecha. */
  orden: integer("orden").notNull().default(0),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});
