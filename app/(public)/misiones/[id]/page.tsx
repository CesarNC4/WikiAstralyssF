import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getMision, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("misiones").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getMision(Number(id)).catch(() => null);
  if (!x) return { title: "Misión no encontrada" };
  return { title: x.nombre, description: x.descripcion ?? undefined, openGraph: { title: x.nombre } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getMision(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={null}
      imagen={null}
      titulo={x.nombre}
      subtitulo={x.tipo}
      nombre={x.nombre}
      backHref="/misiones"
      backLabel="Misiones"
      badges={<>{x.nivelRiesgo && <Badge tone="amenaza">Riesgo {x.nivelRiesgo}</Badge>}{x.estado && <Badge tone="accent">{x.estado}</Badge>}{x.tipo && <Badge>{x.tipo}</Badge>}</>}
    >
      <FieldGrid fields={[{ label: "Tipo", value: x.tipo }, { label: "Nivel de riesgo", value: x.nivelRiesgo }, { label: "Estado", value: x.estado }, { label: "Rango mínimo", value: x.rangoMinimo }, { label: "Ubicación", value: x.ubicacion }, { label: "Fecha", value: x.fechaLore }]} />
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }, { label: "Objetivo", value: x.objetivo }, { label: "Recompensa", value: x.recompensa }]} />
    </FichaShell>
  );
}
