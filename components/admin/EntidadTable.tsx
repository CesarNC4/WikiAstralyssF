"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EntidadListItem } from "@/lib/queries/adminEntidades";
import type { EntidadConfig } from "@/lib/admin/fields";
import { cambiarEstadoEntidad, moverEntidadAPapelera } from "@/lib/actions/entidades";
import { EstadoBadge } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";
import { cldOptimize } from "@/lib/utils";

const estados = ["todos", "borrador", "publicado", "oculto"] as const;

export function EntidadTable({
  config,
  items,
  total,
  page,
  pageSize,
  q,
  estado,
}: {
  config: EntidadConfig;
  items: EntidadListItem[];
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
  const base = `/admin/${config.key}`;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
      try {
        await fn();
        toast(msg, "success");
        router.refresh();
      } catch {
        toast("Acción fallida.", "error");
      }
    });

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); navigate({ q: query, page: 1 }); }} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-56 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-border-glow"
        />
        <select value={estado} onChange={(e) => navigate({ estado: e.target.value, page: 1 })} className="rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none">
          {estados.map((e) => (
            <option key={e} value={e}>{e === "todos" ? "Todos los estados" : e}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-border-glow px-3 py-2 text-sm text-fg-secondary hover:text-fg">Buscar</button>
        <span className="ml-auto text-xs text-fg-muted">{total} {config.plural.toLowerCase()}</span>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border-base">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2">{config.singular}</th>
              <th className="px-3 py-2">Estado</th>
              <th className="hidden px-3 py-2 sm:table-cell">Editado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border-base hover:bg-surface/30">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {config.hasImage && (
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-deep">
                        {it.imagenUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cldOptimize(it.imagenUrl) ?? ""} alt={it.nombre} className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-xs text-border-glow">✦</span>
                        )}
                      </div>
                    )}
                    <Link href={`${base}/${it.id}/editar`} className="truncate text-fg hover:text-primary-glow">{it.nombre}</Link>
                  </div>
                </td>
                <td className="px-3 py-2"><EstadoBadge estado={it.estado} /></td>
                <td className="hidden px-3 py-2 text-xs text-fg-muted sm:table-cell">{relativo(it.actualizadoEn)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1 text-xs">
                    <Link href={`${base}/${it.id}/editar`} className="rounded border border-border-base px-2 py-1 text-fg-secondary hover:text-fg">Editar</Link>
                    {config.hasFicha && (
                      <Link href={`/admin/preview/${config.key}/${it.id}`} target="_blank" className="rounded border border-border-base px-2 py-1 text-fg-secondary hover:text-fg">Preview</Link>
                    )}
                    {it.estado !== "publicado" ? (
                      <button disabled={pending} onClick={() => accion(() => cambiarEstadoEntidad(config.key, it.id, "publicado"), "Publicado.")} className="rounded border border-success/40 px-2 py-1 text-success hover:bg-success/10">Publicar</button>
                    ) : (
                      <button disabled={pending} onClick={() => accion(() => cambiarEstadoEntidad(config.key, it.id, "oculto"), "Oculto.")} className="rounded border border-warning/40 px-2 py-1 text-warning hover:bg-warning/10">Ocultar</button>
                    )}
                    <button disabled={pending} onClick={() => { if (confirm("¿Mover a la papelera?")) accion(() => moverEntidadAPapelera(config.key, it.id), "Movido a la papelera."); }} className="rounded border border-error/40 px-2 py-1 text-error hover:bg-error/10">Papelera</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-fg-muted">No hay resultados con estos filtros.</td></tr>
            )}
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

function relativo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `hace ${dias} d`;
  return date.toLocaleDateString("es");
}
