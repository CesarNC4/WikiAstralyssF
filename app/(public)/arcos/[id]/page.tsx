import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { SectionHead } from "@/components/fichas/FichaHero";
import { Badge } from "@/components/entity/Badge";
import { Conexiones } from "@/components/fichas/Conexiones";
import { getArco, getCapitulosDeArco, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("arcos").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getArco(Number(id)).catch(() => null);
  if (!x) return { title: "Arco no encontrado" };
  return { title: x.nombre, description: x.descripcion ?? undefined, openGraph: { title: x.nombre } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getArco(Number(id)).catch(() => null);
  if (!x) notFound();

  const capitulos = await getCapitulosDeArco(x.id).catch(() => []);
  const color = x.color ?? undefined;

  return (
    <FichaShell
      banner={null}
      imagen={null}
      titulo={x.nombre}
      subtitulo={x.libro}
      nombre={x.nombre}
      backHref="/arcos"
      backLabel="Arcos"
      galeriaTipo="arcos"
      galeriaId={x.id}
      badges={
        <>
          {x.tipo && <Badge tone="accent">{x.tipo}</Badge>}
          {x.libro && <Badge>{x.libro}</Badge>}
        </>
      }
    >
      <FieldGrid fields={[{ label: "Libro", value: x.libro }, { label: "Tipo", value: x.tipo }]} />

      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }]} />

      {capitulos.length > 0 && (
        <section className="mb-6">
          <SectionHead icon="BookOpen" title="Capítulos" accent={color} />
          <div className="flex flex-wrap gap-2">
            {capitulos.map((c) => (
              <Link
                key={c.id}
                href={`/capitulos/${c.id}`}
                className="rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm text-fg hover:border-border-glow"
              >
                <span className="text-fg-muted">Cap. {c.numero}</span> · {c.titulo}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Conexiones generadas desde el registro de relaciones. */}
      <Conexiones entidad="arcos" id={x.id} accent={color} nombre={x.nombre} />
    </FichaShell>
  );
}
