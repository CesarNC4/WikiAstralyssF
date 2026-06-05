import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, ProseBlock } from "@/components/fichas/FichaShell";
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
  const { pagina: p, secciones } = data;

  return (
    <FichaShell
      banner={p.bannerUrl}
      imagen={p.imagenUrl}
      titulo={p.titulo ?? slug}
      subtitulo={p.subtitulo}
      nombre={p.titulo ?? slug}
      backHref="/lore"
      backLabel="Lore"
    >
      {p.introduccion && (
        <p className="mb-8 border-l-2 border-primary pl-4 text-lg italic leading-relaxed text-fg-secondary">
          {p.introduccion}
        </p>
      )}
      {secciones.map((sec) => (
        <ProseBlock key={sec.id} title={sec.titulo ?? "Sección"}>
          {sec.contenido}
        </ProseBlock>
      ))}
    </FichaShell>
  );
}
