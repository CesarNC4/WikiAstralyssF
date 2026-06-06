import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoreForm } from "@/components/admin/LoreForm";

export const dynamic = "force-dynamic";

export default async function NuevaLorePage() {
  await assertAdmin();
  return (
    <AdminShell title="Nueva página de lore">
      <LoreForm inicial={null} />
    </AdminShell>
  );
}
