"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/admin/taller/universo/personajes", label: "Personajes" },
  { href: "/admin/taller/universo/mapa", label: "Mapa de relaciones" },
  { href: "/admin/taller/universo/calendario", label: "Calendario" },
];

/** Pestañas de Universo (spec §10, §11, §13). */
export function UniversoTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border-base px-6">
      {PESTANAS.map((p) => {
        const activa = pathname.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            className={cn(
              "border-b-2 px-4 py-3 text-sm transition-colors",
              activa ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
