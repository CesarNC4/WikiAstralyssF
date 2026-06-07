import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { FamiliaForm } from "@/components/admin/FamiliaForm";
import { getFamiliaParaEditar } from "@/lib/queries/adminComplejas";
import { listPersonajesOpciones } from "@/lib/queries/adminPersonajes";
import { getCatalogosPorCampos } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function EditarFamiliaPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  const data = await getFamiliaParaEditar(Number(id));
  if (!data) notFound();
  const [personajes, catalogos] = await Promise.all([
    listPersonajesOpciones(),
    getCatalogosPorCampos(["familia_origen", "arbol_estado"]),
  ]);

  return (
    <AdminShell
      title={`Editar · ${String(data.familia.nombre ?? "")}`}
      actions={
        <Link href={`/admin/preview/familias/${id}`} target="_blank" className="rounded-lg border border-border-glow px-3 py-2 text-sm text-fg-secondary hover:text-fg">
          Preview ↗
        </Link>
      }
    >
      <FamiliaForm inicial={data} personajes={personajes} catalogos={catalogos} />
    </AdminShell>
  );
}
