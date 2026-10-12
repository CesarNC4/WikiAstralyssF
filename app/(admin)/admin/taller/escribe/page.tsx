import { assertAdmin } from "@/lib/actions/auth";
import { ListaActos } from "@/components/taller/escribe/ListaActos";
import { ActoEditor } from "@/components/taller/escribe/ActoEditor";
import { getCalendario } from "@/lib/queries/fechas";
import { getActoEditor, getOpcionesCapitulo, getTallerIndice } from "@/lib/queries/taller";

export const dynamic = "force-dynamic";

/** Escribe (spec §5): la lista de actos a la izquierda y el editor a la derecha. */
export default async function EscribePage({ searchParams }: { searchParams: Promise<{ acto?: string }> }) {
  await assertAdmin();
  const { acto } = await searchParams;
  const actoId = acto ? Number(acto) : null;

  const [indice, opciones, cal, datos] = await Promise.all([
    getTallerIndice(),
    getOpcionesCapitulo(),
    getCalendario().catch(() => null),
    actoId ? getActoEditor(actoId) : Promise.resolve(null),
  ]);

  const resumen = datos ? indice.actos.find((a) => a.id === datos.acto.id) : undefined;
  const capitulo = datos?.acto.capituloId != null ? indice.capitulos.find((c) => c.id === datos.acto.capituloId) ?? null : null;
  const fases = indice.plantillas.find((p) => p.id === capitulo?.plantillaId)?.fases ?? [];

  return (
    <div className="grid h-screen grid-cols-[340px_1fr]">
      <aside className="h-screen overflow-hidden border-r border-border-base bg-deep/60">
        <ListaActos indice={indice} seleccionado={datos?.acto.id ?? null} estadosNarrativos={opciones.estadosNarrativos} />
      </aside>
      <main className="h-screen overflow-y-auto">
        {datos ? (
          <ActoEditor
            key={datos.acto.id}
            datos={datos}
            etiqueta={resumen?.etiqueta ?? "Acto"}
            capitulo={capitulo}
            fases={fases}
            estadosNarrativos={opciones.estadosNarrativos}
            cal={cal}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm italic text-fg-muted">
              {actoId ? "Ese acto ya no existe o está en la papelera." : "Elige un acto de la lista o crea uno nuevo."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
