import type { Metadata } from "next";
import { IndiceMusica } from "@/components/musica/IndiceMusica";
import { ENTITIES } from "@/lib/entities";
import { getIndiceMusica } from "@/lib/queries/canciones";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Música", description: ENTITIES.canciones.tagline };

/** Sección Música (docs/fragmentos-y-musica.md §3.7). */
export default async function Page() {
  const datos = await getIndiceMusica().catch(() => ({ canciones: [], capitulos: [], libros: [], usos: [], personajes: [] }));
  return <IndiceMusica meta={ENTITIES.canciones} datos={datos} />;
}
