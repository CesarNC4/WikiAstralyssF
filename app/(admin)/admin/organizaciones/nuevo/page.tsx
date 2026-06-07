import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { OrgForm } from "@/components/admin/OrgForm";
import { listPersonajesOpciones } from "@/lib/queries/adminPersonajes";
import { getCatalogosPorCampos } from "@/lib/queries/adminEntidades";

export const dynamic = "force-dynamic";

export default async function NuevaOrgPage() {
  await assertAdmin();
  const [personajes, catalogos] = await Promise.all([
    listPersonajesOpciones(),
    getCatalogosPorCampos(["org_tipo", "org_estado"]),
  ]);
  return (
    <AdminShell title="Nueva organización">
      <OrgForm inicial={null} personajes={personajes} catalogos={catalogos} />
    </AdminShell>
  );
}
