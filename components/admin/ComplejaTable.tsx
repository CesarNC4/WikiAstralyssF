"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComplejaListItem } from "@/lib/queries/adminComplejas";
import {
  cambiarEstadoOrg, moverOrgAPapelera,
  cambiarEstadoFamilia, moverFamiliaAPapelera,
} from "@/lib/actions/complejas";
import type { Estado } from "@/lib/admin/complejas";
import { EstadoBadge } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";

const estados = ["todos", "borrador", "publicado", "oculto"] as const;

type Entidad = "organizaciones" | "familias";

const ACC = {
  organizaciones: { cambiar: cambiarEstadoOrg, papelera: moverOrgAPapelera, singular: "Organización" },
  familias: { cambiar: cambiarEstadoFamilia, papelera: moverFamiliaAPapelera, singular: "Familia" },
} as const;

export function ComplejaTable({
  entidad,
  items,
  total,
  page,
  pageSize,
  q,
  estado,
}: {
  entidad: Entidad;
  items: ComplejaListItem[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  estado: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(q);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const acc = ACC[entidad];
  const base = `/admin/${entidad}`;

  const navigate = (params: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    const merged = { q: query, estado, page: 1, ...params };
    if (merged.q) sp.set("q", String(merged.q));
    if (merged.estado && merged.estado !== "todos") sp.set("estado", String(merged.estado));
    if (Number(merged.page) > 1) sp.set("page", String(merged.page));
    router.push(`${base}${sp.toString() ? `?${sp}` : ""}`);
  };

  const accion = (fn: () => Promise<void>, msg: string) =>
    startTransition(async () => {
      try { await fn(); toast(msg, "success"); router.refresh(); }
      catch { toast("Acción fallida.", "error"); }
    });

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); navigate({ q: query, page: 1 }); }} className="mb-4 flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre…" className="w-56 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-border-glow" />
        <select value={estado} onChange={(e) => navigate({ estado: e.target.value, page: 1 })} className="rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none">
          {estados.map((e) => <option key={e} value={e}>{e === "todos" ? "Todos los estados" : e}</option>)}
        </select>
        <button type="submit" className="rounded-lg border border-border-glow px-3 py-2 text-sm text-fg-secondary hover:text-fg">Buscar</button>
        <span className="ml-auto text-xs text-fg-muted">{total} en total</span>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border-base">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-fg-muted">
            <tr><th className="px-3 py-2">{acc.singular}</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border-base hover:bg-surface/30">
                <td className="px-3 py-2">
                  <Link href={`${base}/${it.id}/editar`} className="text-fg hover:text-primary-glow">{it.nombre}</Link>
                </td>
                <td className="px-3 py-2"><EstadoBadge estado={it.estado} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1 text-xs">
                    <Link href={`${base}/${it.id}/editar`} className="rounded border border-border-base px-2 py-1 text-fg-secondary hover:text-fg">Editar</Link>
                    <Link href={`/admin/preview/${entidad}/${it.id}`} target="_blank" className="rounded border border-border-base px-2 py-1 text-fg-secondary hover:text-fg">Preview</Link>
                    {it.estado !== "publicado" ? (
                      <button disabled={pending} onClick={() => accion(() => acc.cambiar(it.id, "publicado" as Estado), "Publicado.")} className="rounded border border-success/40 px-2 py-1 text-success hover:bg-success/10">Publicar</button>
                    ) : (
                      <button disabled={pending} onClick={() => accion(() => acc.cambiar(it.id, "oculto" as Estado), "Oculto.")} className="rounded border border-warning/40 px-2 py-1 text-warning hover:bg-warning/10">Ocultar</button>
                    )}
                    <button disabled={pending} onClick={() => { if (confirm("¿Mover a la papelera?")) accion(() => acc.papelera(it.id), "Movido a la papelera."); }} className="rounded border border-error/40 px-2 py-1 text-error hover:bg-error/10">Papelera</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-fg-muted">No hay resultados con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => navigate({ page: page - 1 })} className="rounded-lg border border-border-base px-3 py-1.5 text-fg-secondary disabled:opacity-40">← Anterior</button>
          <span className="text-fg-muted">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => navigate({ page: page + 1 })} className="rounded-lg border border-border-base px-3 py-1.5 text-fg-secondary disabled:opacity-40">Siguiente →</button>
        </div>
      )}
    </div>
  );
}
