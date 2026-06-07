import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamiliaFichaBody } from "@/components/fichas/FamiliaFichaBody";
import { getFamiliaFicha, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("familias").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getFamiliaFicha(Number(id)).catch(() => null);
  if (!data) return { title: "Familia no encontrada" };
  return {
    title: data.familia.nombre,
    description: data.familia.subtitulo ?? undefined,
    openGraph: { title: data.familia.nombre, images: data.familia.imagenUrl ? [data.familia.imagenUrl] : undefined },
  };
}

export default async function FamiliaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getFamiliaFicha(Number(id)).catch(() => null);
  if (!data) notFound();
  return <FamiliaFichaBody familia={data.familia} arbol={data.arbol} jerarquia={data.jerarquia} facciones={data.facciones} />;
}
