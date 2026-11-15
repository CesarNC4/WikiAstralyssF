"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/markdown/Markdown";
import { PERFIL_MAGICO, type CampoMagico } from "@/lib/glosarioMagico";
import { magiaVisual } from "@/lib/magia";
import { cn } from "@/lib/utils";

type Valores = Record<string, string | null | undefined>;

function norm(x: string) {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Columnas de la fila de datos cortos: tantas como datos, para que no quede una casilla vacía. */
const COLUMNAS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

const COLOR_BASE = "var(--color-primary, #8b7bff)";

/**
 * Perfil mágico del personaje con glosario en tooltip y enlaces a magia (§ punto 2).
 *
 * Los datos cortos (la magia, el nivel) van en una fila de casillas. Los de texto largo (Essentia,
 * Zenithra, Bendición…) ocupan todo el ancho, uno debajo de otro, y se leen como markdown, igual
 * que se escriben en el panel: en una casilla se estiraban hacia abajo y dejaban huecos al lado
 * (decisión del autor, 2026-11-15).
 */
export function PerfilMagico({ valores, magiaLinks }: { valores: Valores; magiaLinks: Record<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const campos = PERFIL_MAGICO.filter((c) => valores[c.key]);
  if (campos.length === 0) return null;
  const cortos = campos.filter((c) => !c.largo);
  const largos = campos.filter((c) => c.largo);

  const cabecera = (c: CampoMagico, icono: string, color: string) => (
    <div className="mb-1 flex items-center gap-1.5">
      <Icon name={icono} size={13} style={{ color }} />
      <span className="text-[11px] uppercase tracking-wider text-fg-muted">{c.label}</span>
      <button
        type="button"
        aria-label={`Qué es ${c.label}`}
        onClick={() => setOpen(open === c.key ? null : c.key)}
        // Pasar por encima solo con ratón: en el móvil, el toque abría al «entrar» y cerraba al
        // hacer clic en el mismo gesto, y el tooltip nunca se veía.
        onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(c.key)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((k) => (k === c.key ? null : k))}
        className="ml-auto grid h-4 w-4 place-items-center rounded-full border border-border-base text-[9px] text-fg-muted hover:text-fg"
      >
        i
      </button>
      {open === c.key && (
        <div className="absolute right-2 top-9 z-20 w-72 max-w-[calc(100%-1rem)] rounded-lg border border-border-glow bg-deep p-2.5 text-xs leading-relaxed text-fg-secondary shadow-xl">
          {c.glosa}
        </div>
      )}
    </div>
  );

  // Las líneas entre casillas son bordes y no huecos sobre un fondo, así la caja no necesita
  // `overflow-hidden` (recortaba el tooltip de la última fila).
  return (
    <div className="rounded-2xl border border-border-base bg-surface">
      {cortos.length > 0 && (
        <div className={cn("grid divide-y divide-border-base sm:divide-x sm:divide-y-0", COLUMNAS[cortos.length])}>
          {cortos.map((c) => {
            const value = String(valores[c.key]);
            const esMagia = c.key === "tipoMagiaPrincipal" || c.key === "magiaSecundaria";
            const linkId = esMagia ? magiaLinks[norm(value)] : undefined;
            const vis = esMagia ? magiaVisual({ tipo: value, subcategoria: value }) : null;
            const color = vis?.color ?? COLOR_BASE;
            return (
              <div key={c.key} className="relative px-4 py-3">
                {cabecera(c, vis?.icon ?? c.icon, color)}
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
              </div>
            );
          })}
        </div>
      )}

      {largos.map((c, i) => (
        <div key={c.key} className={cn("relative px-4 py-3", (cortos.length > 0 || i > 0) && "border-t border-border-base")}>
          {cabecera(c, c.icon, COLOR_BASE)}
          <Markdown
            source={String(valores[c.key])}
            className="text-sm leading-relaxed text-fg-secondary [&>:first-child]:mt-0 [&>:last-child]:mb-0"
          />
        </div>
      ))}
    </div>
  );
}
