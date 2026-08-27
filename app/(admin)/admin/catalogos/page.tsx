import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { CatalogosEditor, type CampoResumen } from "@/components/admin/CatalogosEditor";
import { listarCampos } from "@/lib/actions/catalogos";
import { ETIQUETAS_CATALOGO, USOS_LEGIBLES } from "@/lib/admin/catalogosMeta";

export const dynamic = "force-dynamic";

export default async function CatalogosPage() {
  await assertAdmin();
  const campos = await listarCampos();

  const filas: CampoResumen[] = campos.map((c) => {
    const meta = ETIQUETAS_CATALOGO[c.campo];
    return {
      ...c,
      titulo: meta?.titulo ?? c.campo,
      descripcion: meta?.descripcion,
      usos: USOS_LEGIBLES[c.campo] ?? [],
    };
  });

  // Los compartidos arriba: son los que más consecuencias tienen al tocarlos.
  const compartidos = filas.filter((f) => (USOS_LEGIBLES[f.campo]?.length ?? 0) > 1);
  const propios = filas.filter((f) => (USOS_LEGIBLES[f.campo]?.length ?? 0) <= 1);

  return (
    <AdminShell title="Catálogos">
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 font-display text-lg text-accent">Compartidos entre fichas</h2>
          <p className="mb-3 text-sm text-fg-muted">
            Un cambio aquí se nota en varias secciones a la vez. Es lo que hace que &laquo;Raro&raquo;
            signifique lo mismo en un mineral que en un artefacto.
          </p>
          <CatalogosEditor campos={compartidos} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg text-accent">De una sola ficha</h2>
          <CatalogosEditor campos={propios} />
        </section>
      </div>
    </AdminShell>
  );
}
