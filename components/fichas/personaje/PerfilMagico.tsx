"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PERFIL_MAGICO } from "@/lib/glosarioMagico";
import { magiaVisual } from "@/lib/magia";

type Valores = Record<string, string | null | undefined>;

function norm(x: string) {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Perfil mágico del personaje con glosario en tooltip y enlaces a magia (§ punto 2). */
export function PerfilMagico({ valores, magiaLinks }: { valores: Valores; magiaLinks: Record<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const campos = PERFIL_MAGICO.filter((c) => valores[c.key]);
  if (campos.length === 0) return null;

  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-border-base bg-border-base sm:grid-cols-2 lg:grid-cols-4">
      {campos.map((c) => {
        const value = String(valores[c.key]);
        const esMagia = c.key === "tipoMagiaPrincipal" || c.key === "magiaSecundaria";
        const linkId = esMagia ? magiaLinks[norm(value)] : undefined;
        const vis = esMagia ? magiaVisual({ tipo: value, subcategoria: value }) : null;
        const color = vis?.color ?? "var(--color-primary, #8b7bff)";
        const isOpen = open === c.key;

        return (
          <div key={c.key} className="relative bg-surface px-4 py-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Icon name={vis?.icon ?? c.icon} size={13} style={{ color }} />
              <span className="text-[11px] uppercase tracking-wider text-fg-muted">{c.label}</span>
              <button
                type="button"
                aria-label={`Qué es ${c.label}`}
                onClick={() => setOpen(isOpen ? null : c.key)}
                onMouseEnter={() => setOpen(c.key)}
                onMouseLeave={() => setOpen((k) => (k === c.key ? null : k))}
                className="ml-auto grid h-4 w-4 place-items-center rounded-full border border-border-base text-[9px] text-fg-muted hover:text-fg"
              >
                i
              </button>
            </div>

            {linkId ? (
              <Link
                href={`/magia/${linkId}`}
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color }}
              >
                {value}
                <Icon name="ArrowRight" size={12} />
              </Link>
            ) : (
              <span className="text-sm text-fg">{value}</span>
            )}

            {isOpen && (
              <div className="absolute left-2 right-2 top-full z-20 mt-1 rounded-lg border border-border-glow bg-deep p-2.5 text-xs leading-relaxed text-fg-secondary shadow-xl">
                {c.glosa}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
