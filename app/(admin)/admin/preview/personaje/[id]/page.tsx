import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { PersonajeFichaBody } from "@/components/fichas/PersonajeFichaBody";
import { getPersonajePreview } from "@/lib/queries/fichas";
import { EstadoBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function PreviewPersonajePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertAdmin();
  const { id } = await params;
  const p = await getPersonajePreview(Number(id));
  if (!p) notFound();

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm backdrop-blur">
        <span className="font-medium text-warning">PREVIEW</span>
        <EstadoBadge estado={p.estadoPublicacion} />
        <span className="text-fg-muted">Vista sin publicar — solo tú la ves.</span>
        <Link href={`/admin/personajes/${p.id}/editar`} className="ml-auto text-fg-secondary hover:text-fg">
          ← Volver al editor
        </Link>
      </div>
      <PersonajeFichaBody p={p} />
    </div>
  );
}
