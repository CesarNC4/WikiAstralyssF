import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getLordDemonio, getVisibleIds } from "@/lib/queries/fichas";
import { Conexiones } from "@/components/fichas/Conexiones";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("demonios").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getLordDemonio(Number(id)).catch(() => null);
  if (!x) return { title: "Lord demonio no encontrado" };
  return { title: x.nombre, description: x.titulo ?? undefined, openGraph: { title: x.nombre, images: x.imagenUrl ? [x.imagenUrl] : undefined } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getLordDemonio(Number(id)).catch(() => null);
  if (!x) notFound();

  return (
    <FichaShell
      banner={x.bannerUrl}
      imagen={x.imagenUrl}
      titulo={x.nombre}
      subtitulo={x.titulo}
      nombre={x.nombre}
      backHref="/demonios"
      backLabel="Lords Demonio"
      galeriaTipo="demonios"
      galeriaId={x.id}
      badges={
        <>
          {x.dominio && <Badge tone="amenaza">{x.dominio}</Badge>}
          {x.estado && <Badge>{x.estado}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Dominio", value: x.dominio },
          { label: "Era de aparición", value: x.eraAparicion },
          { label: "Estado", value: x.estado },
          { label: "Derrotado por", value: x.derrotadoPor },
        ]}
      />
      <ProseFields
        fields={[
          { label: "Descripción física", value: x.descripcionFisica },
          { label: "Devil Trigger", value: x.devilTrigger },
          { label: "Historia", value: x.historia },
          { label: "Poder especial", value: x.poderEspecial },
        ]}
      />
      {/* Conexiones generadas desde el registro de relaciones. */}
      <Conexiones entidad="demonios" id={x.id} nombre={x.nombre} imagen={x.imagenUrl} />
    </FichaShell>
  );
}
