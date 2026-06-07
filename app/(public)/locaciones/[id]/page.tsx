import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getLocacionFicha, getVisibleLocacionIds } from "@/lib/queries/mapa";
import { TIPOS_LOCACION, type TipoLocacionKey } from "@/lib/mapa";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleLocacionIds().catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getLocacionFicha(Number(id)).catch(() => null);
  if (!data) return { title: "Locación no encontrada" };
  return { title: data.locacion.nombre, description: data.locacion.subtitulo ?? undefined };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getLocacionFicha(Number(id)).catch(() => null);
  if (!data) notFound();
  const { locacion, region, nacion, evento } = data;
  const meta = TIPOS_LOCACION[locacion.tipo as TipoLocacionKey];

  return (
    <FichaShell
      banner={locacion.bannerUrl ?? locacion.imagenUrl}
      imagen={locacion.imagenUrl}
      titulo={locacion.nombre}
      subtitulo={locacion.subtitulo}
      nombre={locacion.nombre}
      backHref="/mapa"
      backLabel="Mapa"
      galeriaTipo="locaciones"
      galeriaId={locacion.id}
      badges={<>{meta && <Badge tone="secondary">{meta.label}</Badge>}</>}
    >
      <FieldGrid
        fields={[
          { label: "Tipo", value: meta?.label },
          { label: "Región", value: region?.nombre },
          { label: "Nación", value: nacion?.nombre },
        ]}
      />
      {(region || nacion) && (
        <p className="-mt-4 mb-6 text-sm text-fg-muted">
          {region && (
            <>
              En <Link href={`/regiones/${region.id}`} className="text-secondary hover:underline">{region.nombre}</Link>
            </>
          )}
          {region && nacion && " · "}
          {nacion && (
            <Link href={`/naciones/${nacion.id}`} className="text-secondary hover:underline">{nacion.nombre}</Link>
          )}
        </p>
      )}

      <ProseFields fields={[{ label: "Descripción", value: locacion.descripcion }, { label: "Historia", value: locacion.historia }]} />

      {evento && (
        <section className="mt-2">
          <h2 className="mb-3 font-display text-xl text-accent">Evento relacionado</h2>
          <Link href="/timeline" className="inline-flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-sm text-fg hover:border-border-glow">
            <span className="text-accent">◆</span>
            <span>{evento.titulo}</span>
            {evento.fechaLore && <span className="text-fg-muted">· {evento.fechaLore}</span>}
          </Link>
        </section>
      )}
    </FichaShell>
  );
}
