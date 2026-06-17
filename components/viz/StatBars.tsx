import { Icon } from "@/components/Icon";
import { STATS_POR_ENTIDAD, clampStat, type StatGroup } from "@/lib/stats";

/** Una barra horizontal 0-100 con icono, etiqueta y valor. */
function Bar({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon name={icon} size={15} className="shrink-0" style={{ color }} />
      <span className="w-32 shrink-0 truncate text-sm text-fg-secondary">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-xs text-fg">{value}</span>
    </div>
  );
}

/** Render de un grupo de stats con su título. */
export function StatBarGroup({ group, row }: { group: StatGroup; row: Record<string, unknown> }) {
  const filas = group.stats
    .map((s) => ({ ...s, value: clampStat(row[s.key]) }))
    .filter((s): s is typeof s & { value: number } => s.value != null);
  if (filas.length === 0) return null;
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: `${group.color}33`, background: `${group.color}0a` }}>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider" style={{ color: group.color }}>
        {group.titulo}
      </p>
      <div className="space-y-2.5">
        {filas.map((s) => (
          <Bar key={s.key} icon={s.icon} label={s.label} value={s.value} color={group.color} />
        ))}
      </div>
    </div>
  );
}

/** Render de todos los grupos de stats de una entidad para una fila. */
export function StatBars({ entidad, row }: { entidad: string; row: Record<string, unknown> }) {
  const groups = STATS_POR_ENTIDAD[entidad] ?? [];
  const visibles = groups.filter((g) => g.stats.some((s) => clampStat(row[s.key]) != null));
  if (visibles.length === 0) return null;
  return (
    <div className={visibles.length > 1 ? "grid gap-4 sm:grid-cols-2" : ""}>
      {visibles.map((g) => (
        <StatBarGroup key={g.titulo} group={g} row={row} />
      ))}
    </div>
  );
}
