/**
 * Sistema de fechas del lore (spec del taller §13). Client-safe y sin
 * dependencias: lo usan el servidor, el navegador y los scripts de migración
 * (que Node ejecuta como .ts directamente, de ahí las extensiones explícitas).
 */
export * from "./tipos.ts";
export * from "./calendario.ts";
export * from "./formato.ts";
export * from "./texto.ts";
export * from "./roles.ts";
export * from "./edad.ts";
