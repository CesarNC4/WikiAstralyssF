import type { Metadata } from "next";
import { CompendioClient } from "@/components/compendio/CompendioClient";
import { getCompendio } from "@/lib/queries/compendio";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Compendio",
  description: "Compara bestias, minerales, razas y naciones por sus atributos y stats.",
};

export default async function CompendioPage() {
  const data = await getCompendio().catch(() => ({ bestias: [], minerales: [], razas: [], naciones: [] }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-primary-glow">Compendio</p>
        <h1 className="font-display text-3xl text-fg md:text-4xl">Comparador del mundo</h1>
        <p className="mt-1 text-fg-secondary">Ordena y filtra por cualquier atributo o stat. Pulsa una columna para ordenar.</p>
      </header>
      <CompendioClient data={data} />
    </div>
  );
}
