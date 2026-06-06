import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { LorePageBody } from "@/components/fichas/LorePageBody";
import { EstadoBadge } from "@/components/admin/ui";
import { getLorePreview } from "@/lib/queries/adminLore";
import type { EstadoPublicacion } from "@/db/schema/enums";

export const dynamic = "force-dynamic";

export default async function PreviewLorePage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  const data = await getLorePreview(Number(id));
  if (!data) notFound();

  const p = data.pagina as Record<string, unknown>;

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm backdrop-blur">
        <span className="font-medium text-warning">PREVIEW</span>
        <EstadoBadge estado={(p.estadoPublicacion as EstadoPublicacion) ?? "borrador"} />
        <span className="text-fg-muted">Incluye secciones sin publicar — solo tú la ves.</span>
        <Link href={`/admin/lore/${id}/editar`} className="ml-auto text-fg-secondary hover:text-fg">← Volver al editor</Link>
      </div>
      <LorePageBody
        pagina={{
          slug: String(p.slug ?? ""),
          titulo: (p.titulo as string) ?? null,
          subtitulo: (p.subtitulo as string) ?? null,
          introduccion: (p.introduccion as string) ?? null,
          imagenUrl: (p.imagenUrl as string) ?? null,
          bannerUrl: (p.bannerUrl as string) ?? null,
        }}
        secciones={data.secciones}
      />
    </div>
  );
}
