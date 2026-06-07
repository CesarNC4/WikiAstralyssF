import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComplejaPapeleraList } from "@/components/admin/ComplejaPapeleraList";
import { listPapeleraFamilia } from "@/lib/queries/adminComplejas";

export const dynamic = "force-dynamic";

export default async function FamiliaPapeleraPage() {
  await assertAdmin();
  const items = await listPapeleraFamilia();
  return (
    <AdminShell title="Papelera · Familias">
      <p className="mb-4 text-sm text-fg-muted">Familias eliminadas. Restáuralas o bórralas definitivamente (con facciones, jerarquía y árbol genealógico).</p>
      <ComplejaPapeleraList entidad="familias" items={items} />
    </AdminShell>
  );
}
