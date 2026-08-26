import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { SectionHead } from "@/components/fichas/FichaHero";
import { Badge } from "@/components/entity/Badge";
import { Conexiones } from "@/components/fichas/Conexiones";
import { getCapitulo, getActosDeCapitulo, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("capitulos").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getCapitulo(Number(id)).catch(() => null);
  if (!x) return { title: "Capítulo no encontrado" };
  return {
    title: `Cap. ${x.numero} — ${x.titulo}`,
    description: x.descripcion ?? undefined,
    openGraph: { title: x.titulo },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getCapitulo(Number(id)).catch(() => null);
  if (!x) notFound();

  const actos = await getActosDeCapitulo(x.id).catch(() => []);

  return (
    <FichaShell
      banner={null}
      imagen={null}
      titulo={x.titulo}
      subtitulo={x.libro ? `${x.libro} · Capítulo ${x.numero}` : `Capítulo ${x.numero}`}
      nombre={x.titulo}
      backHref="/capitulos"
      backLabel="Capítulos"
      galeriaTipo="capitulos"
      galeriaId={x.id}
      badges={
        <>
          {x.tipo && <Badge tone="accent">{x.tipo}</Badge>}
          {x.tipoTemporal && <Badge>{x.tipoTemporal}</Badge>}
          {x.narrador && <Badge tone="secondary">Narra {x.narrador}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Número", value: x.numero },
          { label: "Libro", value: x.libro },
          { label: "Tipo", value: x.tipo },
          { label: "Marco narrativo", value: x.marcoNarrativo },
          { label: "Narrador", value: x.narrador },
          { label: "Fecha (lore)", value: x.fechaLore },
        ]}
      />

      {/* `notasPrivadas` no se muestra nunca: es material de autor. */}
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }]} />

      {actos.length > 0 && (
        <section className="mb-6">
          <SectionHead icon="Clapperboard" title="Actos" />
          <ol className="space-y-2">
            {actos.map((a) => (
              <li key={a.id} className="rounded-xl border border-border-base bg-surface/40 p-3">
                <p className="text-sm text-fg">{a.nombre}</p>
                {a.estado && <p className="text-xs text-fg-muted">{a.estado}</p>}
                {a.descripcion && <p className="mt-1 text-sm text-fg-secondary">{a.descripcion}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Conexiones generadas desde el registro de relaciones. */}
      <Conexiones entidad="capitulos" id={x.id} nombre={x.titulo} />
    </FichaShell>
  );
}
