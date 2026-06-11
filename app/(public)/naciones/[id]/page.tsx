import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { MiniMapa, type MiniPin } from "@/components/viz/MiniMapa";
import { EntityImage } from "@/components/media/EntityImage";
import { Badge } from "@/components/entity/Badge";
import { Galeria } from "@/components/fichas/Galeria";
import { Icon } from "@/components/Icon";
import { getNacion, getPersonajesDeNacion, getNacionFacciones, getVisibleIds } from "@/lib/queries/fichas";
import { getNacionTerritorio } from "@/lib/queries/mapa";
import { getGaleria } from "@/lib/queries/galeria";
import { TIPOS_LOCACION, type TipoLocacionKey } from "@/lib/mapa";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("naciones").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const n = await getNacion(Number(id)).catch(() => null);
  if (!n) return { title: "Nación no encontrada" };
  return {
    title: n.nombre,
    description: n.subtitulo ?? undefined,
    openGraph: { title: n.nombre, images: n.imagenUrl ? [n.imagenUrl] : undefined },
  };
}

export default async function NacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = await getNacion(Number(id)).catch(() => null);
  if (!n) notFound();

  const [personajes, territorio, facciones, galeria] = await Promise.all([
    getPersonajesDeNacion(n.id).catch(() => []),
    getNacionTerritorio(n.id).catch(() => ({ regiones: [], locaciones: [] })),
    getNacionFacciones(n.id).catch(() => ({ organizaciones: [], razas: [] })),
    getGaleria("naciones", n.id).catch(() => []),
  ]);

  const color = n.color ?? "#7b5cff";
  const pins: MiniPin[] = territorio.locaciones
    .filter((l) => l.x != null && l.y != null)
    .map((l) => ({
      x: l.x as number,
      y: l.y as number,
      color: TIPOS_LOCACION[l.tipo as TipoLocacionKey]?.color,
      href: `/locaciones/${l.id}`,
      label: l.nombre,
    }));
  const regionesPoly = territorio.regiones
    .filter((r) => r.poligono && r.poligono.length >= 3)
    .map((r) => ({ points: r.poligono as [number, number][], color: r.color ?? undefined, href: `/regiones/${r.id}`, label: r.nombre }));
  const hasMapa = (n.poligono?.length ?? 0) >= 3 || pins.length > 0 || regionesPoly.length > 0;

  return (
    <div>
      <FichaHero
        banner={n.bannerUrl}
        imagen={n.imagenUrl}
        titulo={n.nombre}
        subtitulo={n.subtitulo}
        kicker="Nación"
        accent={`${color}40`}
        migas={[{ label: "Naciones", href: "/naciones" }, { label: n.nombre }]}
        badges={
          <>
            {n.elementoFundamental && <Badge tone="secondary">{n.elementoFundamental}</Badge>}
            {n.gobierno && <Badge>{n.gobierno}</Badge>}
            {n.capital && <Badge tone="accent">{n.capital}</Badge>}
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        {/* Identidad divina */}
        {(n.elementoFundamental || n.conceptoDivino || n.diosFundador) && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Elemento fundamental", value: n.elementoFundamental, icon: "Sparkles" },
              { label: "Concepto divino", value: n.conceptoDivino, icon: "Atom" },
              { label: "Dios fundador", value: n.diosFundador, icon: "Star" },
            ]
              .filter((c) => c.value)
              .map((c) => (
                <div key={c.label} className="rounded-2xl border p-4" style={{ borderColor: `${color}44`, background: `${color}12` }}>
                  <Icon name={c.icon} size={18} style={{ color }} />
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-fg-muted">{c.label}</p>
                  <p className="text-lg text-fg">{c.value}</p>
                </div>
              ))}
          </div>
        )}

        {/* Mapa de territorio */}
        {hasMapa && (
          <section>
            <SectionHead icon="Map" title="Territorio" accent={color} />
            <MiniMapa
              focusPoly={n.poligono ?? undefined}
              focusPoint={n.poligono?.length ? undefined : n.centroX != null && n.centroY != null ? [n.centroX, n.centroY] : undefined}
              polygons={[
                ...(n.poligono && n.poligono.length >= 3
                  ? [{ points: n.poligono as [number, number][], color, focus: true, label: n.nombre }]
                  : []),
                ...regionesPoly,
              ]}
              pins={pins}
              height={360}
            />
            <p className="mt-2 text-xs text-fg-muted">Haz clic en una región o locación para visitarla.</p>
          </section>
        )}

        {/* Datos */}
        <FieldGrid
          fields={[
            { label: "Capital", value: n.capital },
            { label: "Gobierno", value: n.gobierno },
            { label: "Idioma", value: n.idioma },
            { label: "Población", value: n.poblacion },
          ]}
        />

        {/* Prosa */}
        <div>
          <ProseFields
            fields={[
              { label: "Descripción", value: n.descripcion },
              { label: "Historia", value: n.historia },
              { label: "Estructura", value: n.estructura },
              { label: "Estado actual", value: n.estadoActual },
            ]}
          />
        </div>

        {/* Regiones */}
        {territorio.regiones.length > 0 && (
          <section>
            <SectionHead icon="MapPinned" title="Regiones" accent={color} />
            <div className="flex flex-wrap gap-3">
              {territorio.regiones.map((r) => (
                <Link key={r.id} href={`/regiones/${r.id}`} className="rounded-xl border border-border-base bg-surface/40 px-4 py-2 text-sm text-fg hover:border-border-glow">
                  {r.nombre}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Razas */}
        {facciones.razas.length > 0 && (
          <section>
            <SectionHead icon="Rabbit" title="Pueblos" accent={color} />
            <LinkGrid items={facciones.razas.map((r) => ({ id: r.id, nombre: r.nombre, img: r.imagenUrl, nota: r.tipo, href: `/razas/${r.id}` }))} />
          </section>
        )}

        {/* Organizaciones */}
        {facciones.organizaciones.length > 0 && (
          <section>
            <SectionHead icon="Building2" title="Organizaciones" accent={color} />
            <LinkGrid items={facciones.organizaciones.map((o) => ({ id: o.id, nombre: o.nombre, img: o.imagenUrl, nota: o.tipo, href: `/organizaciones/${o.id}` }))} />
          </section>
        )}

        {/* Personajes */}
        {personajes.length > 0 && (
          <section>
            <SectionHead icon="Users" title="Personajes" accent={color} />
            <LinkGrid items={personajes.map((p) => ({ id: p.id, nombre: p.nombre, img: p.imagenUrl, nota: p.tipo, href: `/personajes/${p.id}` }))} />
          </section>
        )}

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}

function LinkGrid({ items }: { items: { id: number; nombre: string; img: string | null; nota: string | null; href: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((i) => (
        <Link key={i.id} href={i.href} className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2 pr-4 hover:border-border-glow">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
            <EntityImage src={i.img} alt={i.nombre} name={i.nombre} sizes="36px" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">{i.nombre}</p>
            {i.nota && <p className="truncate text-xs text-fg-muted">{i.nota}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
