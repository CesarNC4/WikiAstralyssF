import Link from "next/link";
import { EntityImage } from "@/components/media/EntityImage";
import { Icon } from "@/components/Icon";
import { FadeIn } from "@/components/motion/Motion";
import type { FichaField } from "@/lib/types";

/** Cabecera común de ficha (§5.2): banner + avatar + título + badges. */
export function FichaShell({
  banner,
  imagen,
  titulo,
  subtitulo,
  nombre,
  badges,
  backHref,
  backLabel,
  children,
}: {
  banner?: string | null;
  imagen?: string | null;
  titulo: string;
  subtitulo?: string | null;
  nombre?: string | null;
  badges?: React.ReactNode;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 w-full overflow-hidden md:h-72">
        <EntityImage src={banner ?? imagen} alt={titulo} name={nombre ?? titulo} sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-void/10" />
        <div className="absolute left-4 top-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-base bg-void/60 px-3 py-1.5 text-xs text-fg-secondary backdrop-blur hover:text-fg"
          >
            <Icon name="ChevronLeft" size={14} /> {backLabel}
          </Link>
        </div>
      </div>

      {/* Cabecera */}
      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-16 flex flex-col items-start gap-4 md:-mt-20 md:flex-row md:items-end">
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border-2 border-border-glow shadow-xl md:h-40 md:w-40">
            <EntityImage src={imagen} alt={titulo} name={nombre ?? titulo} sizes="160px" priority />
          </div>
          <FadeIn className="pb-2">
            <h1 className="font-display text-3xl text-fg md:text-5xl">{titulo}</h1>
            {subtitulo && <p className="mt-1 text-fg-secondary">{subtitulo}</p>}
            {badges && <div className="mt-3 flex flex-wrap gap-2">{badges}</div>}
          </FadeIn>
        </div>

        <div className="py-8">{children}</div>
      </div>
    </div>
  );
}

/** Bloque de prosa largo con título. */
export function ProseBlock({ title, children }: { title: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-display text-xl text-accent">{title}</h2>
      <div className="whitespace-pre-line leading-relaxed text-fg-secondary">{children}</div>
    </section>
  );
}

/** Lista de campos cortos (clave/valor) en grid. */
export function FieldGrid({ fields }: { fields: FichaField[] }) {
  const visibles = fields.filter((f) => f.value);
  if (visibles.length === 0) return null;
  return (
    <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border-base bg-border-base sm:grid-cols-3">
      {visibles.map((f) => (
        <div key={f.label} className="bg-surface px-4 py-3">
          <dt className="text-[11px] uppercase tracking-wider text-fg-muted">{f.label}</dt>
          <dd className="mt-0.5 text-sm text-fg">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Renderiza una lista de bloques de prosa a partir de FichaField[]. */
export function ProseFields({ fields }: { fields: FichaField[] }) {
  return (
    <>
      {fields
        .filter((f) => f.value)
        .map((f) => (
          <ProseBlock key={f.label} title={f.label}>
            {f.value}
          </ProseBlock>
        ))}
    </>
  );
}
