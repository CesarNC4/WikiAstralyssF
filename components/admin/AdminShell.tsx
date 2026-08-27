import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ToastProvider } from "@/components/admin/Toast";
import { ENTIDADES } from "@/lib/admin/fields";

/** Marco del panel: barra superior + navegación lateral (sobrio, coherente con el sitio). */
export function AdminShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen md:grid md:grid-cols-[200px_1fr]">
        <aside className="hidden border-r border-border-base bg-deep md:block">
          <div className="flex items-center gap-2 px-4 py-4">
            <Icon name="Star" className="text-accent" size={18} />
            <span className="font-display text-lg text-gradient-cosmic">Astralys</span>
          </div>
          <nav className="flex flex-col gap-1 px-2 text-sm">
            <NavLink href="/admin" icon="Home" label="Dashboard" />
            <NavLink href="/admin/personajes" icon="Users" label="Personajes" />
            {Object.values(ENTIDADES).map((e) => (
              <NavLink key={e.key} href={`/admin/${e.key}`} icon={e.icon} label={e.plural} />
            ))}
            <NavLink href="/admin/organizaciones" icon="Shield" label="Organizaciones" />
            <NavLink href="/admin/familias" icon="Users2" label="Familias" />
            <NavLink href="/admin/gremio" icon="Landmark" label="Gremio" />
            <NavLink href="/admin/lore" icon="ScrollText" label="Lore" />
            <NavLink href="/admin/mapa" icon="Map" label="Mapa" />
            <div className="my-2 border-t border-border-base" />
            <NavLink href="/admin/catalogos" icon="List" label="Catálogos" />
            <NavLink href="/" icon="Compass" label="Ver wiki ↗" />
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-base bg-deep/90 px-4 py-3 backdrop-blur">
            <h1 className="font-display text-lg text-fg">{title}</h1>
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          </header>
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-fg-secondary hover:bg-surface hover:text-fg"
    >
      <Icon name={icon} size={16} /> {label}
    </Link>
  );
}
