import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getMagia, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("magia").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getMagia(Number(id)).catch(() => null);
  if (!x) return { title: "Fundamento no encontrado" };
  return { title: x.nombre, description: x.descripcion ?? undefined, openGraph: { title: x.nombre, images: x.imagenUrl ? [x.imagenUrl] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getMagia(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={x.imagenUrl}
      imagen={x.imagenUrl}
      titulo={x.nombre}
      subtitulo={x.categoria}
      nombre={x.nombre}
      backHref="/magia"
      backLabel="Magia"
      galeriaTipo="magia"
      galeriaId={x.id}
      badges={<>{x.categoria && <Badge tone="primary">{x.categoria}</Badge>}{x.subcategoria && <Badge>{x.subcategoria}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Categoría", value: x.categoria }, { label: "Subcategoría", value: x.subcategoria }]} />
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }, { label: "Contenido", value: x.contenido }]} />
    </FichaShell>
  );
}
