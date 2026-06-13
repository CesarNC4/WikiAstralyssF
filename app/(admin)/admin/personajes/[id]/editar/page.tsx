import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PersonajeForm } from "@/components/admin/PersonajeForm";
import { getCatalogosPersonaje } from "@/lib/queries/catalogos";
import {
  getPersonajeParaEditar,
  listPersonajesOpciones,
  listNacionesOpciones,
  listRazasOpciones,
  listOrganizacionesOpciones,
  listMagiaHechizosOpciones,
  listTimelineOpciones,
  listArtefactosOpciones,
  listFamiliasDePersonaje,
} from "@/lib/queries/adminPersonajes";

export const dynamic = "force-dynamic";

export default async function EditarPersonajePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertAdmin();
  const { id } = await params;
  const pid = Number(id);

  const inicial = await getPersonajeParaEditar(pid);
  if (!inicial) notFound();

  const [
    catalogos,
    personajesOpts,
    nacionesOpts,
    razasOpts,
    organizacionesOpts,
    magiaHechizosOpts,
    timelineOpts,
    artefactosOpts,
    familiasOpts,
  ] = await Promise.all([
    getCatalogosPersonaje(),
    listPersonajesOpciones(pid),
    listNacionesOpciones(),
    listRazasOpciones(),
    listOrganizacionesOpciones(),
    listMagiaHechizosOpciones(),
    listTimelineOpciones(),
    listArtefactosOpciones(),
    listFamiliasDePersonaje(pid),
  ]);

  const nombre = [inicial.nombre, inicial.surname].filter(Boolean).join(" ");

  return (
    <AdminShell
      title={`Editar · ${nombre}`}
      actions={
        <Link
          href={`/admin/preview/personaje/${pid}`}
          target="_blank"
          className="rounded-lg border border-border-glow px-3 py-2 text-sm text-fg-secondary hover:text-fg"
        >
          Preview ↗
        </Link>
      }
    >
      <PersonajeForm
        inicial={inicial}
        catalogos={catalogos}
        personajesOpts={personajesOpts}
        nacionesOpts={nacionesOpts}
        razasOpts={razasOpts}
        organizacionesOpts={organizacionesOpts}
        magiaHechizosOpts={magiaHechizosOpts}
        timelineOpts={timelineOpts}
        artefactosOpts={artefactosOpts}
        familiasDelPersonaje={familiasOpts}
      />
    </AdminShell>
  );
}
