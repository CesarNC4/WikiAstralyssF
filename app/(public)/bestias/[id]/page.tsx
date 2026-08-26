import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BestiaFichaBody } from "@/components/fichas/BestiaFichaBody";
import { getBestia, getVisibleIds } from "@/lib/queries/fichas";
import { Conexiones } from "@/components/fichas/Conexiones";

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
    <>
      <BestiaFichaBody bestia={x} />
      {/* Conexiones generadas desde el registro de relaciones. */}
      <div className="mx-auto max-w-5xl space-y-12 px-4 pb-10">
        <Conexiones entidad="bestias" id={x.id} nombre={x.nombre} imagen={x.imagenUrl} conGrafo={false} />
      </div>
    </>
  );
}
