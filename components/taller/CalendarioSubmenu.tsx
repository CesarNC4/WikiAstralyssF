"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const VISTAS = [
  { href: "/admin/taller/universo/calendario", label: "Vista anual" },
  { href: "/admin/taller/universo/calendario/configurar", label: "Meses, semana y eras" },
];

/** Submenú de Universo › Calendario: ver un año o configurar el calendario (§13). */
export function CalendarioSubmenu() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 px-6 pt-4">
      {VISTAS.map((v) => (
        <Link
          key={v.href}
          href={v.href}
          className={cn(
            "rounded-full px-3 py-1 text-xs transition-colors",
            pathname === v.href ? "bg-surface text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
