import "server-only";
import { revalidatePath } from "next/cache";
import { infoDe } from "@/lib/relaciones/tablas";

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
}
