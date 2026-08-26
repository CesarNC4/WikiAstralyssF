import { MiniGrafo, type GrafoGrupo } from "@/components/viz/MiniGrafo";
import { getBloquesPublicos } from "@/lib/queries/vinculosPublicos";
import { entityByKey } from "@/lib/entities";

/**
 * Mini-grafo de las conexiones directas de una ficha, construido desde el
 * registro de relaciones.
 *
 * Cuatro fichas ya tenían uno, pero cada una lo armaba a mano con las relaciones
 * que su página conocía. Este funciona en cualquier ficha y crece solo: al
 * declarar una relación nueva, aparece aquí sin tocar nada.
 */

/** Color por entidad, el mismo que usa el Atlas para que el grafo se lea igual. */
const COLOR: Record<string, string> = {
  personajes: "#8b7bff",
  naciones: "#7b5cff",
  razas: "#9b8cff",
  bestias: "#ef6f6f",
  minerales: "#6fc3d6",
  organizaciones: "#5b8def",
  familias: "#e0a44a",
  artefactos: "#d8a05f",
  locaciones: "#5fb98f",
  regiones: "#4f9d7e",
  misiones: "#e6b450",
  conceptos: "#c08bff",
  magia: "#a78bfa",
  lore: "#8ab4f8",
  demonios: "#e05252",
  timeline: "#9aa3b2",
  capitulos: "#8ab4f8",
  arcos: "#c08bff",
};

export async function MiniGrafoFicha({
  entidad,
  id,
  nombre,
  imagen,
  accent,
  /** Un grafo con demasiados nodos deja de leerse; se recortan los sobrantes. */
  maximo = 18,
}: {
  entidad: string;
  id: number;
  nombre: string;
  imagen?: string | null;
  accent?: string;
  maximo?: number;
}) {
  const bloques = await getBloquesPublicos(entidad, id).catch(() => []);
  if (bloques.length === 0) return null;

  // Se agrupa por la entidad del otro extremo, no por bloque: si una ficha tiene
  // tres bloques que apuntan a personajes, en el grafo son un solo grupo.
  const porEntidad = new Map<string, GrafoGrupo>();
  let total = 0;

  for (const b of bloques) {
    for (const fila of b.filas) {
      if (total >= maximo) break;
      const tipo = fila.objetivoTipo ?? b.objetivo;
      const meta = entityByKey(tipo);
      if (!meta || !fila.objetivoId) continue;

      const clave = `${tipo}:${fila.objetivoId}`;
      let grupo = porEntidad.get(tipo);
      if (!grupo) {
        grupo = { label: meta.plural, color: COLOR[tipo] ?? "#9aa3b2", nodos: [] };
        porEntidad.set(tipo, grupo);
      }
      if (grupo.nodos.some((n) => n.id === clave)) continue;

      grupo.nodos.push({
        id: clave,
        label: fila.label,
        href: `${meta.route}/${fila.objetivoId}`,
        img: fila.imagenUrl,
      });
      total++;
    }
  }

  const grupos = [...porEntidad.values()].filter((g) => g.nodos.length > 0);
  if (grupos.length === 0) return null;

  return <MiniGrafo centro={{ label: nombre, img: imagen }} grupos={grupos} accent={accent} />;
}
