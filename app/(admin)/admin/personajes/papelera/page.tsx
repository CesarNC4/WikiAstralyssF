import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PapeleraList } from "@/components/admin/PapeleraList";
import { listPapelera } from "@/lib/queries/adminPersonajes";

export const dynamic = "force-dynamic";

export default async function PapeleraPage() {
  await assertAdmin();
  const items = await listPapelera();
  return (
    <AdminShell title="Papelera">
      <p className="mb-4 text-sm text-fg-muted">
        Personajes eliminados. Puedes restaurarlos o borrarlos definitivamente (con sus stats, habilidades y relaciones).
      </p>
      <PapeleraList items={items} />
    </AdminShell>
  );
}
