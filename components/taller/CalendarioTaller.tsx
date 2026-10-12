"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarioAnual } from "@/components/cronologia/CalendarioAnual";
import { BarraFiltros, useFiltros } from "@/components/cronologia/Filtros";
import { useToast } from "@/components/admin/Toast";
import { crearEventoEnFecha } from "@/lib/actions/fechas";
import type { Suceso } from "@/lib/cronologia";
import type { Calendario, Extremo } from "@/lib/fechas";

/**
 * Calendario del taller: el mismo calendario anual que ve el público, con todo
 * (también lo no publicado) y botones para crear eventos donde se pulse.
 */
export function CalendarioTaller({ sucesos, cal }: { sucesos: Suceso[]; cal: Calendario }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const { f, setF, filtrados, ocultos } = useFiltros(sucesos, { soloImportantes: false });
  const [nuevo, setNuevo] = useState<{ donde: Extremo; etiqueta: string } | null>(null);
  const [titulo, setTitulo] = useState("");
  const [importante, setImportante] = useState(false);
  const [creado, setCreado] = useState<number | null>(null);

  const crear = () =>
    start(async () => {
      if (!nuevo) return;
      const r = await crearEventoEnFecha({
        titulo,
        fecha: { ini: nuevo.donde, fin: null, aproximada: false },
        importante,
      });
      if (!r.ok) return toast(r.error, "error");
      toast("Evento creado en borrador.", "success");
      setCreado(r.data.id);
      setNuevo(null);
      setTitulo("");
      setImportante(false);
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <BarraFiltros sucesos={sucesos} f={f} setF={setF} mostrados={filtrados.length} ocultos={ocultos} />

      {creado != null && (
        <p className="mb-4 rounded-xl border border-border-glow/60 bg-deep/40 px-4 py-2 text-sm text-fg-secondary">
          Evento creado en borrador.{" "}
          <Link href={`/admin/timeline/${creado}/editar`} className="text-accent hover:underline">
            Completarlo y publicarlo →
          </Link>
        </p>
      )}

      <CalendarioAnual
        sucesos={filtrados}
        cal={cal}
        onCrear={(donde, etiqueta) => {
          setNuevo({ donde, etiqueta });
          setCreado(null);
        }}
      />

      {nuevo && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-void/60 p-4 backdrop-blur-sm" onClick={() => setNuevo(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
            className="w-full max-w-md space-y-3 rounded-2xl border border-border-glow bg-deep p-5"
          >
            <h2 className="font-display text-lg text-fg">Nuevo evento</h2>
            <p className="text-xs text-fg-muted">En {nuevo.etiqueta}. Nace en borrador; luego puedes darle rango, acto, personajes…</p>
            <input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Qué pasó"
              className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-border-glow"
            />
            <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
              <input type="checkbox" checked={importante} onChange={(e) => setImportante(e.target.checked)} />
              Importante (sale en la cronología destacada)
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNuevo(null)} className="rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-secondary hover:text-fg">
                Cancelar
              </button>
              <button type="submit" disabled={pending || !titulo.trim()} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-void disabled:opacity-50">
                {pending ? "Creando…" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
