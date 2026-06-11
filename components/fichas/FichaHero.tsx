import Link from "next/link";
import { EntityImage } from "@/components/media/EntityImage";
import { Icon } from "@/components/Icon";
import { FadeIn } from "@/components/motion/Motion";

export interface Miga {
  label: string;
  href?: string;
}

/**
 * Hero cinematográfico reutilizable (§ puntos 3-4) con migas de pan jerárquicas.
 * Server-friendly (sin estado). El acento tiñe el glow del banner.
 */
export function FichaHero({
  banner,
  imagen,
  titulo,
  subtitulo,
  kicker,
  badges,
  migas,
  accent = "rgba(139,123,255,0.25)",
}: {
  banner?: string | null;
  imagen?: string | null;
  titulo: string;
  subtitulo?: string | null;
  kicker?: string | null;
  badges?: React.ReactNode;
  migas: Miga[];
  accent?: string;
}) {
  return (
    <div className="relative">
      <div className="relative h-56 w-full overflow-hidden md:h-72">
        <EntityImage src={banner ?? imagen} alt={titulo} name={titulo} sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-void/20" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 50% 120%, ${accent}, transparent)` }} />
        <nav className="absolute left-4 top-4 flex flex-wrap items-center gap-1 text-xs text-fg-secondary">
          {migas.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <Icon name="ChevronRight" size={12} className="text-fg-muted" />}
              {m.href ? (
                <Link
                  href={m.href}
                  className="rounded-full border border-border-base bg-void/60 px-2.5 py-1 backdrop-blur hover:text-fg"
                >
                  {m.label}
                </Link>
              ) : (
                <span className="px-1 text-fg">{m.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-16 flex flex-col items-start gap-4 md:-mt-20 md:flex-row md:items-end">
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border-2 border-border-glow shadow-xl md:h-40 md:w-40">
            <EntityImage src={imagen} alt={titulo} name={titulo} sizes="160px" priority />
          </div>
          <FadeIn className="pb-2">
            {kicker && <p className="font-display text-sm uppercase tracking-[0.2em] text-primary-glow">{kicker}</p>}
            <h1 className="font-display text-3xl text-fg md:text-5xl">{titulo}</h1>
            {subtitulo && <p className="mt-1 text-fg-secondary">{subtitulo}</p>}
            {badges && <div className="mt-3 flex flex-wrap gap-2">{badges}</div>}
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

/** Cabecera de sección reutilizable con línea degradada. */
export function SectionHead({ icon, title, accent }: { icon: string; title: string; accent?: string }) {
  const color = accent ?? "var(--color-primary, #8b7bff)";
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg border" style={{ borderColor: `${color}66`, background: `${color}18`, color }}>
        <Icon name={icon} size={16} />
      </span>
      <h2 className="font-display text-2xl text-fg">{title}</h2>
      <span className="ml-2 h-px flex-1" style={{ background: `linear-gradient(to right, ${color}55, transparent)` }} />
    </div>
  );
}
