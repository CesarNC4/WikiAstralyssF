import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseFields } from "@/components/fichas/FichaShell";
import { MiniMapa, type MiniPin, type MiniPoly } from "@/components/viz/MiniMapa";
import { EntityImage } from "@/components/media/EntityImage";
import { Galeria } from "@/components/fichas/Galeria";
import { Icon } from "@/components/Icon";
import { getRegionFicha, getVisibleRegionIds } from "@/lib/queries/mapa";
import { getGaleria } from "@/lib/queries/galeria";
import { TIPOS_LOCACION, type TipoLocacionKey } from "@/lib/mapa";
import { Conexiones } from "@/components/fichas/Conexiones";

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
  const galeria = await getGaleria("regiones", region.id).catch(() => []);

  const color = region.color ?? "#2dd4bf";
  const pins: MiniPin[] = locaciones
    .filter((l) => l.x != null && l.y != null)
    .map((l) => ({
      x: l.x as number,
      y: l.y as number,
      color: TIPOS_LOCACION[l.tipo as TipoLocacionKey]?.color,
      href: `/locaciones/${l.id}`,
      label: l.nombre,
    }));
  const polygons: MiniPoly[] = [
    ...(region.poligono && region.poligono.length >= 3
      ? [{ points: region.poligono as [number, number][], color, focus: true, label: region.nombre }]
      : []),
    ...(nacion?.poligono && nacion.poligono.length >= 3
      ? [{ points: nacion.poligono as [number, number][], color: nacion.color ?? "#7b5cff", href: `/naciones/${nacion.id}`, label: nacion.nombre }]
      : []),
  ];
  const hasMapa = polygons.length > 0 || pins.length > 0;

  return (
    <div>
      <FichaHero
        banner={region.bannerUrl}
        imagen={region.imagenUrl}
        titulo={region.nombre}
        subtitulo={region.subtitulo}
        kicker="Región"
        accent={`${color}40`}
        migas={[
          { label: "Naciones", href: "/naciones" },
          ...(nacion ? [{ label: nacion.nombre, href: `/naciones/${nacion.id}` }] : []),
          { label: region.nombre },
        ]}
      />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        {hasMapa && (
          <section>
            <SectionHead icon="Map" title="Ubicación" accent={color} />
            <MiniMapa focusPoly={region.poligono ?? undefined} polygons={polygons} pins={pins} height={340} />
          </section>
        )}

        <ProseFields fields={[{ label: "Descripción", value: region.descripcion }, { label: "Historia", value: region.historia }]} />

        {locaciones.length > 0 && (
          <section>
            <SectionHead icon="MapPin" title="Locaciones" accent={color} />
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

        {/* Conexiones generadas desde el registro de relaciones. */}
        <Conexiones entidad="regiones" id={data.region.id} nombre={data.region.nombre} imagen={data.region.imagenUrl} />

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}
