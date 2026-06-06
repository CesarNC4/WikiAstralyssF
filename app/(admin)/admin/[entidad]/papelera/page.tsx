import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntidadPapeleraList } from "@/components/admin/EntidadPapeleraList";
import { getEntidadConfig } from "@/lib/admin/fields";
import { listPapeleraEntidad } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function EntidadPapeleraPage({ params }: { params: Promise<{ entidad: string }> }) {
  await assertAdmin();
  const { entidad } = await params;
  const config = getEntidadConfig(entidad);
  if (!config) notFound();

  const items = await listPapeleraEntidad(entidad);

  return (
    <AdminShell title={`Papelera · ${config.plural}`}>
      <p className="mb-4 text-sm text-fg-muted">Elementos eliminados. Puedes restaurarlos o borrarlos definitivamente.</p>
      <EntidadPapeleraList entidadKey={entidad} items={items} />
    </AdminShell>
  );
}
