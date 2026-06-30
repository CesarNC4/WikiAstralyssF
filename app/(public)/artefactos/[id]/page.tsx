import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { EntityImage } from "@/components/media/EntityImage";
import { getArtefacto, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("artefactos").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getArtefacto(Number(id)).catch(() => null);
  if (!x) return { title: "Artefacto no encontrado" };
  return { title: x.nombre, description: x.tipo ?? undefined, openGraph: { title: x.nombre, images: x.imagenUrl ? [x.imagenUrl] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getArtefacto(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={x.imagenUrl}
      imagen={x.imagenUrl}
      titulo={x.nombre}
      subtitulo={x.tipo}
      nombre={x.nombre}
      backHref="/artefactos"
      backLabel="Artefactos"
      galeriaTipo="artefactos"
      galeriaId={x.id}
      badges={<>{x.tipo && <Badge tone="accent">{x.tipo}</Badge>}{x.variante && <Badge>{x.variante}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Tipo", value: x.tipo }, { label: "Variante", value: x.variante }]} />

      {(x.propietario || x.propietarioActual) && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl text-accent">Propietario</h2>
          {x.propietario ? (
            <Link
              href={`/personajes/${x.propietario.id}`}
              className="inline-flex items-center gap-3 rounded-xl border border-border-base bg-surface/40 p-2 pr-4 hover:border-border-glow"
            >
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                <EntityImage src={x.propietario.imagenUrl} alt={x.propietario.nombre} name={x.propietario.nombre} sizes="40px" />
              </span>
              <span className="text-sm text-fg">{x.propietario.nombre}</span>
            </Link>
          ) : (
            <p className="text-fg-secondary">{x.propietarioActual}</p>
          )}
        </section>
      )}

      <ProseFields
        fields={[
          { label: "Descripción", value: x.descripcion },
          { label: "Historia", value: x.historia },
          { label: "Poder especial", value: x.poderEspecial },
        ]}
      />
    </FichaShell>
  );
}
