import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { SectionHead } from "@/components/fichas/FichaHero";
import { LinkGrid } from "@/components/fichas/LinkGrid";
import { SongList } from "@/components/fichas/SongList";
import { Badge } from "@/components/entity/Badge";
import { Icon } from "@/components/Icon";
import { Conexiones } from "@/components/fichas/Conexiones";
import { claves, textosFecha } from "@/lib/fechas";
import { FechaTexto, FijarMomento } from "@/components/fechas/Lectura";
import { getCalendario } from "@/lib/queries/fechas";
import { getCapitulo, getVisibleIds } from "@/lib/queries/fichas";
import { getCapituloDerivado, type CapituloDerivado } from "@/lib/queries/narrativa";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("capitulos").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getCapitulo(Number(id)).catch(() => null);
  if (!x) return { title: "Capítulo no encontrado" };
  return {
    title: `${x.numero} — ${x.titulo}`,
    description: x.descripcion ?? undefined,
    openGraph: { title: x.titulo },
  };
}

const VACIO: CapituloDerivado = { actos: [], personajes: [], lugares: [], canciones: [], fecha: null };
const RUTA_LUGAR = { naciones: "/naciones", regiones: "/regiones", locaciones: "/locaciones" } as const;

/**
 * Ficha pública de un capítulo (spec del taller §3): su intro y, debajo, los
 * resúmenes de sus actos publicados; los personajes, lugares, canciones y
 * fechas salen de esos actos.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getCapitulo(Number(id)).catch(() => null);
  if (!x) notFound();

  const [d, cal] = await Promise.all([
    getCapituloDerivado(x.id, { publico: true }).catch(() => VACIO),
    getCalendario().catch(() => null),
  ]);
  const fechas = d.fecha && cal ? textosFecha(cal, d.fecha) : null;
  // Las edades de los personajes se leen desde el inicio del capítulo (§13).
  const inicio = d.fecha && cal ? claves(cal, d.fecha).ini : null;
  const povs = d.personajes.filter((p) => p.pov).map((p) => p.nombre);

  return (
    <FichaShell
      banner={null}
      imagen={null}
      titulo={x.titulo}
      subtitulo={x.libro ? `${x.libro} · ${x.numero}` : x.numero}
      nombre={x.titulo}
      backHref="/capitulos"
      backLabel="Capítulos"
      galeriaTipo="capitulos"
      galeriaId={x.id}
      badges={
        <>
          {x.tipo && <Badge tone="accent">{x.tipo}</Badge>}
          {x.tipoTemporal && <Badge>{x.tipoTemporal}</Badge>}
          {x.narrador && <Badge tone="secondary">Narra {x.narrador}</Badge>}
          {povs.length > 0 && <Badge tone="secondary">POV: {povs.join(", ")}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Libro", value: x.libro },
          { label: "Tipo", value: x.tipo },
          { label: "Marco narrativo", value: x.marcoNarrativo },
          { label: "Narrador", value: x.narrador },
          { label: "Cuándo", value: fechas ? <FechaTexto t={fechas} /> : null },
          { label: "Actos", value: d.actos.length ? String(d.actos.length) : null },
        ]}
      />

      {inicio != null && <FijarMomento clave={inicio} origen={`al inicio de ${x.numero}`} />}

      {/* `notasPrivadas` no se muestra nunca: es material de autor. */}
      <ProseFields fields={[{ label: "Descripción", value: x.descripcion }]} />

      {d.actos.length > 0 && (
        <section className="mb-8">
          <SectionHead icon="BookOpen" title="Actos" />
          <ol className="space-y-3">
            {d.actos.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/capitulos/${x.id}/actos/${a.id}`}
                  className="block rounded-2xl border border-border-base bg-surface/40 p-4 transition-colors hover:border-border-glow"
                >
                  <p className="text-xs uppercase tracking-wider text-fg-muted">{a.etiqueta}</p>
                  <p className="font-display text-lg text-fg">{a.nombre}</p>
                  {a.resumen && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-fg-secondary">{a.resumen}</p>}
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-accent">
                    Leer el acto <Icon name="ArrowRight" size={12} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {d.personajes.length > 0 && (
        <section className="mb-8">
          <SectionHead icon="Users" title="Personajes" />
          <LinkGrid
            items={d.personajes.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              img: p.imagenUrl,
              nota: p.pov ? "POV" : null,
              href: `/personajes/${p.id}`,
            }))}
          />
        </section>
      )}

      {d.lugares.length > 0 && (
        <section className="mb-8">
          <SectionHead icon="MapPin" title="Lugares" />
          <LinkGrid
            items={d.lugares.map((l) => ({ id: l.id, nombre: l.nombre, img: null, href: `${RUTA_LUGAR[l.tipo]}/${l.id}` }))}
          />
        </section>
      )}

      <SongList tracks={d.canciones} />

      {x.discordUrl && (
        <a
          href={x.discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-glow px-4 py-2 text-sm text-fg-secondary hover:text-fg"
        >
          Leer en Discord <Icon name="ArrowRight" size={14} />
        </a>
      )}

      {/* Conexiones generadas desde el registro de relaciones. */}
      <Conexiones entidad="capitulos" id={x.id} nombre={x.titulo} />
    </FichaShell>
  );
}
