import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PersonajeForm } from "@/components/admin/PersonajeForm";
import { getCatalogosPersonaje } from "@/lib/queries/catalogos";
import {
  listPersonajesOpciones,
  listNacionesOpciones,
  listRazasOpciones,
  listOrganizacionesOpciones,
} from "@/lib/queries/adminPersonajes";

export const dynamic = "force-dynamic";

export default async function NuevoPersonajePage() {
  await assertAdmin();
  const [catalogos, personajesOpts, nacionesOpts, razasOpts, organizacionesOpts] = await Promise.all([
    getCatalogosPersonaje(),
    listPersonajesOpciones(),
    listNacionesOpciones(),
    listRazasOpciones(),
    listOrganizacionesOpciones(),
  ]);

  return (
    <AdminShell title="Nuevo personaje">
      <PersonajeForm
        inicial={null}
        catalogos={catalogos}
        personajesOpts={personajesOpts}
        nacionesOpts={nacionesOpts}
        razasOpts={razasOpts}
        organizacionesOpts={organizacionesOpts}
      />
    </AdminShell>
  );
}
