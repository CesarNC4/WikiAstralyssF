import { BloquesRelacion } from "@/components/fichas/BloquesRelacion";
import { getBloquesPublicos } from "@/lib/queries/vinculosPublicos";
import { bloquesAMano } from "@/lib/relaciones/omisiones";
import { MiniMapaFicha } from "@/components/fichas/MiniMapaFicha";

/**
 * Todas las conexiones de una ficha pública, en una sola línea por página: los
 * bloques de relación y el mini-mapa centrado en la ficha (spec §11).
 *
 * Salen del registro de relaciones, así que una relación nueva aparece en las
 * dos fichas implicadas sin tocar ninguna página. Los bloques vacíos no se
 * pintan y los que la ficha ya muestra con presentación propia se descartan en
 * `lib/relaciones/omisiones.ts`; el mapa, en cambio, los recoge todos.
 */
export async function Conexiones({
  entidad,
  id,
  accent,
  nombre,
}: {
  entidad: string;
  id: number;
  accent?: string;
  nombre?: string | null;
  /** Ya no se usa (el mapa no lleva imagen); se acepta para no tocar cada página. */
  imagen?: string | null;
}) {
  const bloques = await getBloquesPublicos(entidad, id).catch(() => []);
  return (
    <>
      <BloquesRelacion bloques={bloques} accent={accent} omitir={bloquesAMano(entidad)} />
      {nombre && <MiniMapaFicha entidad={entidad} id={id} nombre={nombre} bloques={bloques} accent={accent} />}
    </>
  );
}
