import Link from "next/link";
import { Icon } from "@/components/Icon";
import { assertAdmin, signOutAction } from "@/lib/actions/auth";
import { getAdminStats } from "@/lib/queries/admin";

export const dynamic = "force-dynamic"; // datos en tiempo real, sin caché (§4)

export default async function AdminDashboard() {
  const user = await assertAdmin();
  const stats = await getAdminStats().catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Star" className="text-accent" size={20} />
          <span className="font-display text-xl text-gradient-cosmic">Astralys · Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-fg-muted hover:text-fg">
            Ver wiki ↗
          </Link>
          <form action={signOutAction}>
            <button className="rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-secondary hover:border-error hover:text-error">
              Salir
            </button>
          </form>
        </div>
      </header>

      <p className="mb-6 text-sm text-fg-muted">
        Sesión: <span className="text-fg-secondary">{user.email}</span>
      </p>

      <h1 className="mb-4 font-display text-2xl text-fg">Contenido</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="rounded-2xl border border-border-base bg-surface/50 p-4">
            <p className="text-sm text-fg-secondary">{st.label}</p>
            <p className="mt-1 font-display text-3xl text-fg">{st.total}</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              <span className="text-success">{st.visibles} públicos</span>
              {st.total - st.visibles > 0 && (
                <span className="text-warning"> · {st.total - st.visibles} borradores</span>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-border-base p-6 text-sm text-fg-muted">
        <p className="mb-2 font-medium text-fg-secondary">Próximos pasos del panel (roadmap §19)</p>
        <ul className="list-inside list-disc space-y-1">
          <li>CRUD por entidad con Server Actions + validación Zod.</li>
          <li>Estados de publicación (borrador / publicado / oculto) y preview con draft mode.</li>
          <li>Webhook de Discord + push al publicar.</li>
          <li>Gestor de media (subida a R2).</li>
        </ul>
      </div>
    </div>
  );
}
