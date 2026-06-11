import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";
import { auditColumns } from "./_audit";

/** Dominio Lore: conceptos, magia, páginas de lore, misiones, timeline. */

export const conceptos = pgTable("conceptos", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  categoria: varchar("categoria"),
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
  /** Naturaleza conceptual: Fundamento | Tecnica Avanzada | Concepto | Hechizo (§ punto 12). */
  naturaleza: varchar("naturaleza"),
  /** Tipo/escuela del hechizo: Elemental | Demoniaca | … (NULL para conceptos del sistema). */
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
  ubicacion: varchar("ubicacion"),
  fechaLore: varchar("fecha_lore"),
  personajeId: integer("personaje_id"),
  encarganteNombre: varchar("encargante_nombre"),
  imagenUrl: varchar("imagen_url"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});

export const timelineEventos = pgTable("timeline_eventos", {
  ...auditColumns(),
  id: serial("id").primaryKey(),
  fechaLore: varchar("fecha_lore").notNull(),
  titulo: varchar("titulo").notNull(),
  descripcion: text("descripcion"),
  importancia: varchar("importancia"),
  categoria: varchar("categoria"),
  /** Era / edad para agrupar la cronología (§ punto 13). */
  era: varchar("era"),
  capituloId: integer("capitulo_id"),
  orden: integer("orden").notNull().default(0),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
});
