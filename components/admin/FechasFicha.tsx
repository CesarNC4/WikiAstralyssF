import { rolesDe } from "@/lib/fechas";
import { getCalendario, leerFechasDe } from "@/lib/queries/fechas";
import { FechasEditor, type FechaInicial } from "./FechasEditor";

/**
 * Carga lo que necesita el editor de fechas de una ficha y lo pinta. Server
 * Component: cada página de edición lo coloca donde le venga bien, también
 * dentro de formularios cliente a través de una prop.
 */
export async function FechasFicha({ entidad, id }: { entidad: string; id: number }) {
  const roles = rolesDe(entidad);
  if (roles.length === 0) return null;
  const datos = await Promise.all([getCalendario(), leerFechasDe(entidad, id)]).catch((e) => {
    console.error("[FechasFicha]", e);
    return null;
  });
  if (!datos) return <p className="text-xs text-warning">No se pudieron cargar las fechas.</p>;
  const [cal, fechas] = datos;
  const inicial: Record<string, FechaInicial> = {};
  for (const [rol, f] of Object.entries(fechas)) inicial[rol] = { fecha: f.fecha, importante: f.importante };
  return <FechasEditor entidad={entidad} id={id} roles={roles} inicial={inicial} cal={cal} />;
}
