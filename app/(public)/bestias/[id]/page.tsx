import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getBestia, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("bestias").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getBestia(Number(id)).catch(() => null);
  if (!x) return { title: "Bestia no encontrada" };
  return { title: x.nombre, description: x.subtitulo ?? undefined, openGraph: { title: x.nombre, images: x.imagenUrl ? [x.imagenUrl] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getBestia(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={x.bannerUrl}
      imagen={x.imagenUrl}
      titulo={x.nombre}
      subtitulo={x.subtitulo}
      nombre={x.nombre}
      backHref="/bestias"
      backLabel="Bestias"
      galeriaTipo="bestias"
      galeriaId={x.id}
      badges={<>{x.nivelAmenaza && <Badge tone="amenaza">Amenaza {x.nivelAmenaza}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Nivel de amenaza", value: x.nivelAmenaza }]} />
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }, { label: "Hábitat", value: x.habitat }, { label: "Comportamiento", value: x.comportamiento }, { label: "Ciclo de vida", value: x.cicloVida }, { label: "Recursos", value: x.recursos }]} />
    </FichaShell>
  );
}
