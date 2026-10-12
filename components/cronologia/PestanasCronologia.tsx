"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/timeline", label: "Línea temporal", icono: "Clock" },
  { href: "/timeline/calendario", label: "Calendario", icono: "CalendarDays" },
];

/** Submenú de la cronología (spec §13): línea temporal o calendario por año. */
export function PestanasCronologia() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 inline-flex rounded-full border border-border-base bg-surface/40 p-1">
      {PESTANAS.map((p) => {
        const activa = pathname === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors",
              activa ? "bg-surface text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon name={p.icono} size={14} /> {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
