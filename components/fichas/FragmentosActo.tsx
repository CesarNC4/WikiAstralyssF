"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { FechaTexto } from "@/components/fechas/Lectura";
import type { FragmentoPublico } from "@/lib/queries/narrativa";
import { cn } from "@/lib/utils";

type Orden = "lectura" | "fecha";

/**
 * Fragmentos de un acto en su ficha pública (docs/fragmentos-y-musica.md §2.5):
 * quién cuenta cada tramo, cuándo pasa y cuánto salta el tiempo respecto al
 * anterior. El salto es lo que más aporta: deja ver que el POV de Aqua ocurre
 * tres días antes que el de Lloyd que se acaba de leer.
 */
export function FragmentosActo({ fragmentos }: { fragmentos: FragmentoPublico[] }) {
  const [orden, setOrden] = useState<Orden>("lectura");
  if (fragmentos.length === 0) return null;

  const conFecha = fragmentos.some((f) => f.clave != null);
  const lista =
    orden === "lectura"
      ? fragmentos
      : [...fragmentos].sort((a, b) => (a.clave ?? Infinity) - (b.clave ?? Infinity) || a.numero - b.numero);

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl text-accent">
          <Icon name="BookOpen" size={18} /> Fragmentos
        </h2>
        {conFecha && fragmentos.length > 1 && (
          <div role="group" aria-label="Orden de los fragmentos" className="inline-flex overflow-hidden rounded-full border border-border-base text-[11px]">
            {(
              [
                ["lectura", "Orden de lectura"],
                ["fecha", "Por fecha"],
              ] as const
            ).map(([o, label]) => (
              <button
                key={o}
                type="button"
                aria-pressed={orden === o}
                onClick={() => setOrden(o)}
                className={cn("px-3 py-1 transition-colors", orden === o ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ol className="divide-y divide-border-base overflow-hidden rounded-2xl border border-border-base">
        {lista.map((f) => {
          const salto = orden === "lectura" ? f.saltoLectura : f.saltoFecha;
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-3 bg-surface/40 px-4 py-3 sm:flex-nowrap">
              <span className="w-6 shrink-0 text-center font-mono text-xs text-fg-muted">{f.numero}</span>

              {f.pov ? (
                <Link href={`/personajes/${f.pov.id}`} className="flex min-w-0 shrink-0 items-center gap-2 hover:text-accent sm:w-40">
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border-base">
                    <EntityImage src={f.pov.imagenUrl} alt={f.pov.nombre} name={f.pov.nombre} sizes="32px" />
                  </span>
                  <span className="truncate text-sm text-fg">{f.pov.nombre}</span>
                </Link>
              ) : (
                <span className="hidden shrink-0 sm:block sm:w-40" />
              )}

              <span className="min-w-0 flex-1">
                {f.titulo && <span className="block truncate text-sm text-fg">{f.titulo}</span>}
                {(f.fecha || salto) && (
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                    {f.fecha && <FechaTexto t={f.fecha} />}
                    {salto && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border-base px-2 py-px text-[11px] text-fg-secondary">
                        <Icon name="Hourglass" size={10} /> {salto}
                      </span>
                    )}
                  </span>
                )}
              </span>

              {f.enlace && (
                <a
                  href={f.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-glow px-3 py-1 text-xs text-fg-secondary hover:text-fg"
                >
                  {/discord\.(com|gg)/i.test(f.enlace) ? "Leer en Discord" : "Leer"} <Icon name="ArrowRight" size={12} />
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
