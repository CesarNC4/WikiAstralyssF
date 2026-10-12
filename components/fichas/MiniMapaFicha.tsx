import { SectionHead } from "@/components/fichas/FichaHero";
import { entityByKey } from "@/lib/entities";
import type { BloquePublico } from "@/lib/queries/vinculosPublicos";
import { getCategoriasRelacion } from "@/lib/queries/categoriasRelacion";
import { getRelacion } from "@/lib/relaciones/registro";
import { MiniMapa, type VecinoMiniMapa } from "./MiniMapa";

/**
 * Mini-mapa de las conexiones directas de una ficha (spec §11), construido con
 * los mismos bloques públicos que pinta `Conexiones`. Funciona en cualquier
 * ficha y crece solo al declarar relaciones nuevas en el registro.
 */
export async function MiniMapaFicha({
  entidad,
  id,
  nombre,
  bloques,
  accent,
  /** Un mapa con demasiadas fichas deja de leerse; se recortan las sobrantes. */
  maximo = 30,
}: {
  entidad: string;
  id: number;
  nombre: string;
  bloques: BloquePublico[];
  accent?: string;
  maximo?: number;
}) {
  const vecinos = new Map<string, VecinoMiniMapa>();
  for (const b of bloques) {
    // La clave del bloque es "<relación>:<lado>".
    const relId = b.clave.slice(0, b.clave.lastIndexOf(":"));
    const destacado = getRelacion(relId)?.campos.find((c) => c.destacado)?.name;
    for (const fila of b.filas) {
      const tipo = fila.objetivoTipo ?? b.objetivo;
      const meta = entityByKey(tipo);
      if (!meta || !fila.objetivoId) continue;
      const clave = `${tipo}:${fila.objetivoId}`;
      if (clave === `${entidad}:${id}`) continue;
      const relacion = { relId, titulo: b.titulo, matiz: destacado ? fila.campos[destacado] || null : null };
      const ya = vecinos.get(clave);
      if (ya) {
        ya.relaciones.push(relacion);
        continue;
      }
      if (vecinos.size >= maximo) continue;
      vecinos.set(clave, {
        id: clave,
        tipo,
        label: fila.label,
        href: fila.ruta ?? `${meta.route}/${fila.objetivoId}`,
        relaciones: [relacion],
      });
    }
  }
  if (vecinos.size === 0) return null;

  const cats = await getCategoriasRelacion().catch(() => ({ categorias: [], tipos: [] }));
  const categoriaDeTipo: Record<string, number> = {};
  for (const t of cats.tipos) if (t.categoriaId != null) categoriaDeTipo[t.valor] = t.categoriaId;

  return (
    <section className="mb-8">
      <SectionHead icon="Network" title="Mapa de conexiones" accent={accent} />
      <MiniMapa
        centro={{ id: `${entidad}:${id}`, tipo: entidad, label: nombre }}
        vecinos={[...vecinos.values()]}
        categorias={cats.categorias}
        categoriaDeTipo={categoriaDeTipo}
      />
    </section>
  );
}
