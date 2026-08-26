import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getMision, getVisibleIds } from "@/lib/queries/fichas";
import { Conexiones } from "@/components/fichas/Conexiones";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("misiones").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getMision(Number(id)).catch(() => null);
  if (!x) return { title: "Misión no encontrada" };
  return { title: x.nombre, description: x.descripcion ?? undefined, openGraph: { title: x.nombre } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getMision(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={null}
      imagen={null}
      titulo={x.nombre}
      subtitulo={x.tipo}
      nombre={x.nombre}
      backHref="/misiones"
      backLabel="Misiones"
      galeriaTipo="misiones"
      galeriaId={x.id}
      badges={<>{x.nivelRiesgo && <Badge tone="amenaza">Riesgo {x.nivelRiesgo}</Badge>}{x.estado && <Badge tone="accent">{x.estado}</Badge>}{x.tipo && <Badge>{x.tipo}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Tipo", value: x.tipo }, { label: "Nivel de riesgo", value: x.nivelRiesgo }, { label: "Estado", value: x.estado }, { label: "Rango mínimo", value: x.rangoMinimo }, { label: "Ubicación", value: x.ubicacion }, { label: "Fecha", value: x.fechaLore }]} />

      {(x.encargante || x.encarganteNombre) && (
        <section className="mb-6">
          <h2 className="mb-2 font-display text-xl text-accent">Encargada por</h2>
          {x.encargante ? (
            <Link href={`/personajes/${x.encargante.id}`} className="inline-flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm text-fg hover:border-border-glow">
              <span className="text-accent">◆</span> {x.encargante.nombre}
            </Link>
          ) : (
            <p className="text-sm text-fg-secondary">{x.encarganteNombre}</p>
          )}
        </section>
      )}

      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }, { label: "Objetivo", value: x.objetivo }, { label: "Recompensa", value: x.recompensa }]} />
      {/* Conexiones generadas desde el registro de relaciones. */}
      <Conexiones entidad="misiones" id={x.id} nombre={x.nombre} imagen={x.imagenUrl} />
    </FichaShell>
  );
}
