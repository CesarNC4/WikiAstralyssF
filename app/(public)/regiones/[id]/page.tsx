import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { getRegionFicha, getVisibleRegionIds } from "@/lib/queries/mapa";
import { TIPOS_LOCACION, type TipoLocacionKey } from "@/lib/mapa";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleRegionIds().catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getRegionFicha(Number(id)).catch(() => null);
  if (!data) return { title: "Región no encontrada" };
  return { title: data.region.nombre, description: data.region.subtitulo ?? undefined };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRegionFicha(Number(id)).catch(() => null);
  if (!data) notFound();
  const { region, nacion, locaciones } = data;

  return (
    <FichaShell
      banner={region.bannerUrl ?? region.imagenUrl}
      imagen={region.imagenUrl}
      titulo={region.nombre}
      subtitulo={region.subtitulo}
      nombre={region.nombre}
      backHref="/mapa"
      backLabel="Mapa"
      galeriaTipo="regiones"
      galeriaId={region.id}
    >
      <FieldGrid
        fields={[
          { label: "Nación", value: nacion?.nombre },
          { label: "Locaciones", value: locaciones.length ? String(locaciones.length) : null },
        ]}
      />
      {nacion && (
        <p className="-mt-4 mb-6 text-sm text-fg-muted">
          Pertenece a{" "}
          <Link href={`/naciones/${nacion.id}`} className="text-secondary hover:underline">{nacion.nombre}</Link>
        </p>
      )}

      <ProseFields fields={[{ label: "Descripción", value: region.descripcion }, { label: "Historia", value: region.historia }]} />

      {locaciones.length > 0 && (
        <section className="mt-2">
          <h2 className="mb-3 font-display text-xl text-accent">Locaciones</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {locaciones.map((l) => {
              const meta = TIPOS_LOCACION[l.tipo as TipoLocacionKey];
              return (
                <Link key={l.id} href={`/locaciones/${l.id}`} className="flex items-center gap-3 rounded-xl border border-border-base bg-surface/40 p-3 hover:border-border-glow">
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                    <EntityImage src={l.imagenUrl} alt={l.nombre} name={l.nombre} sizes="44px" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-fg">{l.nombre}</span>
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: meta?.color }}>
                      <Icon name={meta?.icon ?? "Star"} size={12} /> {meta?.label}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </FichaShell>
  );
}
