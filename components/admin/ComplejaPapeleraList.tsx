"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ComplejaListItem } from "@/lib/queries/adminComplejas";
import {
  restaurarOrg, eliminarOrgDefinitivo,
  restaurarFamilia, eliminarFamiliaDefinitivo,
} from "@/lib/actions/complejas";
import { useToast } from "@/components/admin/Toast";

type Entidad = "organizaciones" | "familias";

const ACC = {
  organizaciones: { restaurar: restaurarOrg, eliminar: eliminarOrgDefinitivo },
  familias: { restaurar: restaurarFamilia, eliminar: eliminarFamiliaDefinitivo },
} as const;

export function ComplejaPapeleraList({ entidad, items }: { entidad: Entidad; items: ComplejaListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const acc = ACC[entidad];

  const accion = (fn: () => Promise<void>, msg: string) =>
    startTransition(async () => {
      try { await fn(); toast(msg, "success"); router.refresh(); }
      catch { toast("Acción fallida.", "error"); }
    });

  if (items.length === 0) return <p className="text-sm text-fg-muted">La papelera está vacía.</p>;

  return (
    <div className="overflow-hidden rounded-2xl border border-border-base">
      <table className="w-full text-sm">
        <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2 text-right">Acciones</th></tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-border-base">
              <td className="px-3 py-2 text-fg">{it.nombre}</td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1 text-xs">
                  <button disabled={pending} onClick={() => accion(() => acc.restaurar(it.id), "Restaurado.")} className="rounded border border-success/40 px-2 py-1 text-success hover:bg-success/10">Restaurar</button>
                  <button disabled={pending} onClick={() => { if (confirm("¿Eliminar DEFINITIVAMENTE? Se borran también sus bloques. No se puede deshacer.")) accion(() => acc.eliminar(it.id), "Eliminado definitivamente."); }} className="rounded border border-error/40 px-2 py-1 text-error hover:bg-error/10">Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
