import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { FamiliaForm } from "@/components/admin/FamiliaForm";
import { listPersonajesOpciones } from "@/lib/queries/adminPersonajes";
import { getCatalogosPorCampos } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function NuevaFamiliaPage() {
  await assertAdmin();
  const [personajes, catalogos] = await Promise.all([
    listPersonajesOpciones(),
    getCatalogosPorCampos(["familia_origen", "arbol_estado"]),
  ]);
  return (
    <AdminShell title="Nueva familia">
      <FamiliaForm inicial={null} personajes={personajes} catalogos={catalogos} />
    </AdminShell>
  );
}
