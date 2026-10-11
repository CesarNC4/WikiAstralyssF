import { pgTable, serial, integer, varchar, boolean, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Dominio Fechas (spec del taller §13): calendario, eras y la fecha estructurada.
 * La aritmética vive en `lib/fechas/`; aquí solo la forma de guardarlo.
 */

/** Meses y bloques de días fuera de mes, en el orden en que ocurren en el año. */
export const calendarioSegmento = pgTable("calendario_segmento", {
  id: serial("id").primaryKey(),
  orden: integer("orden").notNull().default(0),
  nombre: varchar("nombre").notNull(),
  dias: integer("dias").notNull(),
  /** 'mes' | 'intercalar'. */
  tipo: varchar("tipo").notNull().default("mes"),
});

/** Días de la semana, en orden. Cuántos hay es cuántas filas. */
export const calendarioDiaSemana = pgTable("calendario_dia_semana", {
  id: serial("id").primaryKey(),
  orden: integer("orden").notNull().default(0),
  nombre: varchar("nombre").notNull(),
});

export const era = pgTable("era", {
  id: serial("id").primaryKey(),
  orden: integer("orden").notNull().default(0),
  nombre: varchar("nombre").notNull(),
  abreviatura: varchar("abreviatura"),
  /** Año absoluto de inicio. Null en la primera era, o en una aún sin configurar. */
  anioInicio: integer("anio_inicio"),
});

/**
 * Fecha estructurada de cualquier ficha. Polimórfica, como `vinculo` y
 * `entidad_media`: una sola tabla para todas las entidades, de modo que añadir
 * fechas a una entidad nueva no exige migración y la cronología derivada sale de
 * una sola consulta. Sin clave foránea al destino, así que la integridad se
 * mantiene por código (purga de huérfanas).
 *
 * `rol` distingue varias fechas de una misma ficha: 'principal' para la fecha
 * única de un evento o una misión; 'nacimiento' y 'muerte'; 'fundacion' y
 * 'caida'; 'inicio' y 'fin' de un acto…
 *
 * `clave_ini` / `clave_fin` son días absolutos precalculados para ordenar y
 * comparar. Dependen del calendario y se recalculan todos cuando cambia.
 */
export const fechaLore = pgTable(
  "fecha_lore",
  {
    id: serial("id").primaryKey(),
    entidadTipo: varchar("entidad_tipo").notNull(),
    entidadId: integer("entidad_id").notNull(),
    rol: varchar("rol").notNull().default("principal"),
    iniAnio: integer("ini_anio").notNull(),
    iniSegmentoId: integer("ini_segmento_id"),
    iniDia: integer("ini_dia"),
    finAnio: integer("fin_anio"),
    finSegmentoId: integer("fin_segmento_id"),
    finDia: integer("fin_dia"),
    aproximada: boolean("aproximada").notNull().default(false),
    /** Sale en la cronología destacada (§14). */
    importante: boolean("importante").notNull().default(false),
    claveIni: bigint("clave_ini", { mode: "number" }).notNull(),
    claveFin: bigint("clave_fin", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("fecha_lore_entidad_rol_uq").on(t.entidadTipo, t.entidadId, t.rol),
    index("fecha_lore_clave_idx").on(t.claveIni),
  ],
);
