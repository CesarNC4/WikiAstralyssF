import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { OrgFichaBody } from "@/components/fichas/OrgFichaBody";
import { EstadoBadge } from "@/components/admin/ui";
import { getOrgPreview } from "@/lib/queries/adminComplejas";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

export default async function PreviewOrgPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  const data = await getOrgPreview(Number(id));
  if (!data) notFound();

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm backdrop-blur">
        <span className="font-medium text-warning">PREVIEW</span>
        <EstadoBadge estado={(data.org.estadoPublicacion as EstadoPublicacion) ?? "borrador"} />
        <span className="text-fg-muted">Incluye datos sin publicar — solo tú la ves.</span>
        <Link href={`/admin/organizaciones/${id}/editar`} className="ml-auto text-fg-secondary hover:text-fg">← Volver al editor</Link>
      </div>
      <OrgFichaBody org={data.org} jerarquia={data.jerarquia} facciones={data.facciones} historial={data.historial} />
    </div>
  );
}
