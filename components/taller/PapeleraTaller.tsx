"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { eliminarDelTaller, restaurarDelTaller } from "@/lib/actions/taller";
import type { EnPapelera } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { botonCls } from "./ui";

const NOMBRE: Record<EnPapelera["tipo"], string> = {
  capitulos: "Capítulo",
  actos: "Acto",
  arcos: "Arco",
  hojas: "Hoja de trama",
  hilos: "Hilo",
};

/** Papelera del taller (spec §9): restaurar o borrar para siempre. */
export function PapeleraTaller({ items }: { items: EnPapelera[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "No se pudo.", "error");
      toast(ok, "success");
      router.refresh();
    });

  if (items.length === 0) return <p className="py-16 text-center text-sm italic text-fg-muted">La papelera está vacía.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-2 px-6 py-5">
      <p className="mb-3 text-xs text-fg-muted">
        Lo restaurado vuelve al final de su libro o de su capítulo. Borrar para siempre no se puede deshacer.
      </p>
      {items.map((it) => (
        <div key={`${it.tipo}-${it.id}`} className="flex items-center gap-3 rounded-xl border border-border-base bg-surface/40 px-4 py-3">
          <span className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-fg-muted">{NOMBRE[it.tipo]}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-fg">{it.nombre}</span>
            <span className="block truncate text-xs text-fg-muted">
              {[it.detalle, `borrado el ${it.eliminadoEn.toLocaleDateString("es")}`].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button type="button" disabled={pending} onClick={() => accion(() => restaurarDelTaller(it.tipo, it.id), "Restaurado.")} className={botonCls}>
            Restaurar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`¿Borrar «${it.nombre}» para siempre? No se puede deshacer.`))
                accion(() => eliminarDelTaller(it.tipo, it.id), "Borrado para siempre.");
            }}
            className={cn(botonCls, "hover:text-error")}
          >
            <Icon name="Trash2" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
