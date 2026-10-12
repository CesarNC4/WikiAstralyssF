import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { TallerCabecera } from "@/components/taller/TallerShell";
import { CapituloForm } from "@/components/taller/capitulos/CapituloForm";
import { ActosDelCapitulo } from "@/components/taller/capitulos/ActosDelCapitulo";
import { CancionesManuales } from "@/components/taller/capitulos/CancionesManuales";
import { formatoFecha } from "@/lib/fechas";
import { getCalendario } from "@/lib/queries/fechas";
import { getCapituloDerivado } from "@/lib/queries/narrativa";
import { getCapituloEditor, getOpcionesCapitulo, getTallerIndice } from "@/lib/queries/taller";

export const dynamic = "force-dynamic";

/** Pantalla propia del capítulo (spec §3): sus datos arriba y sus actos debajo. */
export default async function CapituloPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  const capitulo = await getCapituloEditor(Number(id));
  if (!capitulo) notFound();

  const [indice, opciones, derivado, cal] = await Promise.all([
    getTallerIndice(),
    getOpcionesCapitulo(),
    getCapituloDerivado(capitulo.id, { publico: false }),
    getCalendario().catch(() => null),
  ]);
  const actos = indice.actos.filter((a) => a.capituloId === capitulo.id);
  const fases = indice.plantillas.find((p) => p.id === capitulo.plantillaId)?.fases ?? [];

  return (
    <>
      <TallerCabecera titulo={capitulo.titulo}>
        <Link href={`/admin/taller/capitulos?capitulo=${capitulo.id}`} className="text-xs text-fg-muted hover:text-fg">
          ← Organizar
        </Link>
        <Link href={`/admin/taller/estructura?capitulo=${capitulo.id}`} className="text-xs text-accent hover:underline">
          Ver en Estructura →
        </Link>
      </TallerCabecera>

      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_20rem] gap-8 px-6 py-6">
        <div className="space-y-8">
          <CapituloForm key={capitulo.id} capitulo={capitulo} opciones={opciones} plantillas={indice.plantillas} />
          <section>
            <h2 className="mb-3 font-display text-lg text-fg">Actos</h2>
            <ActosDelCapitulo capituloId={capitulo.id} actos={actos} fases={fases} conPlantilla={capitulo.plantillaId != null} />
          </section>
        </div>

        {/* Lo que el capítulo calcula de sus actos (§3). */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-border-base bg-surface/30 p-4 text-sm">
            <h2 className="mb-1 font-display text-base text-fg">Calculado de sus actos</h2>
            <p className="mb-3 text-xs text-fg-muted">Incluye borradores; en la web solo cuentan los actos publicados.</p>
            <Dato titulo="Fechas">{derivado.fecha && cal ? formatoFecha(cal, derivado.fecha, "eras") : <Vacio />}</Dato>
            <Dato titulo="Personajes">
              {derivado.personajes.length ? (
                derivado.personajes.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    {p.nombre}
                    {p.pov && <span className="text-accent"> (POV)</span>}
                  </span>
                ))
              ) : (
                <Vacio />
              )}
            </Dato>
            <Dato titulo="Lugares">{derivado.lugares.length ? derivado.lugares.map((l) => l.nombre).join(", ") : <Vacio />}</Dato>
            <Dato titulo="Canciones">{derivado.canciones.length ? derivado.canciones.map((c) => c.titulo).join(", ") : <Vacio />}</Dato>
          </div>
          <CancionesManuales capituloId={capitulo.id} />
        </aside>
      </div>
    </>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] uppercase tracking-wide text-fg-muted">{titulo}</p>
      <div className="text-fg-secondary">{children}</div>
    </div>
  );
}

function Vacio() {
  return <span className="italic text-fg-muted">Nada aún</span>;
}
