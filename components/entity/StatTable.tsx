import { cn } from "@/lib/utils";

interface StatRow {
  label: string;
  value: number | null;
  max?: number;
}

/** Tabla de stats: barras en móvil/desktop con fuente mono para números (§5.1). */
export function StatTable({
  title,
  rows,
  max = 100,
}: {
  title?: string;
  rows: StatRow[];
  max?: number;
}) {
  const visibles = rows.filter((r) => r.value !== null && r.value !== undefined);
  if (visibles.length === 0) return null;

  return (
    <div className="mb-6">
      {title && <h3 className="mb-3 font-display text-lg text-fg">{title}</h3>}
      <div className="space-y-2.5">
        {visibles.map((r) => {
          const pct = Math.min(100, Math.round(((r.value ?? 0) / (r.max ?? max)) * 100));
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-fg-secondary">{r.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-deep">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-primary to-primary-glow",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-sm text-fg">{r.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Lista de valores cualitativos (rangos de combate tipo S/A/B...). */
export function RatingGrid({ items }: { items: { label: string; value: string | null }[] }) {
  const visibles = items.filter((i) => i.value);
  if (visibles.length === 0) return null;
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {visibles.map((i) => (
        <div key={i.label} className="rounded-xl border border-border-base bg-surface px-3 py-2 text-center">
          <p className="text-[11px] uppercase tracking-wide text-fg-muted">{i.label}</p>
          <p className="font-mono text-lg text-accent">{i.value}</p>
        </div>
      ))}
    </div>
  );
}
