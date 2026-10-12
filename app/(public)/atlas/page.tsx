import type { Metadata } from "next";
import { Atlas } from "@/components/atlas/Atlas";
import { getMapaRelaciones } from "@/lib/queries/mapaRelaciones";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Atlas de relaciones",
  description: "El mapa navegable de todo lo que se conecta en Astralys: personajes, naciones, pueblos, bestias, facciones y lugares.",
};

/** Atlas público (spec §11): 3D en escritorio, 2D en móvil. */
export default async function AtlasPage() {
  const datos = await getMapaRelaciones({ publico: true }).catch((e) => {
    console.error("[atlas]", e);
    return null;
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-6">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-primary-glow">Atlas</p>
        <h1 className="font-display text-3xl text-fg md:text-4xl">El mundo conectado</h1>
        <p className="mt-1 text-fg-secondary">Cada esfera es una ficha y cada línea, una relación. Pulsa una para ver con quién se une.</p>
      </header>
      {datos && datos.nodos.length > 0 ? (
        <Atlas {...datos} />
      ) : (
        <p className="rounded-2xl border border-border-base bg-surface/30 p-8 text-center text-fg-muted">
          Aún no hay suficientes fichas conectadas para tejer el atlas.
        </p>
      )}
    </div>
  );
}
