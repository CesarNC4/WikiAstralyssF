import type { Metadata } from "next";
import { AtlasLoader } from "@/components/atlas/AtlasLoader";
import { getAtlas } from "@/lib/queries/atlas";

// Herramienta interactiva: se renderiza bajo demanda (no se prerenderiza en build).
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Atlas de relaciones",
  description: "El grafo navegable de todo lo que se conecta en Astralys: personajes, naciones, pueblos, bestias, facciones y lugares.",
};

export default async function AtlasPage() {
  const { nodos, aristas, tipos } = await getAtlas().catch(() => ({ nodos: [], aristas: [], tipos: [] }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-primary-glow">Atlas</p>
        <h1 className="font-display text-3xl text-fg md:text-4xl">Grafo del mundo</h1>
        <p className="mt-1 text-fg-secondary">Cómo se conecta todo. Filtra por tipo para no perderte.</p>
      </header>
      {nodos.length > 0 ? (
        <AtlasLoader nodos={nodos} aristas={aristas} tipos={tipos} />
      ) : (
        <p className="rounded-2xl border border-border-base bg-surface/30 p-8 text-center text-fg-muted">
          Aún no hay suficientes entidades publicadas para tejer el atlas.
        </p>
      )}
    </div>
  );
}
