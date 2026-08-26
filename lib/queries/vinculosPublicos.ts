import "server-only";
import { bloquesDe } from "@/lib/relaciones/registro";
import { leerFilas } from "@/lib/relaciones/consultas";
import type { FilaVinculo } from "@/lib/relaciones/tipos";

/**
 * Bloques de relación de una ficha pública. Salen del registro, así que aparecen
 * los dos sentidos de cada relación sin escribir una consulta por ficha: la
 * nación lista sus personajes y el personaje sus naciones desde una única
 * declaración.
 *
 * Los bloques vacíos no se devuelven: en público una ficha se ve completa
 * aunque le falten conexiones, y es en el admin donde se señalan como
 * pendientes.
 */
export interface BloquePublico {
  clave: string;
  titulo: string;
  icon: string;
  hint?: string;
  /** Entidad que se lista, para saber a dónde enlazar. */
  objetivo: string;
  filas: FilaVinculo[];
}

export async function getBloquesPublicos(entidad: string, ownerId: number): Promise<BloquePublico[]> {
  if (!ownerId) return [];

  const candidatos = bloquesDe(entidad).filter((b) => !b.sinPublico);

  const bloques = await Promise.all(
    candidatos.map(async (b) => {
      // `publico: true` descarta las fichas en borrador, ocultas o en la
      // papelera del otro extremo, sin que el bloque desaparezca por ello.
      const filas = await leerFilas(b.relId, b.lado, ownerId, { publico: true, limite: 48 });
      return {
        clave: `${b.relId}:${b.lado}`,
        titulo: b.titulo,
        icon: b.icon,
        hint: b.hint,
        objetivo: b.objetivo,
        filas,
      };
    }),
  );

  return bloques.filter((b) => b.filas.length > 0);
}
