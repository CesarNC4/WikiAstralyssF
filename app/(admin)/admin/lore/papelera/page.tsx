import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { LorePapeleraList } from "@/components/admin/LorePapeleraList";
import { listPapeleraLore } from "@/lib/queries/adminLore";

export const dynamic = "force-dynamic";

export default async function LorePapeleraPage() {
  await assertAdmin();
  const items = await listPapeleraLore();
  return (
    <AdminShell title="Papelera · Lore">
      <p className="mb-4 text-sm text-fg-muted">Páginas eliminadas. Puedes restaurarlas o borrarlas definitivamente (con sus secciones).</p>
      <LorePapeleraList items={items} />
    </AdminShell>
  );
}
