import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PersonajeForm } from "@/components/admin/PersonajeForm";
import { getCatalogosPersonaje } from "@/lib/queries/catalogos";
import {
  listPersonajesOpciones,
  listNacionesOpciones,
  listRazasOpciones,
  listOrganizacionesOpciones,
  listMagiaHechizosOpciones,
  listTimelineOpciones,
  listArtefactosOpciones,
  listRegionesOpciones,
  listLocacionesOpciones,
} from "@/lib/queries/adminPersonajes";

export const dynamic = "force-dynamic";

export default async function NuevoPersonajePage() {
  await assertAdmin();
  // Carga secuencial a propósito: el pool de conexiones (max 5) sobre el pooler
  // de Supabase se cuelga si se encolan más consultas en paralelo que conexiones.
  const catalogos = await getCatalogosPersonaje();
  const personajesOpts = await listPersonajesOpciones();
  const nacionesOpts = await listNacionesOpciones();
  const razasOpts = await listRazasOpciones();
  const organizacionesOpts = await listOrganizacionesOpciones();
  const magiaHechizosOpts = await listMagiaHechizosOpciones();
  const timelineOpts = await listTimelineOpciones();
  const artefactosOpts = await listArtefactosOpciones();
  const regionesOpts = await listRegionesOpciones();
  const locacionesOpts = await listLocacionesOpciones();

  return (
    <AdminShell title="Nuevo personaje">
      <PersonajeForm
        inicial={null}
        catalogos={catalogos}
        personajesOpts={personajesOpts}
        nacionesOpts={nacionesOpts}
        razasOpts={razasOpts}
        organizacionesOpts={organizacionesOpts}
        magiaHechizosOpts={magiaHechizosOpts}
        timelineOpts={timelineOpts}
        artefactosOpts={artefactosOpts}
        familiasDelPersonaje={[]}
        regionesOpts={regionesOpts}
        locacionesOpts={locacionesOpts}
      />
    </AdminShell>
  );
}
