import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid } from "@/components/fichas/FichaShell";
import { SectionHead } from "@/components/fichas/FichaHero";
import { Badge } from "@/components/entity/Badge";
import { Icon } from "@/components/Icon";
import { Conexiones } from "@/components/fichas/Conexiones";
import { BotonReproducir } from "@/components/musica/BotonReproducir";
import { formatoDuracion, fuenteDe, NOMBRE_FUENTE } from "@/lib/media/fuentes";
import { getCancionPublica } from "@/lib/queries/canciones";
import { getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("canciones").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const x = await getCancionPublica(Number(id)).catch(() => null);
  if (!x) return { title: "Canción no encontrada" };
  return { title: x.titulo, description: x.artista ?? undefined, openGraph: { title: x.titulo } };
}

/**
 * Ficha de una canción (docs/fragmentos-y-musica.md §3.7): portada, botón de
 * reproducir, letra, los momentos exactos en que suena (fragmentos de un acto)
 * y, con los bloques del registro, el resto de sitios donde suena.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await getCancionPublica(Number(id)).catch(() => null);
  if (!x) notFound();
  const { momentos, uso, ...track } = x;
  const fuente = fuenteDe(track.tipoFuente, track.url);

  return (
    <FichaShell
      banner={null}
      imagen={track.imagenUrl}
      titulo={track.titulo}
      subtitulo={track.artista}
      nombre={track.titulo}
      backHref="/canciones"
      backLabel="Música"
      badges={
        <>
          {uso && <Badge tone="accent">{uso}</Badge>}
          {fuente && <Badge>{NOMBRE_FUENTE[fuente]}</Badge>}
        </>
      }
    >
      <BotonReproducir track={track} />

      <FieldGrid
        fields={[
          { label: "Artista", value: track.artista },
          { label: "Uso", value: uso },
          { label: "Duración", value: formatoDuracion(track.duracion) },
        ]}
      />

      {track.letra && (
        <section className="mb-8">
          <SectionHead icon="ScrollText" title="Letra" />
          <p className="whitespace-pre-line rounded-2xl border border-border-base bg-surface/40 p-5 text-sm leading-relaxed text-fg-secondary">
            {track.letra}
          </p>
        </section>
      )}

      {momentos.length > 0 && (
        <section className="mb-8">
          <SectionHead icon="Hourglass" title="Momentos en que suena" />
          <ul className="divide-y divide-border-base overflow-hidden rounded-2xl border border-border-base">
            {momentos.map((m) => (
              <li key={m.fragmentoId}>
                <Link
                  href={`/capitulos/${m.capitulo.id}/actos/${m.acto.id}`}
                  className="flex items-center gap-3 bg-surface/40 px-4 py-3 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      {m.acto.nombre}
                      <span className="text-fg-muted">
                        {" "}
                        · fragmento {m.numero}
                        {m.titulo && ` «${m.titulo}»`}
                        {m.pov && ` · ${m.pov}`}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-fg-muted">
                      {m.capitulo.numero} — {m.capitulo.titulo}
                    </span>
                    {m.nota && <span className="mt-0.5 block text-xs italic text-fg-secondary">{m.nota}</span>}
                  </span>
                  <Icon name="ChevronRight" size={16} className="shrink-0 text-fg-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dónde suena: personajes, capítulos, actos, naciones, lugares, eventos… */}
      <Conexiones entidad="canciones" id={track.id} nombre={track.titulo} imagen={track.imagenUrl} />
    </FichaShell>
  );
}
