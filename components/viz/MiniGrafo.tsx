import Link from "next/link";
import { EntityImage } from "@/components/media/EntityImage";
import { SectionHead } from "@/components/fichas/FichaHero";

export interface GrafoNodo {
  id: string;
  label: string;
  href?: string;
  img?: string | null;
}
export interface GrafoGrupo {
  label: string;
  color: string;
  nodos: GrafoNodo[];
}

/**
 * Mini-grafo radial de vecinos de una entidad. Server-safe: líneas en una capa
 * SVG y nodos como enlaces absolutos. Agrupa por tipo de relación (color).
 */
export function MiniGrafo({
  centro,
  grupos,
  accent = "#7b5cff",
  title = "Relaciones",
}: {
  centro: { label: string; img?: string | null };
  grupos: GrafoGrupo[];
  accent?: string;
  title?: string;
}) {
  const nodos = grupos.flatMap((g) => g.nodos.map((n) => ({ ...n, color: g.color })));
  if (nodos.length === 0) return null;

  const size = 100; // viewBox cuadrado (porcentual)
  const cx = 50;
  const cy = 50;
  const radio = nodos.length <= 4 ? 32 : 38;
  const pos = nodos.map((_, i) => {
    const a = (Math.PI * 2 * i) / nodos.length - Math.PI / 2;
    return { x: cx + radio * Math.cos(a), y: cy + radio * Math.sin(a) };
  });

  return (
    <section>
      <SectionHead icon="Network" title={title} accent={accent} />
      <div className="rounded-2xl border border-border-base bg-surface/30 p-4">
        <div className="relative mx-auto aspect-square w-full max-w-md">
          {/* Líneas */}
          <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full">
            {pos.map((p, i) => (
              <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={nodos[i].color} strokeOpacity={0.4} strokeWidth={0.5} />
            ))}
          </svg>
          {/* Nodo central */}
          <div
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: "50%", top: "50%" }}
          >
            <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 shadow-lg" style={{ borderColor: accent }}>
              <EntityImage src={centro.img ?? null} alt={centro.label} name={centro.label} sizes="56px" />
            </div>
            <span className="mt-1 max-w-[7rem] truncate text-center text-xs font-medium text-fg">{centro.label}</span>
          </div>
          {/* Nodos vecinos */}
          {nodos.map((n, i) => {
            const inner = (
              <div className="flex flex-col items-center">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border" style={{ borderColor: `${n.color}88` }}>
                  <EntityImage src={n.img ?? null} alt={n.label} name={n.label} sizes="40px" />
                </div>
                <span className="mt-0.5 max-w-[6rem] truncate text-center text-[10px] text-fg-secondary">{n.label}</span>
              </div>
            );
            return (
              <div
                key={n.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%` }}
              >
                {n.href ? (
                  <Link href={n.href} className="block transition-transform hover:scale-110">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
            );
          })}
        </div>
        {/* Leyenda */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {grupos
            .filter((g) => g.nodos.length > 0)
            .map((g) => (
              <span key={g.label} className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: g.color }} /> {g.label}
              </span>
            ))}
        </div>
      </div>
    </section>
  );
}
