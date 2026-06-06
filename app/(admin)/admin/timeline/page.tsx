import Link from "next/link";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { TimelineManager } from "@/components/admin/TimelineManager";
import { listTimelineEventos } from "@/lib/queries/adminTimeline";
import { getOpcionesReferencia } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function TimelineAdminPage() {
  await assertAdmin();
  const [eventos, capitulos] = await Promise.all([
    listTimelineEventos(),
    getOpcionesReferencia("capitulos"),
  ]);

  return (
    <AdminShell
      title="Cronología"
      actions={
        <Link href="/admin/timeline/papelera" className="rounded-lg border border-border-base px-3 py-2 text-sm text-fg-secondary hover:text-fg">
          Papelera
        </Link>
      }
    >
      <TimelineManager eventos={eventos} capitulos={capitulos} />
    </AdminShell>
  );
}
