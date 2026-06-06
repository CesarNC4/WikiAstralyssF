import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { EntidadPreview } from "@/components/admin/EntidadPreview";
import { EstadoBadge } from "@/components/admin/ui";
import { getEntidadConfig } from "@/lib/admin/fields";
import { getEntidadParaEditar } from "@/lib/queries/adminEntidades";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

export default async function PreviewEntidadPage({ params }: { params: Promise<{ entidad: string; id: string }> }) {
  await assertAdmin();
  const { entidad, id } = await params;
  const config = getEntidadConfig(entidad);
  if (!config) notFound();

  const row = await getEntidadParaEditar(entidad, Number(id));
  if (!row) notFound();

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm backdrop-blur">
        <span className="font-medium text-warning">PREVIEW</span>
        <EstadoBadge estado={(row.estadoPublicacion as EstadoPublicacion) ?? "borrador"} />
        <span className="text-fg-muted">Vista sin publicar — solo tú la ves.</span>
        <Link href={`/admin/${entidad}/${id}/editar`} className="ml-auto text-fg-secondary hover:text-fg">← Volver al editor</Link>
      </div>
      <EntidadPreview config={config} row={row} />
    </div>
  );
}
