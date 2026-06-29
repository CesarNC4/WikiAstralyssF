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
  listRegionesOpciones,
  listLocacionesOpciones,
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

  // Carga secuencial a propósito: el pool de conexiones (max 5) sobre el pooler
  // de Supabase se cuelga si se encolan más consultas en paralelo que conexiones.
  const catalogos = await getCatalogosPersonaje();
  const personajesOpts = await listPersonajesOpciones(pid);
  const nacionesOpts = await listNacionesOpciones();
  const razasOpts = await listRazasOpciones();
  const organizacionesOpts = await listOrganizacionesOpciones();
  const magiaHechizosOpts = await listMagiaHechizosOpciones();
  const timelineOpts = await listTimelineOpciones();
  const artefactosOpts = await listArtefactosOpciones();
  const familiasOpts = await listFamiliasDePersonaje(pid);
  const regionesOpts = await listRegionesOpciones();
  const locacionesOpts = await listLocacionesOpciones();

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
        regionesOpts={regionesOpts}
        locacionesOpts={locacionesOpts}
      />
    </AdminShell>
  );
}
