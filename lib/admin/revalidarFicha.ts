import "server-only";
import { revalidatePath } from "next/cache";
import { infoDe } from "@/lib/relaciones/tablas";

/** Los grupos cuyos datos salen en la ficha de sus miembros: el banner que heredan, su nombre… */
const GRUPOS = new Set(["organizaciones", "familias", "gremio", "naciones"]);

/**
 * Al cambiar un grupo se regeneran todas las fichas de personaje, no solo la del grupo: un
 * personaje sin banner propio enseña el del grupo (`lib/queries/bannerHeredado.ts`), y sin esto
 * seguía con el de antes hasta una hora. No las regenera de golpe: cada una, en su próxima visita.
 * Son todas porque un miembro que se quita del grupo también cambia, y ese ya no sale en él.
 */
export function revalidarMiembros(entidad: string) {
  if (GRUPOS.has(entidad)) revalidatePath("/personajes/[id]", "page");
}

/** Lo público que enseña una ficha: la suya, su índice y lo que se monta con todas. */
export function revalidarFicha(entidad: string, id: number) {
  const ruta = infoDe(entidad)?.ruta;
  if (entidad === "actos" || entidad === "fragmentos") revalidatePath("/capitulos/[id]/actos/[actoId]", "page");
  else if (entidad === "lore") revalidatePath("/lore/[slug]", "page");
  else if (entidad === "gremio") revalidatePath("/gremio");
  else if (ruta) revalidatePath(`${ruta}/${id}`);
  if (ruta) revalidatePath(ruta);
  for (const r of ["/atlas", "/compendio", "/alturas", "/mapa"]) revalidatePath(r);
  revalidatePath("/timeline", "layout");
  revalidarMiembros(entidad);
}
