"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TimelineEvento } from "@/lib/queries/adminTimeline";
import type { OpcionRef } from "@/lib/queries/adminEntidades";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { reordenarTimeline, actualizarEventoInline, crearEventoRapido } from "@/lib/actions/timeline";
import { moverEntidadAPapelera } from "@/lib/actions/entidades";
import { useToast } from "@/components/admin/Toast";

const inp = "rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow";

export function TimelineManager({ eventos, capitulos }: { eventos: TimelineEvento[]; capitulos: OpcionRef[] }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<TimelineEvento[]>(eventos);
  // Espejo síncrono de `items` para leer el estado más reciente en handlers (drag).
  const itemsRef = useRef<TimelineEvento[]>(eventos);
  const apply = (next: TimelineEvento[]) => { itemsRef.current = next; setItems(next); };
  const dragIndex = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const persistOrden = (list: TimelineEvento[]) => {
    startTransition(async () => {
      try { await reordenarTimeline(list.map((e) => e.id)); } catch { toast("No se pudo guardar el orden.", "error"); }
    });
  };

  const onDragEnter = (i: number) => {
    const from = dragIndex.current;
    if (from === null || from === i) return;
    const next = [...itemsRef.current];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    apply(next);
    dragIndex.current = i;
    setDragging(i);
  };

  const onDragEnd = () => {
    dragIndex.current = null;
    setDragging(null);
    persistOrden(itemsRef.current);
  };

  const patch = (id: number, p: Partial<TimelineEvento>, persist: () => Promise<void>) => {
    apply(itemsRef.current.map((e) => (e.id === id ? { ...e, ...p } : e)));
    startTransition(async () => {
      try { await persist(); } catch { toast("No se pudo guardar.", "error"); }
    });
  };

  const addEvento = () =>
    startTransition(async () => {
      try {
        const id = await crearEventoRapido();
        apply([...itemsRef.current, { id, titulo: "Nuevo evento", fechaLore: "—", era: null, importancia: null, categoria: null, capituloId: null, estado: "borrador" }]);
        toast("Evento creado.", "success");
      } catch { toast("No se pudo crear.", "error"); }
    });

  const borrar = (id: number) => {
    if (!confirm("¿Mover este evento a la papelera?")) return;
    apply(itemsRef.current.filter((e) => e.id !== id));
    startTransition(async () => {
      try { await moverEntidadAPapelera("timeline", id); toast("Movido a la papelera.", "success"); }
      catch { toast("No se pudo borrar.", "error"); router.refresh(); }
    });
  };

  return (
    <div>
      <p className="mb-3 text-sm text-fg-muted">
        Arrastra los eventos para ordenarlos como quieras (el orden se guarda solo). Edita título, fecha, estado y capítulo
        aquí mismo; el resto (importancia, categoría, descripción) en «Editar».
      </p>

      <div className="space-y-2">
        {items.map((ev, i) => (
          <div
            key={ev.id}
            draggable
            onDragStart={() => { dragIndex.current = i; setDragging(i); }}
            onDragEnter={() => onDragEnter(i)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={onDragEnd}
            className={
              "flex flex-wrap items-center gap-2 rounded-xl border bg-surface/40 p-2 " +
              (dragging === i ? "border-border-glow opacity-70" : "border-border-base")
            }
          >
            <span className="cursor-grab select-none px-1 text-fg-muted" title="Arrastrar">⠿</span>
            <span className="w-6 text-center text-xs text-fg-muted">{i + 1}</span>

            <input
              defaultValue={ev.titulo}
              onBlur={(e) => { if (e.target.value !== ev.titulo) patch(ev.id, { titulo: e.target.value }, () => actualizarEventoInline(ev.id, { titulo: e.target.value })); }}
              placeholder="Título del evento"
              className={inp + " min-w-[12rem] flex-1"}
            />
            <input
              defaultValue={ev.fechaLore ?? ""}
              onBlur={(e) => { if (e.target.value !== (ev.fechaLore ?? "")) patch(ev.id, { fechaLore: e.target.value }, () => actualizarEventoInline(ev.id, { fechaLore: e.target.value })); }}
              placeholder="Fecha (lore)"
              className={inp + " w-32"}
            />
            <input
              defaultValue={ev.era ?? ""}
              onBlur={(e) => { if (e.target.value !== (ev.era ?? "")) patch(ev.id, { era: e.target.value }, () => actualizarEventoInline(ev.id, { era: e.target.value })); }}
              placeholder="Era / edad"
              title="Era para agrupar la cronología"
              className={inp + " w-32"}
            />
            <select
              value={ev.estado}
              onChange={(e) => patch(ev.id, { estado: e.target.value as EstadoPublicacion }, () => actualizarEventoInline(ev.id, { estado: e.target.value as EstadoPublicacion }))}
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
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            {ev.importancia && <span className="rounded-full border border-border-base px-2 py-0.5 text-[11px] text-fg-muted">{ev.importancia}</span>}

            <div className="ml-auto flex items-center gap-1 text-xs">
              <Link href={`/admin/timeline/${ev.id}/editar`} className="rounded border border-border-base px-2 py-1 text-fg-secondary hover:text-fg">Editar</Link>
              <button type="button" onClick={() => borrar(ev.id)} className="rounded border border-error/40 px-2 py-1 text-error hover:bg-error/10">✕</button>
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
