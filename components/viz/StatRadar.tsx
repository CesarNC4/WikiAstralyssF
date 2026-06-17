import { Icon } from "@/components/Icon";
import { clampStat, type StatGroup } from "@/lib/stats";

/**
 * Radar (gráfico de telaraña) SVG para un grupo de stats 0-100. Server-safe.
 * Pensado para el "poder" de naciones (5 ejes) pero sirve para cualquier grupo
 * de 3+ stats.
 */
export function StatRadar({
  group,
  row,
  size = 280,
}: {
  group: StatGroup;
  row: Record<string, unknown>;
  size?: number;
}) {
  const stats = group.stats.map((s) => ({ ...s, value: clampStat(row[s.key]) ?? 0 }));
  if (stats.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 44;
  const n = stats.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, radius: number) => [cx + radius * Math.cos(angle(i)), cy + radius * Math.sin(angle(i))] as const;

  const rings = [0.25, 0.5, 0.75, 1];
  const valuePts = stats.map((s, i) => point(i, (s.value / 100) * r));
  const valuePath = valuePts.map((p) => p.join(",")).join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Anillos */}
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={stats.map((_, i) => point(i, r * ring).join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-border-base"
            strokeWidth={1}
          />
        ))}
        {/* Ejes */}
        {stats.map((_, i) => {
          const [x, y] = point(i, r);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" className="text-border-base" strokeWidth={1} />;
        })}
        {/* Área de valores */}
        <polygon points={valuePath} fill={`${group.color}33`} stroke={group.color} strokeWidth={2} />
        {valuePts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={group.color} />
        ))}
        {/* Etiquetas */}
        {stats.map((s, i) => {
          const [x, y] = point(i, r + 22);
          return (
            <text
              key={s.key}
              x={x}
              y={y}
              textAnchor={Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-fg-muted text-[10px]"
            >
              {s.label} {s.value}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {stats.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1 text-xs text-fg-muted">
            <Icon name={s.icon} size={12} style={{ color: group.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
