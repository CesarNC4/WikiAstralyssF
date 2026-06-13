import Link from "next/link";
import { Badge } from "@/components/entity/Badge";

interface Ability {
  idHabilidad: number;
  categoria: string;
  nombre: string | null;
  descripcion: string | null;
  tipo: string | null;
  href?: string | null;
}

/** Habilidades agrupadas por categoría (§5.1). */
export function AbilityList({ habilidades }: { habilidades: Ability[] }) {
  if (habilidades.length === 0) {
    return <p className="text-fg-muted">Sin habilidades registradas.</p>;
  }
  const groups = habilidades.reduce<Record<string, Ability[]>>((acc, h) => {
    (acc[h.categoria] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat}>
          <h3 className="mb-3 font-display text-lg text-secondary">{cat}</h3>
          <div className="space-y-3">
            {list.map((h) => (
              <div key={h.idHabilidad} className="rounded-xl border border-border-base bg-surface/40 p-4">
                <div className="mb-1 flex items-center gap-2">
                  {h.href ? (
                    <Link href={h.href} className="font-medium text-fg hover:text-primary-glow">
                      {h.nombre ?? "Habilidad"}
                    </Link>
                  ) : (
                    <span className="font-medium text-fg">{h.nombre ?? "Habilidad"}</span>
                  )}
                  {h.tipo && <Badge tone="secondary">{h.tipo}</Badge>}
                </div>
                {h.descripcion && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-fg-secondary">{h.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
