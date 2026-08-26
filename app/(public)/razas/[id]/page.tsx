import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RazaFichaBody } from "@/components/fichas/RazaFichaBody";
import { getRaza, getVisibleIds } from "@/lib/queries/fichas";
import { Conexiones } from "@/components/fichas/Conexiones";

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
    <>
      <RazaFichaBody raza={x} />
      {/* Conexiones generadas desde el registro de relaciones. */}
      <div className="mx-auto max-w-5xl space-y-12 px-4 pb-10">
        <Conexiones entidad="razas" id={x.id} nombre={x.nombre} imagen={x.imagenUrl} conGrafo={false} />
      </div>
    </>
  );
}
