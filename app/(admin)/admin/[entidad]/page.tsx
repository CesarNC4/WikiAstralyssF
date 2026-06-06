import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntidadTable } from "@/components/admin/EntidadTable";
import { getEntidadConfig } from "@/lib/admin/fields";
import { listEntidadAdmin } from "@/lib/queries/adminEntidades";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

export default async function EntidadListPage({
  params,
  searchParams,
}: {
  params: Promise<{ entidad: string }>;
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>;
}) {
  await assertAdmin();
  const { entidad } = await params;
  const config = getEntidadConfig(entidad);
  if (!config) notFound();

  const sp = await searchParams;
  const q = sp.q ?? "";
  const estado = (sp.estado ?? "todos") as EstadoPublicacion | "todos";
  const page = Number(sp.page ?? "1") || 1;

  const { items, total, pageSize } = await listEntidadAdmin(entidad, { q, estado, page });

  return (
    <AdminShell
      title={config.plural}
      actions={
        <>
          <Link href={`/admin/${entidad}/papelera`} className="rounded-lg border border-border-base px-3 py-2 text-sm text-fg-secondary hover:text-fg">
            Papelera
          </Link>
          <Link href={`/admin/${entidad}/nuevo`} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-void hover:scale-[1.02]">
            + Nuevo
          </Link>
        </>
      }
    >
      <EntidadTable config={config} items={items} total={total} page={page} pageSize={pageSize} q={q} estado={estado} />
    </AdminShell>
  );
}
