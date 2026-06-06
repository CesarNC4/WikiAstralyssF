import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntidadPapeleraList } from "@/components/admin/EntidadPapeleraList";
import { listPapeleraEntidad } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function TimelinePapeleraPage() {
  await assertAdmin();
  const items = await listPapeleraEntidad("timeline");
  return (
    <AdminShell title="Papelera · Cronología">
      <p className="mb-4 text-sm text-fg-muted">Eventos eliminados. Restaura o borra definitivamente.</p>
      <EntidadPapeleraList entidadKey="timeline" items={items} />
    </AdminShell>
  );
}
