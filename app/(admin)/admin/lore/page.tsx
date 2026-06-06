import Link from "next/link";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoreTable } from "@/components/admin/LoreTable";
import { listLoreAdmin } from "@/lib/queries/adminLore";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

export default async function LoreAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>;
}) {
  await assertAdmin();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const estado = (sp.estado ?? "todos") as EstadoPublicacion | "todos";
  const page = Number(sp.page ?? "1") || 1;

  const { items, total, pageSize } = await listLoreAdmin({ q, estado, page });

  return (
    <AdminShell
      title="Lore"
      actions={
        <>
          <Link href="/admin/lore/papelera" className="rounded-lg border border-border-base px-3 py-2 text-sm text-fg-secondary hover:text-fg">Papelera</Link>
          <Link href="/admin/lore/nuevo" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-void hover:scale-[1.02]">+ Nueva página</Link>
        </>
      }
    >
      <LoreTable items={items} total={total} page={page} pageSize={pageSize} q={q} estado={estado} />
    </AdminShell>
  );
}
