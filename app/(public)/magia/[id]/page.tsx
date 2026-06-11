import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MagiaFichaBody } from "@/components/magia/MagiaFichaBody";
import { getMagiaFicha } from "@/lib/queries/magia";
import { getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("magia").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getMagiaFicha(Number(id)).catch(() => null);
  if (!data) return { title: "Magia no encontrada" };
  const { magia } = data;
  return {
    title: magia.nombre,
    description: magia.descripcion ?? undefined,
    openGraph: { title: magia.nombre, images: magia.imagenUrl ? [magia.imagenUrl] : undefined },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMagiaFicha(Number(id)).catch(() => null);
  if (!data) notFound();
  return <MagiaFichaBody data={data} />;
}
