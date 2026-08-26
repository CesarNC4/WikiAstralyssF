import { BloquesRelacion } from "@/components/fichas/BloquesRelacion";
import { getBloquesPublicos } from "@/lib/queries/vinculosPublicos";
import { bloquesAMano } from "@/lib/relaciones/omisiones";
import { MiniGrafoFicha } from "@/components/fichas/MiniGrafoFicha";

/**
 * Todas las conexiones de una ficha pública, en una sola línea por página.
 *
 * Salen del registro de relaciones, así que una relación nueva aparece en las
 * dos fichas implicadas sin tocar ninguna página. Los bloques vacíos no se
 * pintan y los que la ficha ya muestra con presentación propia se descartan en
 * `lib/relaciones/omisiones.ts`.
 */
export async function Conexiones({
  entidad,
  id,
  accent,
  nombre,
  imagen,
  /** El grafo sólo aporta donde la ficha no tiene ya uno propio. */
  conGrafo = true,
}: {
  entidad: string;
  id: number;
  accent?: string;
  nombre?: string | null;
  imagen?: string | null;
  conGrafo?: boolean;
}) {
  const bloques = await getBloquesPublicos(entidad, id).catch(() => []);
  return (
    <>
      <BloquesRelacion bloques={bloques} accent={accent} omitir={bloquesAMano(entidad)} />
      {conGrafo && nombre && (
        <MiniGrafoFicha entidad={entidad} id={id} nombre={nombre} imagen={imagen} accent={accent} />
      )}
    </>
  );
}
