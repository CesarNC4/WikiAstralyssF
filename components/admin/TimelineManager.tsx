"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TimelineEvento } from "@/lib/queries/adminTimeline";
import type { OpcionRef } from "@/lib/queries/adminEntidades";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { actualizarEventoInline, crearEventoRapido } from "@/lib/actions/timeline";
import { moverEntidadAPapelera } from "@/lib/actions/entidades";
import { useToast } from "@/components/admin/Toast";

const inp = "rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow";

/**
 * Gestor de los eventos de la cronología. Van en orden cronológico (spec §14):
 * la fecha manda, así que ya no se arrastran. La fecha, su importancia y el
 * acto se editan en «Editar»; aquí, lo rápido.
 */
export function TimelineManager({ eventos, capitulos }: { eventos: TimelineEvento[]; capitulos: OpcionRef[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<TimelineEvento[]>(eventos);

  const patch = (id: number, p: Partial<TimelineEvento>, persist: () => Promise<void>) => {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } : e)));
    startTransition(async () => {
      try {
        await persist();
      } catch {
        toast("No se pudo guardar.", "error");
      }
    });
  };

  // El evento nace sin fecha: se abre su editor para ponérsela.
  const addEvento = () =>
    startTransition(async () => {
      try {
        const id = await crearEventoRapido();
        router.push(`/admin/timeline/${id}/editar`);
      } catch {
        toast("No se pudo crear.", "error");
      }
    });

  const borrar = (id: number) => {
    if (!confirm("¿Mover este evento a la papelera?")) return;
    setItems((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      try {
        await moverEntidadAPapelera("timeline", id);
        toast("Movido a la papelera.", "success");
      } catch {
        toast("No se pudo borrar.", "error");
        router.refresh();
      }
    });
  };

  return (
    <div>
      <p className="mb-3 text-sm text-fg-muted">
        Los eventos se ordenan solos por su fecha. Título, estado y capítulo se editan aquí mismo; la fecha, la importancia,
        el acto y lo demás, en «Editar». También puedes crearlos desde el{" "}
        <Link href="/admin/taller/universo/calendario" className="text-accent hover:underline">
          calendario del taller
        </Link>
        .
      </p>

      <div className="space-y-2">
        {items.map((ev) => (
          <div key={ev.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2">
            <span className="w-44 shrink-0 text-xs" title={ev.fecha?.absoluto}>
              {ev.fecha ? (
                <>
                  <span className="block text-fg-secondary">{ev.fecha.eras}</span>
                  {ev.fecha.eras !== ev.fecha.absoluto && <span className="block font-mono text-fg-muted">{ev.fecha.absoluto}</span>}
                </>
              ) : (
                <span className="text-warning">Sin fecha</span>
              )}
            </span>
            <span className="w-4 text-center text-accent" title={ev.importante ? "Importante: sale en la cronología destacada" : undefined}>
              {ev.importante ? "★" : ""}
            </span>

            <input
              defaultValue={ev.titulo}
              onBlur={(e) => {
                if (e.target.value !== ev.titulo) patch(ev.id, { titulo: e.target.value }, () => actualizarEventoInline(ev.id, { titulo: e.target.value }));
              }}
              placeholder="Título del evento"
              className={inp + " min-w-[12rem] flex-1"}
            />
            <select
              value={ev.estado}
              onChange={(e) =>
                patch(ev.id, { estado: e.target.value as EstadoPublicacion }, () =>
                  actualizarEventoInline(ev.id, { estado: e.target.value as EstadoPublicacion }),
                )
              }
              className={inp + " w-28"}
            >
              <option value="borrador">Borrador</option>
              <option value="publicado">Publicado</option>
              <option value="oculto">Oculto</option>
            </select>
            <select
              value={ev.capituloId ?? ""}
              onChange={(e) => {
                const cid = e.target.value ? Number(e.target.value) : null;
                patch(ev.id, { capituloId: cid }, () => actualizarEventoInline(ev.id, { capituloId: cid }));
              }}
              className={inp + " w-40"}
            >
              <option value="">— Capítulo —</option>
              {capitulos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            {ev.categoria && <span className="rounded-full border border-border-base px-2 py-0.5 text-[11px] text-fg-muted">{ev.categoria}</span>}

            <div className="ml-auto flex items-center gap-1 text-xs">
              <Link href={`/admin/timeline/${ev.id}/editar`} className="rounded border border-border-base px-2 py-1 text-fg-secondary hover:text-fg">
                Editar
              </Link>
              <button type="button" onClick={() => borrar(ev.id)} className="rounded border border-error/40 px-2 py-1 text-error hover:bg-error/10">
                ✕
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-fg-muted">Sin eventos. Añade el primero.</p>}
      </div>

      <button type="button" onClick={addEvento} className="mt-3 rounded-lg border border-dashed border-border-glow px-3 py-2 text-sm text-fg-secondary hover:text-fg">
        + Nuevo evento
      </button>
    </div>
  );
}
