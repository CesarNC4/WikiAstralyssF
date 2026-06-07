import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { Markdown } from "@/components/markdown/Markdown";
import { getSistemaMonetario } from "@/lib/queries/fichas";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Economía",
  description: "El sistema monetario de Astralys: monedas, denominaciones y su valor.",
};

export default async function Page() {
  const monedas = await getSistemaMonetario().catch(() => []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
          <Icon name="Coins" className="text-accent" size={22} />
        </span>
        <div>
          <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Economía</h1>
          <p className="text-sm text-fg-muted">El sistema monetario de Astralys.</p>
        </div>
      </header>

      {monedas.length === 0 ? (
        <p className="text-fg-muted">Aún no se ha registrado ninguna moneda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {monedas.map((m) => (
            <article key={m.id} className="flex gap-4 rounded-2xl border border-border-base bg-surface/40 p-4">
              {m.imagenUrl && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border-base">
                  <EntityImage src={m.imagenUrl} alt={m.nombre} name={m.nombre} sizes="64px" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="font-display text-lg text-fg">{m.nombre}</h2>
                {m.denominacion && <p className="text-xs uppercase tracking-wide text-fg-muted">{m.denominacion}</p>}
                {m.valorRelativo && (
                  <p className="mt-1 font-mono text-sm text-secondary">{m.valorRelativo}</p>
                )}
                {m.descripcion && (
                  <Markdown source={m.descripcion} className="mt-2 text-sm leading-relaxed text-fg-secondary" />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
