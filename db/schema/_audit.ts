import { timestamp } from "drizzle-orm/pg-core";

/**
 * Columnas de auditoría/papelera compartidas por todas las entidades gestionables.
 * Factory (devuelve builders frescos) para no reutilizar el mismo objeto entre tablas.
 */
export const auditColumns = () => ({
  creadoEn: timestamp("creado_en", { mode: "date" }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { mode: "date" }).notNull().defaultNow(),
  eliminadoEn: timestamp("eliminado_en", { mode: "date" }),
});
