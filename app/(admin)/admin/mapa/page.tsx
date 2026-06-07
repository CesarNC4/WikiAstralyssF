import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { MapaEditorClient } from "@/components/admin/MapaEditorClient";
import { getMapaAdmin } from "@/lib/queries/adminMapa";

export const dynamic = "force-dynamic";

export default async function AdminMapaPage() {
  await assertAdmin();
  const data = await getMapaAdmin();

  return (
    <AdminShell title="Editor de mapa">
      <p className="mb-4 text-sm text-fg-muted">
        Dibuja el contorno de naciones y regiones, y coloca las locaciones. Selecciona una entidad
        en el mapa o créala; pulsa “Dibujar/Colocar” y luego “Guardar”.
      </p>
      <MapaEditorClient data={data} />
    </AdminShell>
  );
}
