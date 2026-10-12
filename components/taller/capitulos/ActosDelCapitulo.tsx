"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { crearActo } from "@/lib/actions/taller";
import type { ActoTaller, FaseTaller } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { botonCls, inputCls, InsigniaFase, PuntoEstado } from "../ui";

/** Los actos de un capítulo, con alta rápida (la fase se elige al crear, §7). */
export function ActosDelCapitulo({
  capituloId,
  actos,
  fases,
  conPlantilla,
}: {
  capituloId: number;
  actos: ActoTaller[];
  fases: FaseTaller[];
  conPlantilla: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [faseId, setFaseId] = useState<number | null>(null);
  const porId = new Map(fases.map((f) => [f.id, f]));

  return (
    <div className="space-y-2">
      <ol className="space-y-1">
        {actos.map((a) => (
          <li key={a.id}>
            <Link
              href={`/admin/taller/escribe?acto=${a.id}`}
              className="flex items-center gap-3 rounded-lg border border-border-base bg-surface/40 px-3 py-2 hover:border-border-glow"
            >
              <PuntoEstado estado={a.estadoPublicacion} />
              <span className="w-16 shrink-0 text-xs text-fg-muted">{a.etiqueta}</span>
              <span className="flex-1 truncate text-sm text-fg">{a.nombre}</span>
              {a.pov.length > 0 && <span className="truncate text-xs text-accent">POV: {a.pov.map((p) => p.nombre).join(", ")}</span>}
              <InsigniaFase fase={porId.get(a.faseId ?? -1)} />
            </Link>
          </li>
        ))}
        {actos.length === 0 && <li className="text-sm italic text-fg-muted">Este capítulo aún no tiene actos.</li>}
      </ol>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nombre.trim()) return;
          start(async () => {
            const r = await crearActo({ capituloId, nombre: nombre.trim(), faseId: conPlantilla ? faseId : null });
            if (!r.ok) return toast(r.error, "error");
            setNombre("");
            toast("Acto creado.", "success");
            router.refresh();
          });
        }}
      >
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuevo acto…" className={cn(inputCls, "flex-1")} />
        {conPlantilla && (
          <select value={faseId ?? ""} onChange={(e) => setFaseId(e.target.value ? Number(e.target.value) : null)} className={cn(inputCls, "w-48")}>
            <option value="">Fase…</option>
            {fases.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        )}
        <button type="submit" disabled={pending || !nombre.trim() || (conPlantilla && faseId == null)} className={botonCls}>
          <Icon name="Plus" size={14} /> Acto
        </button>
      </form>
    </div>
  );
}
