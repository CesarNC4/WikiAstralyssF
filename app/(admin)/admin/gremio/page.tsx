import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { GremioForm } from "@/components/admin/GremioForm";
import { FechasFicha } from "@/components/admin/FechasFicha";
import { getGremioParaEditar } from "@/lib/queries/adminComplejas";
import { listPersonajesOpciones } from "@/lib/queries/adminPersonajes";

export const dynamic = "force-dynamic";

export default async function GremioAdminPage() {
  await assertAdmin();
  const [data, personajes] = await Promise.all([getGremioParaEditar(), listPersonajesOpciones()]);
  return (
    <AdminShell title="Gremio">
      <p className="mb-4 text-sm text-fg-muted">Registro único del gremio. Edita sus datos, rangos, facciones, jerarquía e historial.</p>
      <div className="mb-4">
        <FechasFicha entidad="gremio" id={data.gremio.id} />
      </div>
      <GremioForm inicial={data} personajes={personajes} />
    </AdminShell>
  );
}
