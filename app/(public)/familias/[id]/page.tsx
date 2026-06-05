import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { getFamiliaFicha, getVisibleIds } from "@/lib/queries/fichas";

export const revalidate = 3600;

export async function generateStaticParams() {
  const ids = await getVisibleIds("familias").catch(() => []);
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getFamiliaFicha(Number(id)).catch(() => null);
  if (!data) return { title: "Familia no encontrada" };
  return {
    title: data.familia.nombre,
    description: data.familia.subtitulo ?? undefined,
    openGraph: { title: data.familia.nombre, images: data.familia.imagenUrl ? [data.familia.imagenUrl] : undefined },
  };
}

export default async function FamiliaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getFamiliaFicha(Number(id)).catch(() => null);
  if (!data) notFound();
  const { familia, arbol, jerarquia } = data;

  // Agrupar el árbol por generación (layout genealógico simplificado).
  const generaciones = arbol.reduce<Record<number, typeof arbol>>((acc, m) => {
    const g = m.generacion ?? 0;
    (acc[g] ??= []).push(m);
    return acc;
  }, {});
  const gens = Object.keys(generaciones)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <FichaShell
      banner={familia.bannerUrl}
      imagen={familia.imagenUrl}
      titulo={familia.nombre}
      subtitulo={familia.subtitulo}
      nombre={familia.nombre}
      backHref="/familias"
      backLabel="Familias"
      badges={
        <>
          {familia.origen && <Badge tone="accent">{familia.origen}</Badge>}
          {familia.apellido && <Badge>Casa {familia.apellido}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Apellido", value: familia.apellido },
          { label: "Origen", value: familia.origen },
        ]}
      />
      <ProseFields
        fields={[
          { label: "Descripción", value: familia.descripcion },
          { label: "Historia", value: familia.historia },
          { label: "Poder económico", value: familia.poderEconomico },
          { label: "Poder político", value: familia.poderPolitico },
          { label: "Poder militar", value: familia.poderMilitar },
          { label: "Liderazgo", value: familia.liderazgo },
        ]}
      />

      {gens.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-4 font-display text-xl text-accent">Árbol genealógico</h2>
          <div className="space-y-6 overflow-x-auto">
            {gens.map((g) => (
              <div key={g}>
                <p className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Generación {g}</p>
                <div className="flex flex-wrap gap-3">
                  {generaciones[g].map((m) => {
                    const card = (
                      <div
                        className={`min-w-[140px] rounded-xl border p-3 ${
                          m.destacado ? "border-accent/50 bg-accent/5" : "border-border-base bg-surface/40"
                        }`}
                      >
                        <p className="text-sm font-medium text-fg">{m.nombre}</p>
                        {m.estado && <p className="text-xs text-fg-muted">{m.estado}</p>}
                      </div>
                    );
                    return m.personajeId ? (
                      <Link key={m.id} href={`/personajes/${m.personajeId}`} className="transition-transform hover:-translate-y-0.5">
                        {card}
                      </Link>
                    ) : (
                      <div key={m.id}>{card}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-fg-muted">
            * Vista genealógica simplificada. La arquitectura contempla React Flow para el árbol interactivo (§10.3).
          </p>
        </section>
      )}

      {jerarquia.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Jerarquía</h2>
          <div className="space-y-2">
            {jerarquia.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-xl border border-border-base bg-surface/40 p-3">
                <span className="text-sm text-fg">{j.personajeNombre ?? "—"}</span>
                <span className="text-xs text-accent">{j.tituloNobiliario ?? j.tituloFamilia}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </FichaShell>
  );
}
