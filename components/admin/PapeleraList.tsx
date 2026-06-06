"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PersonajeListItem } from "@/lib/queries/adminPersonajes";
import { restaurarDePapelera, eliminarDefinitivo } from "@/lib/actions/personajes";
import { useToast } from "@/components/admin/Toast";

export function PapeleraList({ items }: { items: PersonajeListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const accion = (fn: () => Promise<void>, msg: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast(msg, "success");
        router.refresh();
      } catch {
        toast("Acción fallida.", "error");
      }
    });

  if (items.length === 0) {
    return <p className="text-sm text-fg-muted">La papelera está vacía.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border-base">
      <table className="w-full text-sm">
        <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th className="px-3 py-2">Personaje</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-border-base">
              <td className="px-3 py-2 text-fg">{[p.nombre, p.surname].filter(Boolean).join(" ")}</td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1 text-xs">
                  <button
                    disabled={pending}
                    onClick={() => accion(() => restaurarDePapelera(p.id), "Restaurado.")}
                    className="rounded border border-success/40 px-2 py-1 text-success hover:bg-success/10"
                  >
                    Restaurar
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (confirm("¿Eliminar DEFINITIVAMENTE? Esta acción no se puede deshacer.")) {
                        accion(() => eliminarDefinitivo(p.id), "Eliminado definitivamente.");
                      }
                    }}
                    className="rounded border border-error/40 px-2 py-1 text-error hover:bg-error/10"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
