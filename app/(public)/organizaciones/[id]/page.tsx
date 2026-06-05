import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { EntityImage } from "@/components/media/EntityImage";
import { getOrganizacionFicha, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("organizaciones").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getOrganizacionFicha(Number(id)).catch(() => null);
  if (!data) return { title: "Organización no encontrada" };
  return {
    title: data.org.nombre,
    description: data.org.subtitulo ?? undefined,
    openGraph: { title: data.org.nombre, images: data.org.imagenUrl ? [data.org.imagenUrl] : undefined },
  };
}

export default async function OrganizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrganizacionFicha(Number(id)).catch(() => null);
  if (!data) notFound();
  const { org, jerarquia, facciones } = data;

  return (
    <FichaShell
      banner={org.bannerUrl}
      imagen={org.imagenUrl}
      titulo={org.nombre}
      subtitulo={org.subtitulo}
      nombre={org.nombre}
      backHref="/organizaciones"
      backLabel="Organizaciones"
      badges={
        <>
          {org.tipo && <Badge tone="accent">{org.tipo}</Badge>}
          {org.estado && <Badge>{org.estado}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Tipo", value: org.tipo },
          { label: "Sede", value: org.sede },
          { label: "Estado", value: org.estado },
        ]}
      />
      <ProseFields
        fields={[
          { label: "Descripción", value: org.descripcion },
          { label: "Objetivo", value: org.objetivo },
          { label: "Ideología", value: org.ideologia },
          { label: "Historia", value: org.historia },
          { label: "Fundación", value: org.fundacion },
          { label: "Liderazgo", value: org.liderazgo },
          { label: "Estructura interna", value: org.estructuraInterna },
        ]}
      />

      {facciones.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Facciones</h2>
          <div className="flex flex-wrap gap-2">
            {facciones.map((f) => (
              <span
                key={f.id}
                className="rounded-full border px-3 py-1 text-sm"
                style={f.color ? { borderColor: f.color, color: f.color } : undefined}
              >
                {f.nombre}
              </span>
            ))}
          </div>
        </section>
      )}

      {jerarquia.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Jerarquía</h2>
          <div className="space-y-2">
            {jerarquia.map((j) => (
              <div key={j.id} className="flex items-center gap-3 rounded-xl border border-border-base bg-surface/40 p-3">
                {j.personajeId ? (
                  <Link href={`/personajes/${j.personajeId}`} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                    <EntityImage src={j.personajeImg} alt={j.personajeNombre ?? ""} name={j.personajeNombre} sizes="44px" />
                  </Link>
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-deep text-fg-muted">?</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{j.personajeNombre ?? j.tituloApodo ?? "—"}</p>
                  {j.tituloApodo && j.personajeNombre && <p className="text-xs text-fg-muted">«{j.tituloApodo}»</p>}
                </div>
                {j.rango && <Badge tone="primary">{j.rango}</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}
    </FichaShell>
  );
}
