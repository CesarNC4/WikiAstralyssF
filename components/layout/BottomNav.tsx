"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useSearch } from "@/components/search/SearchProvider";
import { cn } from "@/lib/utils";

/** Bottom navigation móvil (§8.1, §16) — alcance del pulgar. */
const ITEMS = [
  { href: "/", icon: "Home", label: "Inicio" },
  { href: "/personajes", icon: "Users", label: "Personajes" },
  { href: "__search__", icon: "Search", label: "Buscar" },
  { href: "/naciones", icon: "Globe2", label: "Mundo" },
  { href: "/mapa", icon: "Map", label: "Mapa" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { open } = useSearch();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-base bg-void/90 backdrop-blur-xl md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map((it) => {
          const isSearch = it.href === "__search__";
          const active = !isSearch && (it.href === "/" ? pathname === "/" : pathname.startsWith(it.href));
          const content = (
            <span className="flex flex-col items-center gap-0.5 py-2">
              <Icon
                name={it.icon}
                size={20}
                className={cn(active ? "text-primary" : "text-fg-muted")}
              />
              <span className={cn("text-[10px]", active ? "text-primary" : "text-fg-muted")}>
                {it.label}
              </span>
            </span>
          );
          return (
            <li key={it.href} className="flex-1">
              {isSearch ? (
                <button onClick={open} className="w-full" aria-label="Buscar">
                  {content}
                </button>
              ) : (
                <Link href={it.href} className="block w-full text-center">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
