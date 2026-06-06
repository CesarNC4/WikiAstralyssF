import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonajeFichaBody } from "@/components/fichas/PersonajeFichaBody";
import { getPersonajeFicha, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("personajes").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getPersonajeFicha(Number(id)).catch(() => null);
  if (!p) return { title: "Personaje no encontrado" };
  const nombre = [p.nombre, p.surname].filter(Boolean).join(" ");
  return {
    title: nombre,
    description: p.subtitulo ?? p.titulo ?? undefined,
    openGraph: {
      title: nombre,
      description: p.subtitulo ?? p.titulo ?? undefined,
      images: p.imagenUrl ? [p.imagenUrl] : undefined,
    },
  };
}

export default async function PersonajePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getPersonajeFicha(Number(id)).catch(() => null);
  if (!p) notFound();
  return <PersonajeFichaBody p={p} />;
}
