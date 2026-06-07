import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GremioFichaBody } from "@/components/fichas/GremioFichaBody";
import { getGremioFicha } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getGremioFicha().catch(() => null);
  if (!data) return { title: "Gremio" };
  return {
    title: data.gremio.nombre,
    description: data.gremio.subtitulo ?? data.gremio.lema ?? undefined,
    openGraph: { title: data.gremio.nombre, images: data.gremio.imagenUrl ? [data.gremio.imagenUrl] : undefined },
  };
}

export default async function GremioPage() {
  const data = await getGremioFicha().catch(() => null);
  if (!data) notFound();
  return (
    <GremioFichaBody
      gremio={data.gremio}
      rangos={data.rangos}
      facciones={data.facciones}
      jerarquia={data.jerarquia}
      historial={data.historial}
    />
  );
}
