import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { CatalogosEditor, type CampoResumen } from "@/components/admin/CatalogosEditor";
import { listarCampos } from "@/lib/actions/catalogos";
import { ETIQUETAS_CATALOGO, USOS_LEGIBLES } from "@/lib/admin/catalogosMeta";
import { CategoriasRelacion } from "@/components/admin/CategoriasRelacion";
import { getCategoriasRelacion } from "@/lib/queries/categoriasRelacion";
import { CAMPO_CATEGORIA } from "@/lib/relaciones/categorias";

export const dynamic = "force-dynamic";

export default async function CatalogosPage() {
  await assertAdmin();
  const [campos, cats] = await Promise.all([listarCampos(), getCategoriasRelacion()]);

  // Las categorías de relación tienen su propio editor (color, icono, línea).
  const filas: CampoResumen[] = campos.filter((c) => c.campo !== CAMPO_CATEGORIA).map((c) => {
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
          <h2 className="mb-3 font-display text-lg text-accent">Mapa de relaciones</h2>
          <CategoriasRelacion categorias={cats.categorias} tipos={cats.tipos} />
        </section>

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
