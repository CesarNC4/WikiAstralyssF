import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgFichaBody } from "@/components/fichas/OrgFichaBody";
import { getOrganizacionFicha, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("organizaciones").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getOrganizacionFicha(Number(id)).catch(() => null);
  if (!data) return { title: "Organización no encontrada" };
  return {
    title: data.org.nombre,
    description: data.org.subtitulo ?? undefined,
    openGraph: { title: data.org.nombre, images: data.org.imagenUrl ? [data.org.imagenUrl] : undefined },
  };
}

export default async function OrganizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrganizacionFicha(Number(id)).catch(() => null);
  if (!data) notFound();
  return <OrgFichaBody org={data.org} jerarquia={data.jerarquia} facciones={data.facciones} historial={data.historial} vinculados={data.vinculados} />;
}
