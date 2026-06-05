import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getRaza, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("razas").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getRaza(Number(id)).catch(() => null);
  if (!x) return { title: "Raza no encontrada" };
  return { title: x.nombre, description: x.subtitulo ?? undefined, openGraph: { title: x.nombre, images: x.imagenUrl ? [x.imagenUrl] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getRaza(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={x.bannerUrl}
      imagen={x.imagenUrl}
      titulo={x.nombre}
      subtitulo={x.subtitulo}
      nombre={x.nombre}
      backHref="/razas"
      backLabel="Razas"
      badges={<>{x.clasificacion && <Badge tone="secondary">{x.clasificacion}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Clasificación", value: x.clasificacion }, { label: "Esperanza de vida", value: x.esperanzaVida }]} />
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }, { label: "Origen", value: x.origen }, { label: "Rasgos físicos", value: x.rasgosFisicos }, { label: "Cultura", value: x.cultura }, { label: "Habilidades de raza", value: x.habilidadesRasgo }]} />
    </FichaShell>
  );
}
