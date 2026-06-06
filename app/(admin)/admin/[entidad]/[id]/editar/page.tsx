import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntidadForm } from "@/components/admin/EntidadForm";
import { getEntidadConfig } from "@/lib/admin/fields";
import { getEntidadParaEditar, getCatalogosPorCampos, getReferenciasDeConfig } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function EditarEntidadPage({ params }: { params: Promise<{ entidad: string; id: string }> }) {
  await assertAdmin();
  const { entidad, id } = await params;
  const config = getEntidadConfig(entidad);
  if (!config) notFound();

  const row = await getEntidadParaEditar(entidad, Number(id));
  if (!row) notFound();

  const campos = config.fields.filter((f) => f.type === "combobox" && f.catalogCampo).map((f) => f.catalogCampo!);
  const [catalogos, referencias] = await Promise.all([
    getCatalogosPorCampos(campos),
    getReferenciasDeConfig(config),
  ]);
  const nombre = String(row[config.nameField] ?? "");

  return (
    <AdminShell
      title={`Editar · ${nombre}`}
      actions={
        config.hasFicha ? (
          <Link href={`/admin/preview/${entidad}/${id}`} target="_blank" className="rounded-lg border border-border-glow px-3 py-2 text-sm text-fg-secondary hover:text-fg">
            Preview ↗
          </Link>
        ) : null
      }
    >
      <EntidadForm config={config} inicial={row} catalogos={catalogos} referencias={referencias} />
    </AdminShell>
  );
}
