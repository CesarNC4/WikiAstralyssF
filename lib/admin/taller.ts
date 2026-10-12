/**
 * Entidades que se editan solo desde el taller del autor (spec §2): capítulos,
 * actos, arcos, hojas de trama e hilos. Sus rutas del admin genérico redirigen
 * aquí, el menú del panel no las lista y el dashboard enlaza al taller.
 *
 * Su configuración de campos sigue en `lib/admin/fields.ts`: la pantalla de
 * Trama reutiliza ese mismo formulario. Client-safe.
 */

export const ENTIDADES_DEL_TALLER = new Set(["capitulos", "actos", "arcos", "hojas", "hilos"]);

type Destino = "lista" | "nuevo" | "papelera" | { id: number };

/** Dónde vive en el taller una pantalla del admin genérico, o null si no es del taller. */
export function rutaEnTaller(entidad: string, destino: Destino): string | null {
  if (!ENTIDADES_DEL_TALLER.has(entidad)) return null;
  if (destino === "papelera") return "/admin/taller/papelera";
  const id = typeof destino === "object" ? destino.id : null;
  switch (entidad) {
    case "capitulos":
      return id != null ? `/admin/taller/capitulos/${id}` : "/admin/taller/capitulos";
    case "actos":
      return id != null ? `/admin/taller/escribe?acto=${id}` : "/admin/taller/escribe";
    default:
      if (id != null) return `/admin/taller/trama/${entidad}/${id}`;
      return destino === "nuevo" ? `/admin/taller/trama/${entidad}/nuevo` : `/admin/taller/trama?vista=${entidad}`;
  }
}

/** Dónde se edita cualquier ficha: el taller, un editor propio o el genérico. */
export function rutaEditor(entidad: string, id: number): string {
  const enTaller = rutaEnTaller(entidad, { id });
  if (enTaller) return enTaller;
  if (entidad === "timeline") return `/admin/timeline/${id}/editar`;
  if (entidad === "gremio") return "/admin/gremio";
  return `/admin/${entidad}/${id}/editar`;
}
