import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntidadForm } from "@/components/admin/EntidadForm";
import { getEntidadConfig } from "@/lib/admin/fields";
import { getEntidadParaEditar, getCatalogosPorCampos, getReferenciasDeConfig } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  const config = getEntidadConfig("timeline")!;
  const row = await getEntidadParaEditar("timeline", Number(id));
  if (!row) notFound();

  const campos = config.fields.filter((f) => f.type === "combobox" && f.catalogCampo).map((f) => f.catalogCampo!);
  const [catalogos, referencias] = await Promise.all([
    getCatalogosPorCampos(campos),
    getReferenciasDeConfig(config),
  ]);

  return (
    <AdminShell title={`Editar evento · ${String(row[config.nameField] ?? "")}`}>
      <EntidadForm config={config} inicial={row} catalogos={catalogos} referencias={referencias} />
    </AdminShell>
  );
}
