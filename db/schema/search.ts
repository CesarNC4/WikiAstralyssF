import { pgTable, serial, varchar, customType } from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";

/** Tipo tsvector (no nativo en Drizzle); sólo se lee/consulta vía SQL. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/** Índice de búsqueda materializado, mantenido por triggers (§8). */
export const searchIndex = pgTable("search_index", {
  id: serial("id").primaryKey(),
  entidadTipo: varchar("entidad_tipo").notNull(),
  entidadId: varchar("entidad_id").notNull(),
  titulo: varchar("titulo").notNull(),
  subtitulo: varchar("subtitulo"),
  resumen: varchar("resumen"),
  imagenUrl: varchar("imagen_url"),
  url: varchar("url").notNull(),
  documento: tsvector("documento"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
});
