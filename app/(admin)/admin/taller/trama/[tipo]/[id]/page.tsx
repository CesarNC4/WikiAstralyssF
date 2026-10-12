import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { EntidadForm } from "@/components/admin/EntidadForm";
import { TallerCabecera } from "@/components/taller/TallerShell";
import { getEntidadConfig } from "@/lib/admin/fields";
import {
  getCatalogosPorCampos,
  getElementosCatalogo,
  getEntidadParaEditar,
  getReferenciasDeConfig,
} from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

const TIPOS = ["arcos", "hojas", "hilos"] as const;

/**
 * Editor de un arco, una hoja o un hilo dentro del taller (spec §8). Usa el
 * mismo formulario que tenían en el panel, así que conservan todos sus campos
 * y su panel de conexiones. `[id]` = "nuevo" abre el alta.
 */
export default async function TramaEditorPage({ params }: { params: Promise<{ tipo: string; id: string }> }) {
  await assertAdmin();
  const { tipo, id } = await params;
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) notFound();
  const config = getEntidadConfig(tipo);
  if (!config) notFound();

  const nuevo = id === "nuevo";
  const row = nuevo ? null : await getEntidadParaEditar(tipo, Number(id));
  if (!nuevo && !row) notFound();

  const campos = config.fields
    .filter((f) => (f.type === "combobox" || f.type === "multi") && f.catalogCampo)
    .map((f) => f.catalogCampo!);
  const [catalogos, elementos, referencias] = await Promise.all([
    getCatalogosPorCampos(campos),
    getElementosCatalogo(),
    getReferenciasDeConfig(config),
  ]);
  const nombre = row ? String(row[config.nameField] ?? "") : `Nuevo · ${config.singular}`;

  return (
    <>
      <TallerCabecera titulo={nombre}>
        <Link href={`/admin/taller/trama?vista=${tipo}`} className="text-xs text-fg-muted hover:text-fg">
          ← {config.plural}
        </Link>
      </TallerCabecera>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <EntidadForm
          key={id}
          config={config}
          inicial={row}
          catalogos={catalogos}
          elementos={elementos}
          referencias={referencias}
          rutaBase={`/admin/taller/trama/${tipo}`}
        />
      </div>
    </>
  );
}
