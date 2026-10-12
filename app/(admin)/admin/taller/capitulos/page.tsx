import { assertAdmin } from "@/lib/actions/auth";
import { Organizar } from "@/components/taller/capitulos/Organizar";
import { getCapituloEditor, getOpcionesCapitulo, getTallerIndice } from "@/lib/queries/taller";

export const dynamic = "force-dynamic";

/** Capítulos (spec §6): organizar libro > capítulo > acto, con edición rápida al lado. */
export default async function CapitulosPage({ searchParams }: { searchParams: Promise<{ capitulo?: string }> }) {
  await assertAdmin();
  const { capitulo } = await searchParams;
  const [indice, opciones, seleccionado] = await Promise.all([
    getTallerIndice(),
    getOpcionesCapitulo(),
    capitulo ? getCapituloEditor(Number(capitulo)) : Promise.resolve(null),
  ]);
  return <Organizar indice={indice} opciones={opciones} seleccionado={seleccionado} />;
}
