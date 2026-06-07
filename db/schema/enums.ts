import { pgEnum } from "drizzle-orm/pg-core";

/** Estado de publicación de una entidad (§1, §13). */
export const estadoPublicacion = pgEnum("estado_publicacion", [
  "borrador",
  "publicado",
  "oculto",
]);

export type EstadoPublicacion = (typeof estadoPublicacion.enumValues)[number];

/** Valor canónico para filtrar contenido público. */
export const PUBLICADO = "publicado" as const;

/** Tipo de locación en el mapa (§10). */
export const tipoLocacion = pgEnum("tipo_locacion", [
  "ciudad", // ciudad / capital
  "mazmorra", // mazmorra / ruina
  "interes", // punto de interés / hito
  "batalla", // batalla / evento
]);

export type TipoLocacion = (typeof tipoLocacion.enumValues)[number];
