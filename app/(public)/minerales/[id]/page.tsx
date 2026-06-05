import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getMineral, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("minerales").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getMineral(Number(id)).catch(() => null);
  if (!x) return { title: "Mineral no encontrado" };
  return { title: x.nombre, description: x.descripcion ?? undefined, openGraph: { title: x.nombre, images: x.imagenUrl ? [x.imagenUrl] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getMineral(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={x.imagenUrl}
      imagen={x.imagenUrl}
      titulo={x.nombre}
      subtitulo={x.tipo}
      nombre={x.nombre}
      backHref="/minerales"
      backLabel="Minerales"
      badges={<>{x.rareza && <Badge tone="rareza" rarezaKey={x.rareza}>{x.rareza}</Badge>}{x.tipo && <Badge>{x.tipo}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Rareza", value: x.rareza }, { label: "Tipo", value: x.tipo }, { label: "Origen", value: x.origen }]} />
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }, { label: "Propiedades", value: x.propiedades }, { label: "Usos", value: x.usos }]} />
    </FichaShell>
  );
}
