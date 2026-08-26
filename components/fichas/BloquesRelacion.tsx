import { SectionHead } from "@/components/fichas/FichaHero";
import { LinkGrid, type LinkGridItem } from "@/components/fichas/LinkGrid";
import { entityByKey } from "@/lib/entities";
import type { BloquePublico } from "@/lib/queries/vinculosPublicos";
import type { FilaVinculo } from "@/lib/relaciones/tipos";

/**
 * Pinta los bloques de relación de una ficha pública. Un único componente para
 * todas las entidades: lo que se muestra viene del registro, de modo que añadir
 * una relación la hace aparecer en las dos fichas sin tocar esto ni escribir una
 * consulta.
 *
 * `omitir` sirve para las secciones que una ficha concreta ya pinta a mano con
 * una presentación propia (el mapa de territorio de una nación, la diplomacia
 * con sus colores). Sin esa lista saldrían dos veces.
 */
export function BloquesRelacion({
  bloques,
  accent,
  omitir = [],
}: {
  bloques: BloquePublico[];
  accent?: string;
  /** Claves `relId:lado` que esta ficha ya muestra por su cuenta. */
  omitir?: string[];
}) {
  const fuera = new Set(omitir);
  const visibles = bloques.filter((b) => !fuera.has(b.clave));
  if (visibles.length === 0) return null;

  return (
    <>
      {visibles.map((b) => (
        <section key={b.clave}>
          <SectionHead icon={b.icon} title={b.titulo} accent={accent} />
          {b.hint && <p className="-mt-3 mb-3 text-sm text-fg-muted">{b.hint}</p>}
          <LinkGrid items={b.filas.map((fila) => aItem(fila, b.objetivo)).filter((x): x is LinkGridItem => x !== null)} />
        </section>
      ))}
    </>
  );
}

function aItem(fila: FilaVinculo, objetivo: string): LinkGridItem | null {
  const meta = entityByKey(fila.objetivoTipo ?? objetivo);
  if (!meta || !fila.objetivoId) return null;
  // El primer campo con contenido describe el vínculo ("Capitán", "Depredador",
  // "Sede"); es lo que aporta significado junto al nombre.
  const nota = Object.values(fila.campos).find((v) => v && v !== "false" && v !== "true");
  return {
    id: fila.objetivoId,
    nombre: fila.label,
    img: fila.imagenUrl ?? null,
    nota: nota ?? fila.detalle ?? null,
    href: `${meta.route}/${fila.objetivoId}`,
  };
}
