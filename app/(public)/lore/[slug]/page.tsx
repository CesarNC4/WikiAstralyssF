import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LorePageBody } from "@/components/fichas/LorePageBody";
import { getPaginaLore, getPaginaLoreConSecciones, getLoreSlugs } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getLoreSlugs().catch(() => []);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPaginaLore(slug).catch(() => null);
  if (!p) return { title: "Página no encontrada" };
  return {
    title: p.titulo ?? slug,
    description: p.subtitulo ?? undefined,
    openGraph: { title: p.titulo ?? slug, images: p.imagenUrl ? [p.imagenUrl] : undefined },
  };
}

export default async function LorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPaginaLoreConSecciones(slug).catch(() => null);
  if (!data) notFound();
  return <LorePageBody pagina={data.pagina} secciones={data.secciones} />;
}
