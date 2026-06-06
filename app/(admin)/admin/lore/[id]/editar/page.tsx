import Link from "next/link";
import { notFound } from "next/navigation";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoreForm } from "@/components/admin/LoreForm";
import { getLoreParaEditar } from "@/lib/queries/adminLore";

export const dynamic = "force-dynamic";

export default async function EditarLorePage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  const data = await getLoreParaEditar(Number(id));
  if (!data) notFound();

  const titulo = String(data.pagina.titulo ?? data.pagina.slug ?? "");

  return (
    <AdminShell
      title={`Editar · ${titulo}`}
      actions={
        <Link href={`/admin/preview/lore/${id}`} target="_blank" className="rounded-lg border border-border-glow px-3 py-2 text-sm text-fg-secondary hover:text-fg">
          Preview ↗
        </Link>
      }
    >
      <LoreForm inicial={data} />
    </AdminShell>
  );
}
