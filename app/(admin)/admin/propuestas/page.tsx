import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { Bandeja } from "@/components/admin/propuestas/Bandeja";

export const dynamic = "force-dynamic";

/** La bandeja de propuestas de lore (docs/area-ia.md, Fase 5). */
export default async function PropuestasPage() {
  await assertAdmin();
  return (
    <AdminShell title="Propuestas">
      <Bandeja />
    </AdminShell>
  );
}
