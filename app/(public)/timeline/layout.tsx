import { Icon } from "@/components/Icon";
import { PestanasCronologia } from "@/components/cronologia/PestanasCronologia";

export default function CronologiaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
          <Icon name="Clock" className="text-secondary" size={22} />
        </span>
        <div>
          <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Cronología</h1>
          <p className="text-sm text-fg-muted">Los eventos de Astralys y todo lo que tiene fecha en sus fichas.</p>
        </div>
      </header>
      <PestanasCronologia />
      {children}
    </div>
  );
}
