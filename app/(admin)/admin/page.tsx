import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EstadoBadge } from "@/components/admin/ui";
import { assertAdmin, signOutAction } from "@/lib/actions/auth";
import { getAdminStats, getRecentActivity, type AdminStat, type RecentItem } from "@/lib/queries/admin";

export const dynamic = "force-dynamic"; // datos en tiempo real, sin caché (§4)

/** "1 público" / "2 públicos" — pluralización simple. */
function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Tiempo relativo en español (se calcula al render; la página es force-dynamic). */
function hace(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${plural(m, "minuto", "minutos")}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${plural(h, "hora", "horas")}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${plural(d, "día", "días")}`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminDashboard() {
  const user = await assertAdmin();

  let stats: AdminStat[] = [];
  let recent: RecentItem[] = [];
  let error = false;
  try {
    [stats, recent] = await Promise.all([getAdminStats(), getRecentActivity()]);
  } catch {
    error = true;
  }

  const totalEntradas = stats.reduce((acc, s) => acc + s.total, 0);
  const totalPublicados = stats.reduce((acc, s) => acc + s.publicados, 0);
  const pctPublico = totalEntradas > 0 ? Math.round((totalPublicados / totalEntradas) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Star" className="text-accent" size={20} />
          <span className="font-display text-xl text-gradient-cosmic">Astralys · Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/personajes"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-void hover:scale-[1.02]"
          >
            Gestionar personajes →
          </Link>
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

      {error ? (
        <div className="rounded-2xl border border-error/40 bg-error/5 p-6 text-sm text-error">
          No se pudieron cargar las estadísticas. Revisa la conexión con la base de datos e inténtalo de nuevo.
        </div>
      ) : (
        <>
          {/* Resumen global */}
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border border-border-base bg-surface/50 px-5 py-3 text-sm">
            <span>
              <span className="font-display text-xl text-fg">{totalEntradas}</span>{" "}
              <span className="text-fg-muted">{totalEntradas === 1 ? "entrada" : "entradas"}</span>
            </span>
            <span>
              <span className="font-display text-xl text-success">{pctPublico}%</span>{" "}
              <span className="text-fg-muted">público</span>
            </span>
            <span>
              <span className="font-display text-xl text-fg">{stats.length}</span>{" "}
              <span className="text-fg-muted">{stats.length === 1 ? "tipo" : "tipos"} de contenido</span>
            </span>
          </div>

          <h1 className="mb-4 font-display text-2xl text-fg">Contenido</h1>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {stats.map((st) => (
              <Link
                key={st.key}
                href={st.href}
                className={`group rounded-2xl border border-border-base bg-surface/50 p-4 transition hover:border-border-glow hover:bg-surface ${
                  st.total === 0 ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2 text-fg-secondary">
                  <Icon name={st.icon} size={15} className="text-fg-muted group-hover:text-accent" />
                  <span className="text-sm">{st.label}</span>
                </div>
                <p className="mt-1 font-display text-3xl text-fg">{st.total}</p>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {st.total === 0 ? (
                    <span className="text-accent">Crear la primera →</span>
                  ) : (
                    <>
                      <span className="text-success">{plural(st.publicados, "público", "públicos")}</span>
                      {st.borradores > 0 && (
                        <span className="text-warning"> · {plural(st.borradores, "borrador", "borradores")}</span>
                      )}
                      {st.ocultos > 0 && (
                        <span className="text-fg-muted"> · {plural(st.ocultos, "oculto", "ocultos")}</span>
                      )}
                    </>
                  )}
                </p>
              </Link>
            ))}
          </div>

          {/* Actividad reciente */}
          <div className="mt-8 rounded-2xl border border-border-base bg-surface/30 p-5">
            <p className="mb-3 flex items-center gap-2 font-medium text-fg-secondary">
              <Icon name="Activity" size={16} className="text-fg-muted" />
              Actividad reciente
            </p>
            {recent.length === 0 ? (
              <p className="text-sm text-fg-muted">Aún no hay ediciones registradas.</p>
            ) : (
              <ul className="divide-y divide-border-base">
                {recent.map((it) => (
                  <li key={`${it.key}-${it.href}`}>
                    <Link
                      href={it.href}
                      className="group flex items-center gap-3 py-2 text-sm"
                    >
                      <span className="w-28 shrink-0 text-xs text-fg-muted">{it.label}</span>
                      <span className="flex-1 truncate text-fg-secondary group-hover:text-fg">{it.nombre}</span>
                      <EstadoBadge estado={it.estado} />
                      <span className="w-32 shrink-0 text-right text-xs text-fg-muted">{hace(it.actualizadoEn)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
