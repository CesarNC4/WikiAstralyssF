import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComplejaPapeleraList } from "@/components/admin/ComplejaPapeleraList";
import { listPapeleraOrg } from "@/lib/queries/adminComplejas";

export const dynamic = "force-dynamic";

export default async function OrgPapeleraPage() {
  await assertAdmin();
  const items = await listPapeleraOrg();
  return (
    <AdminShell title="Papelera · Organizaciones">
      <p className="mb-4 text-sm text-fg-muted">Organizaciones eliminadas. Restáuralas o bórralas definitivamente (con rangos, facciones, jerarquía e historial).</p>
      <ComplejaPapeleraList entidad="organizaciones" items={items} />
    </AdminShell>
  );
}
