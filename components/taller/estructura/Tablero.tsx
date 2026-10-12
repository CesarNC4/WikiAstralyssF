"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { asignarFase, cambiarPlantillaCapitulo } from "@/lib/actions/taller";
import type { TallerIndice } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { inputCls, PuntoEstado } from "../ui";

const MIME = "application/x-astralys-fase";

/**
 * Tablero de estructura (spec §7): un capítulo a la vez, una columna por fase
 * de su plantilla. Arrastrar un acto a otra columna cambia su fase. No hay
 * columna "sin fase": en un capítulo con plantilla todo acto tiene una.
 */
export function Tablero({ indice, capituloId }: { indice: TallerIndice; capituloId: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [sobre, setSobre] = useState<number | null>(null);

  const capitulos = indice.libros.flatMap((l) =>
    indice.capitulos.filter((c) => (c.libro ?? "") === l).sort((a, b) => a.orden - b.orden || a.id - b.id),
  );
  const cap = capitulos.find((c) => c.id === capituloId) ?? capitulos.find((c) => c.plantillaId != null) ?? capitulos[0];
  const plantilla = indice.plantillas.find((p) => p.id === cap?.plantillaId);
  const actos = indice.actos.filter((a) => a.capituloId === cap?.id);
  const sinPlantilla = capitulos.filter((c) => c.plantillaId == null);

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "No se pudo guardar.", "error");
      if (ok) toast(ok, "success");
      router.refresh();
    });

  const elegirPlantilla = (id: number) => {
    if (!cap) return;
    const p = indice.plantillas.find((x) => x.id === id);
    if (!confirm(`Todos los actos de «${cap.titulo}» pasarán a la primera fase de «${p?.nombre}». ¿Seguir?`)) return;
    ejecutar(() => cambiarPlantillaCapitulo(cap.id, id), "Plantilla aplicada.");
  };

  if (!cap) return <p className="px-6 py-10 text-sm italic text-fg-muted">Aún no hay capítulos.</p>;

  return (
    <div className="space-y-4 px-6 py-5">
      {sinPlantilla.length > 0 && (
        <p className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-2 text-xs text-warning">
          Sin plantilla todavía:{" "}
          {sinPlantilla.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/admin/taller/estructura?capitulo=${c.id}`} className="underline">
                {c.numero} — {c.titulo}
              </Link>
            </span>
          ))}
          . Todo capítulo necesita una.
        </p>
      )}

      <div className="flex items-center gap-3">
        <select
          value={cap.id}
          onChange={(e) => router.push(`/admin/taller/estructura?capitulo=${e.target.value}`)}
          className={cn(inputCls, "w-auto min-w-80")}
        >
          {capitulos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libro ? `${c.libro} · ` : ""}
              {c.numero} — {c.titulo}
            </option>
          ))}
        </select>
        <span className="text-xs text-fg-muted">Plantilla</span>
        <select
          value={plantilla?.id ?? ""}
          onChange={(e) => e.target.value && elegirPlantilla(Number(e.target.value))}
          disabled={pending || indice.plantillas.length === 0}
          className={cn(inputCls, "w-auto")}
        >
          {!plantilla && <option value="">— Elige plantilla —</option>}
          {indice.plantillas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <Link href={`/admin/taller/capitulos/${cap.id}`} className="ml-auto text-xs text-accent hover:underline">
          Abrir capítulo →
        </Link>
      </div>

      {indice.plantillas.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">
          Aún no hay plantillas.{" "}
          <Link href="/admin/taller/estructura?vista=plantillas" className="text-accent underline">
            Crea la primera
          </Link>
          .
        </p>
      ) : !plantilla ? (
        <p className="py-10 text-center text-sm text-fg-muted">Elige una plantilla para este capítulo y sus actos aparecerán en su primera fase.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {plantilla.fases.map((f) => {
            const color = f.color || "#9aa3b2";
            const suyos = actos.filter((a) => a.faseId === f.id);
            return (
              <div
                key={f.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(f.id);
                }}
                onDragLeave={() => setSobre((s) => (s === f.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const actoId = Number(e.dataTransfer.getData(MIME));
                  const acto = actos.find((a) => a.id === actoId);
                  if (!acto || acto.faseId === f.id) return;
                  ejecutar(() => asignarFase(actoId, f.id));
                }}
                className={cn(
                  "flex min-h-[60vh] w-72 shrink-0 flex-col rounded-xl border bg-surface/30 transition-colors",
                  sobre === f.id ? "border-border-glow bg-surface/60" : "border-border-base",
                )}
              >
                <div className="border-b-2 px-3 py-2" style={{ borderColor: color }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
                    {f.abreviatura ? `${f.abreviatura} · ` : ""}
                    {f.nombre}
                  </p>
                  {f.guia && <p className="mt-0.5 text-[11px] text-fg-muted">{f.guia}</p>}
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {suyos.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(MIME, String(a.id));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab rounded-lg border border-border-base bg-deep/80 px-3 py-2 hover:border-border-glow"
                    >
                      <div className="flex items-center gap-2">
                        <PuntoEstado estado={a.estadoPublicacion} />
                        <Link href={`/admin/taller/escribe?acto=${a.id}`} className="flex-1 truncate text-sm text-fg hover:text-accent">
                          {a.nombre}
                        </Link>
                        <span className="text-[10px] text-fg-muted">{a.etiqueta.replace("Acto ", "")}</span>
                      </div>
                      {a.pov.length > 0 && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-accent">
                          <Icon name="Users" size={11} /> {a.pov.map((p) => p.nombre).join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                  {suyos.length === 0 && <p className="px-1 text-xs italic text-fg-muted">Suelta aquí un acto.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
