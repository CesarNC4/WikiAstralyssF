import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { Comparador } from "@/components/alturas/Comparador";
import { getComparador } from "@/lib/queries/alturas";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Comparador de alturas",
  description: "Personajes, bestias y lords demonio de Astralys, uno al lado del otro y a escala real.",
};

export default async function AlturasPage() {
  const datos = await getComparador().catch((e) => {
    console.error("[alturas]", e);
    return null;
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
          <Icon name="Ruler" className="text-accent" size={22} />
        </span>
        <div>
          <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Comparador de alturas</h1>
          <p className="text-sm text-fg-muted">Personajes, bestias y demonios, uno al lado del otro y a escala real.</p>
        </div>
      </header>
      {datos && datos.figuras.length > 0 ? (
        <Comparador {...datos} />
      ) : (
        <p className="rounded-2xl border border-border-base bg-surface/30 p-8 text-center text-fg-muted">
          Todavía no hay nadie con altura publicada.
        </p>
      )}
    </div>
  );
}
