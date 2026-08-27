import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntidadForm } from "@/components/admin/EntidadForm";
import { getEntidadConfig } from "@/lib/admin/fields";
import { getCatalogosPorCampos, getElementosCatalogo, getReferenciasDeConfig } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function NuevaEntidadPage({ params }: { params: Promise<{ entidad: string }> }) {
  await assertAdmin();
  const { entidad } = await params;
  const config = getEntidadConfig(entidad);
  if (!config) notFound();

  const campos = config.fields
    .filter((f) => (f.type === "combobox" || f.type === "multi") && f.catalogCampo)
    .map((f) => f.catalogCampo!);
  const [catalogos, elementos, referencias] = await Promise.all([
    getCatalogosPorCampos(campos),
    getElementosCatalogo(),
    getReferenciasDeConfig(config),
  ]);

  return (
    <AdminShell title={`Nuevo · ${config.singular}`}>
      <EntidadForm config={config} inicial={null} catalogos={catalogos} elementos={elementos} referencias={referencias} />
    </AdminShell>
  );
}
