import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseFields } from "@/components/fichas/FichaShell";
import { MiniMapa, type MiniPoly } from "@/components/viz/MiniMapa";
import { Galeria } from "@/components/fichas/Galeria";
import { Icon } from "@/components/Icon";
import { getLocacionFicha, getVisibleLocacionIds } from "@/lib/queries/mapa";
import { getGaleria } from "@/lib/queries/galeria";
import { TIPOS_LOCACION, type TipoLocacionKey } from "@/lib/mapa";
import { Conexiones } from "@/components/fichas/Conexiones";

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
  const galeria = await getGaleria("locaciones", locacion.id).catch(() => []);

  const meta = TIPOS_LOCACION[locacion.tipo as TipoLocacionKey];
  const color = meta?.color ?? "#2dd4bf";
  const esBatalla = locacion.tipo === "batalla";

  const polygons: MiniPoly[] = [
    ...(region?.poligono && region.poligono.length >= 3
      ? [{ points: region.poligono as [number, number][], color: region.color ?? "#2dd4bf", href: `/regiones/${region.id}`, label: region.nombre }]
      : []),
    ...(nacion?.poligono && nacion.poligono.length >= 3
      ? [{ points: nacion.poligono as [number, number][], color: nacion.color ?? "#7b5cff", href: `/naciones/${nacion.id}`, label: nacion.nombre }]
      : []),
  ];
  const tienePunto = locacion.x != null && locacion.y != null;
  const hasMapa = tienePunto || polygons.length > 0;

  return (
    <div>
      <FichaHero
        banner={locacion.bannerUrl}
        imagen={locacion.imagenUrl}
        titulo={locacion.nombre}
        subtitulo={locacion.subtitulo}
        kicker={meta?.label ?? "Locación"}
        accent={`${color}40`}
        migas={[
          { label: "Naciones", href: "/naciones" },
          ...(nacion ? [{ label: nacion.nombre, href: `/naciones/${nacion.id}` }] : []),
          ...(region ? [{ label: region.nombre, href: `/regiones/${region.id}` }] : []),
          { label: locacion.nombre },
        ]}
        badges={
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs" style={{ borderColor: `${color}66`, background: `${color}1a`, color }}>
            <Icon name={meta?.icon ?? "Star"} size={13} /> {meta?.label}
          </span>
        }
      />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        {/* Evento de cronología destacado (locaciones de batalla) */}
        {evento && (
          <Link
            href="/timeline"
            className="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-border-glow"
            style={{ borderColor: `${color}55`, background: `${color}12` }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${color}22`, color }}>
              <Icon name={esBatalla ? "Flame" : "Clock"} size={20} />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-fg-muted">
                {esBatalla ? "Escenario de" : "Evento relacionado"}
              </p>
              <p className="text-fg">{evento.titulo}</p>
              {evento.fechaLore && <p className="text-xs text-fg-muted">{evento.fechaLore}</p>}
            </div>
            <Icon name="ArrowRight" size={16} className="ml-auto text-fg-muted" />
          </Link>
        )}

        {hasMapa && (
          <section>
            <SectionHead icon="MapPin" title="Ubicación" accent={color} />
            <MiniMapa
              focusPoint={tienePunto ? [locacion.x as number, locacion.y as number] : undefined}
              focusPoly={!tienePunto && region?.poligono ? (region.poligono as [number, number][]) : undefined}
              polygons={polygons}
              pins={tienePunto ? [{ x: locacion.x as number, y: locacion.y as number, color, label: locacion.nombre, big: true }] : []}
              height={320}
            />
          </section>
        )}

        <ProseFields fields={[{ label: "Descripción", value: locacion.descripcion }, { label: "Historia", value: locacion.historia }]} />

        {(region || nacion) && (
          <div className="flex flex-wrap gap-2 text-sm">
            {region && (
              <Link href={`/regiones/${region.id}`} className="rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-fg hover:border-border-glow">
                <Icon name="MapPinned" size={13} className="mr-1 inline" /> {region.nombre}
              </Link>
            )}
            {nacion && (
              <Link href={`/naciones/${nacion.id}`} className="rounded-xl border border-border-base bg-surface/40 px-3 py-2 text-fg hover:border-border-glow">
                <Icon name="Globe2" size={13} className="mr-1 inline" /> {nacion.nombre}
              </Link>
            )}
          </div>
        )}

        {/* Conexiones generadas desde el registro de relaciones. */}
        <Conexiones entidad="locaciones" id={data.locacion.id} nombre={data.locacion.nombre} imagen={data.locacion.imagenUrl} />

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}
