import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { EntityImage } from "@/components/media/EntityImage";
import { Badge } from "@/components/entity/Badge";
import { getNacion, getPersonajesDeNacion, getVisibleIds } from "@/lib/queries/fichas";
import { getRegionesDeNacion } from "@/lib/queries/mapa";

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
  const personajes = await getPersonajesDeNacion(n.id).catch(() => []);
  const regiones = await getRegionesDeNacion(n.id).catch(() => []);

  return (
    <FichaShell
      banner={n.bannerUrl}
      imagen={n.imagenUrl}
      titulo={n.nombre}
      subtitulo={n.subtitulo}
      nombre={n.nombre}
      backHref="/naciones"
      backLabel="Naciones"
      galeriaTipo="naciones"
      galeriaId={n.id}
      badges={
        <>
          {n.elementoFundamental && <Badge tone="secondary">{n.elementoFundamental}</Badge>}
          {n.gobierno && <Badge>{n.gobierno}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Capital", value: n.capital },
          { label: "Gobierno", value: n.gobierno },
          { label: "Idioma", value: n.idioma },
          { label: "Población", value: n.poblacion },
          { label: "Elemento", value: n.elementoFundamental },
          { label: "Concepto divino", value: n.conceptoDivino },
          { label: "Dios fundador", value: n.diosFundador },
        ]}
      />
      <ProseFields
        fields={[
          { label: "Descripción", value: n.descripcion },
          { label: "Historia", value: n.historia },
          { label: "Estructura", value: n.estructura },
          { label: "Estado actual", value: n.estadoActual },
        ]}
      />

      {regiones.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 font-display text-xl text-accent">Regiones</h2>
          <div className="flex flex-wrap gap-3">
            {regiones.map((r) => (
              <Link key={r.id} href={`/regiones/${r.id}`} className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2 pr-4 hover:border-border-glow">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                  <EntityImage src={r.imagenUrl} alt={r.nombre} name={r.nombre} sizes="36px" />
                </div>
                <div>
                  <p className="text-sm text-fg">{r.nombre}</p>
                  {r.subtitulo && <p className="text-xs text-fg-muted">{r.subtitulo}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {personajes.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 font-display text-xl text-accent">Personajes</h2>
          <div className="flex flex-wrap gap-3">
            {personajes.map((p) => (
              <Link key={p.id} href={`/personajes/${p.id}`} className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2 pr-4 hover:border-border-glow">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                  <EntityImage src={p.imagenUrl} alt={p.nombre} name={p.nombre} sizes="36px" />
                </div>
                <div>
                  <p className="text-sm text-fg">{p.nombre}</p>
                  {p.tipo && <p className="text-xs text-fg-muted">{p.tipo}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </FichaShell>
  );
}
