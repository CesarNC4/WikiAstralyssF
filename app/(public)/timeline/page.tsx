import type { Metadata } from "next";
import { TimelineEspiral } from "@/components/viz/TimelineEspiral";
import { getTimeline } from "@/lib/queries/extra";
import { Icon } from "@/components/Icon";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Cronología",
  description: "El túnel del tiempo de Astralys: recorre eras y eventos en una espiral viva e interactiva.",
};

export default async function TimelinePage() {
  const eventos = await getTimeline().catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
          <Icon name="Clock" className="text-secondary" size={22} />
        </span>
        <div>
          <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Cronología</h1>
          <p className="text-sm text-fg-muted">El túnel del tiempo de Astralys — arrástralo para recorrer las eras.</p>
        </div>
      </header>

      {eventos.length === 0 ? (
        <p className="text-fg-muted">No hay eventos en la cronología.</p>
      ) : (
        <TimelineEspiral eventos={eventos} />
      )}
    </div>
  );
}
