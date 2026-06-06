import Link from "next/link";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PersonajesTable } from "@/components/admin/PersonajesTable";
import { listPersonajesAdmin } from "@/lib/queries/adminPersonajes";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

export default async function PersonajesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>;
}) {
  await assertAdmin();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const estado = (sp.estado ?? "todos") as EstadoPublicacion | "todos";
  const page = Number(sp.page ?? "1") || 1;

  const { items, total, pageSize } = await listPersonajesAdmin({ q, estado, page });

  return (
    <AdminShell
      title="Personajes"
      actions={
        <>
          <Link href="/admin/personajes/papelera" className="rounded-lg border border-border-base px-3 py-2 text-sm text-fg-secondary hover:text-fg">
            Papelera
          </Link>
          <Link href="/admin/personajes/nuevo" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-void hover:scale-[1.02]">
            + Nuevo
          </Link>
        </>
      }
    >
      <PersonajesTable items={items} total={total} page={page} pageSize={pageSize} q={q} estado={estado} />
    </AdminShell>
  );
}
