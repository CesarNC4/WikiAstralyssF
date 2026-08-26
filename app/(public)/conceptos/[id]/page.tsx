import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getConcepto, getVisibleIds } from "@/lib/queries/fichas";
import { Conexiones } from "@/components/fichas/Conexiones";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("conceptos").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getConcepto(Number(id)).catch(() => null);
  if (!x) return { title: "Concepto no encontrado" };
  return { title: x.nombre, description: x.descripcion ?? undefined, openGraph: { title: x.nombre, images: x.imagenUrl ? [x.imagenUrl] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getConcepto(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={x.imagenUrl}
      imagen={x.imagenUrl}
      titulo={x.nombre}
      subtitulo={x.categoria}
      nombre={x.nombre}
      backHref="/conceptos"
      backLabel="Conceptos"
      galeriaTipo="conceptos"
      galeriaId={x.id}
      badges={<>{x.categoria && <Badge tone="primary">{x.categoria}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Categoría", value: x.categoria }]} />
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }, { label: "Contenido", value: x.contenido }]} />
      {/* Conexiones generadas desde el registro de relaciones. */}
      <Conexiones entidad="conceptos" id={x.id} nombre={x.nombre} imagen={x.imagenUrl} />
    </FichaShell>
  );
}
