"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ToastProvider } from "@/components/admin/Toast";
import { cn } from "@/lib/utils";

/**
 * Marco del taller del autor (spec §2): pantalla completa con su propio menú, en
 * lugar del sidebar del panel. Solo escritorio, así que no hay versión móvil.
 */

export const SECCIONES_TALLER = [
  { href: "/admin/taller/escribe", icon: "PenLine", label: "Escribe" },
  { href: "/admin/taller/capitulos", icon: "FolderTree", label: "Capítulos" },
  { href: "/admin/taller/estructura", icon: "Columns3", label: "Estructura" },
  { href: "/admin/taller/trama", icon: "GitBranch", label: "Trama" },
  { href: "/admin/taller/universo", icon: "Globe2", label: "Universo" },
  { href: "/admin/taller/estadisticas", icon: "BarChart3", label: "Estadísticas" },
  { href: "/admin/taller/papelera", icon: "Trash2", label: "Papelera" },
] as const;

export function TallerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ToastProvider>
      <div className="grid h-screen grid-cols-[220px_1fr] overflow-hidden">
        <aside className="flex flex-col border-r border-border-base bg-deep">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-4 pt-4 text-xs text-fg-muted hover:text-fg"
          >
            <Icon name="ArrowLeft" size={14} /> Panel
          </Link>
          <div className="flex items-center gap-2 px-4 pb-4 pt-2">
            <Icon name="Star" className="text-accent" size={18} />
            <span className="font-display text-lg text-gradient-cosmic">Taller</span>
          </div>
          <nav className="flex flex-col gap-1 border-t border-border-base px-2 pt-3 text-sm">
            {SECCIONES_TALLER.map((sec) => {
              const activa = pathname === sec.href || pathname.startsWith(`${sec.href}/`);
              return (
                <Link
                  key={sec.href}
                  href={sec.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 transition-colors",
                    activa
                      ? "border-accent bg-surface text-fg"
                      : "border-transparent text-fg-secondary hover:bg-surface/60 hover:text-fg",
                  )}
                >
                  <Icon name={sec.icon} size={17} /> {sec.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 overflow-y-auto">{children}</div>
      </div>
    </ToastProvider>
  );
}

/** Cabecera de una pantalla del taller: título y, opcionalmente, acciones o pestañas. */
export function TallerCabecera({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border-base bg-deep/90 px-6 py-4 backdrop-blur">
      <h1 className="font-display text-xl text-fg">{titulo}</h1>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}

/** Pantalla de una sección que llega en una fase posterior del plan. */
export function Proximamente({ titulo, fase }: { titulo: string; fase: string }) {
  return (
    <>
      <TallerCabecera titulo={titulo} />
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm italic text-fg-muted">Esta sección llega en la {fase} del plan del taller.</p>
      </div>
    </>
  );
}
