import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MineralFichaBody } from "@/components/fichas/MineralFichaBody";
import { getMineral, getVisibleIds } from "@/lib/queries/fichas";
import { Conexiones } from "@/components/fichas/Conexiones";

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
    <>
      <MineralFichaBody mineral={x} />
      {/* Conexiones generadas desde el registro de relaciones. */}
      <div className="mx-auto max-w-5xl space-y-12 px-4 pb-10">
        <Conexiones entidad="minerales" id={x.id} nombre={x.nombre} imagen={x.imagenUrl} conGrafo={false} />
      </div>
    </>
  );
}
