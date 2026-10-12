import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { SongList } from "@/components/fichas/SongList";
import { Badge } from "@/components/entity/Badge";
import { Icon } from "@/components/Icon";
import { Conexiones } from "@/components/fichas/Conexiones";
import { formatoFecha } from "@/lib/fechas";
import { getCalendario, leerFecha } from "@/lib/queries/fechas";
import { getActoPublico, getActosVisibles } from "@/lib/queries/fichas";
import { getCancionesDeActo, getCapituloDerivado } from "@/lib/queries/narrativa";

export const revalidate = 3600;

export async function generateStaticParams() {
  const pares = await getActosVisibles().catch(() => []);
  return pares.map((p) => ({ id: String(p.capituloId), actoId: String(p.actoId) }));
}

type Params = Promise<{ id: string; actoId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, actoId } = await params;
  const x = await getActoPublico(Number(id), Number(actoId)).catch(() => null);
  if (!x) return { title: "Acto no encontrado" };
  return {
    title: `${x.acto.nombre} · ${x.capitulo.titulo}`,
    description: x.acto.descripcion ?? undefined,
    openGraph: { title: x.acto.nombre },
  };
}

/**
 * Ficha pública de un acto (spec del taller §4): resumen, fechas, POV,
 * personajes, lugares y arcos. Solo existe si el acto y su capítulo están
 * publicados.
 */
export default async function ActoPage({ params }: { params: Params }) {
  const { id, actoId } = await params;
  const x = await getActoPublico(Number(id), Number(actoId)).catch(() => null);
  if (!x) notFound();
  const { acto, capitulo } = x;

  const [hermanos, fecha, cal, canciones] = await Promise.all([
    getCapituloDerivado(capitulo.id, { publico: true }).then((d) => d.actos).catch(() => []),
    leerFecha({ entidadTipo: "actos", entidadId: acto.id, rol: "principal" }).catch(() => null),
    getCalendario().catch(() => null),
    getCancionesDeActo(acto.id).catch(() => []),
  ]);

  const i = hermanos.findIndex((a) => a.id === acto.id);
  const yo = hermanos[i];
  const anterior = i > 0 ? hermanos[i - 1] : null;
  const siguiente = i >= 0 && i < hermanos.length - 1 ? hermanos[i + 1] : null;
  const cuando = fecha && cal ? formatoFecha(cal, fecha.fecha, "eras") : null;

  return (
    <FichaShell
      banner={null}
      imagen={null}
      titulo={acto.nombre}
      subtitulo={`${yo?.etiqueta ?? "Acto"} · ${capitulo.numero} — ${capitulo.titulo}`}
      nombre={acto.nombre}
      backHref={`/capitulos/${capitulo.id}`}
      backLabel={capitulo.titulo}
      badges={
        <>
          {yo && <Badge tone="accent">{yo.etiqueta}</Badge>}
          {capitulo.libro && <Badge>{capitulo.libro}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Capítulo", value: `${capitulo.numero} — ${capitulo.titulo}` },
          { label: "Cuándo", value: cuando },
        ]}
      />

      <ProseFields fields={[{ label: "Resumen", value: acto.descripcion }]} />

      <SongList tracks={canciones} />

      {acto.discordUrl && (
        <a
          href={acto.discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-glow px-4 py-2 text-sm text-fg-secondary hover:text-fg"
        >
          Leer en Discord <Icon name="ArrowRight" size={14} />
        </a>
      )}

      {/* POV, personajes, lugares, arcos… salen del registro de relaciones. */}
      <Conexiones entidad="actos" id={acto.id} nombre={acto.nombre} />

      {(anterior || siguiente) && (
        <nav className="mt-10 grid grid-cols-2 gap-3">
          {anterior ? (
            <Link href={`/capitulos/${capitulo.id}/actos/${anterior.id}`} className="rounded-2xl border border-border-base bg-surface/40 p-4 hover:border-border-glow">
              <p className="flex items-center gap-1 text-xs text-fg-muted">
                <Icon name="ChevronLeft" size={12} /> {anterior.etiqueta}
              </p>
              <p className="truncate text-sm text-fg">{anterior.nombre}</p>
            </Link>
          ) : (
            <span />
          )}
          {siguiente && (
            <Link href={`/capitulos/${capitulo.id}/actos/${siguiente.id}`} className="rounded-2xl border border-border-base bg-surface/40 p-4 text-right hover:border-border-glow">
              <p className="flex items-center justify-end gap-1 text-xs text-fg-muted">
                {siguiente.etiqueta} <Icon name="ChevronRight" size={12} />
              </p>
              <p className="truncate text-sm text-fg">{siguiente.nombre}</p>
            </Link>
          )}
        </nav>
      )}
    </FichaShell>
  );
}
