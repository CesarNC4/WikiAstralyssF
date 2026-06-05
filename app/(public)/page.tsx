import Link from "next/link";
import { Icon } from "@/components/Icon";
import { FadeIn } from "@/components/motion/Motion";
import { ENTITY_LIST } from "@/lib/entities";

export const revalidate = 3600; // ISR (§4)

export default function HomePage() {
  const sections = ENTITY_LIST.filter((e) => e.key !== "mapa" && e.key !== "timeline");

  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="mx-auto max-w-5xl px-4 py-20 text-center md:py-32">
          <FadeIn>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-glow bg-surface/60 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-fg-muted">
              <Icon name="Star" size={14} className="text-accent" />
              Wiki de fantasía
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="font-display text-5xl leading-tight text-gradient-cosmic md:text-7xl">
              Astralys
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-fg-secondary">
              El compendio del mundo de Astralys. Personajes, naciones, magia y las
              estrellas que tejen su historia.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/personajes"
                className="rounded-xl bg-primary px-6 py-3 font-medium text-void transition-transform hover:scale-105 hover:shadow-[var(--shadow-glow-primary)]"
              >
                Explorar personajes
              </Link>
              <Link
                href="/mapa"
                className="rounded-xl border border-border-glow bg-surface/60 px-6 py-3 font-medium text-fg transition-colors hover:border-primary"
              >
                Ver el mapa
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* SECCIONES */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <h2 className="mb-6 font-display text-2xl text-fg">Explora el mundo</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sections.map((e) => (
            <Link
              key={e.key}
              href={e.route}
              className="group flex flex-col gap-2 rounded-2xl border border-border-base bg-surface/40 p-4 transition-all hover:-translate-y-1 hover:border-border-glow hover:bg-surface"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-border-base bg-deep">
                <Icon name={e.icon} size={20} className={e.accent} />
              </span>
              <span className="font-display text-base text-fg">{e.plural}</span>
              <span className="text-xs text-fg-muted">{e.tagline}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
