"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { leerNota, guardarNota } from "@/lib/actions/notas";

/**
 * Cuaderno privado del autor sobre una ficha. No sale nunca al público: es el
 * sitio para apuntar lo que aún no has decidido sin ensuciar la ficha.
 *
 * Se guarda solo, con un respiro tras dejar de escribir, para que no dependa del
 * botón Guardar del formulario.
 */
export function NotaPrivada({ entidadTipo, entidadId }: { entidadTipo: string; entidadId: number }) {
  const toast = useToast();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [estado, setEstado] = useState<"" | "guardando" | "guardado">("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    try {
      setTexto(await leerNota(entidadTipo, entidadId));
    } catch {
      toast("No se pudo cargar la nota.", "error");
    } finally {
      setCargado(true);
    }
  }, [entidadTipo, entidadId, toast]);

  const alternar = () => {
    const abriendo = !abierto;
    setAbierto(abriendo);
    if (abriendo && !cargado) void cargar();
  };

  const escribir = (valor: string) => {
    setTexto(valor);
    setEstado("guardando");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      try {
        await guardarNota(entidadTipo, entidadId, valor);
        setEstado("guardado");
      } catch {
        setEstado("");
        toast("No se pudo guardar la nota.", "error");
      }
    }, 700);
  };

  return (
    <section className="rounded-xl border border-border-base bg-surface/30">
      <button
        type="button"
        onClick={alternar}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={abierto}
      >
        <Icon name="NotebookPen" size={15} className="text-warning" />
        <span className="text-sm font-medium text-fg">Nota privada</span>
        {cargado && texto.trim() !== "" && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
        <span className="ml-auto text-xs text-fg-muted">
          {estado === "guardando" ? "guardando…" : estado === "guardado" ? "guardado" : "solo tú la ves"}
        </span>
        <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={14} className="text-fg-muted" />
      </button>

      {abierto && (
        <div className="px-3 pb-3">
          {!cargado ? (
            <p className="text-xs text-fg-muted">Cargando…</p>
          ) : (
            <textarea
              value={texto}
              onChange={(e) => escribir(e.target.value)}
              rows={6}
              placeholder="Lo que aún no has decidido, dudas, recordatorios…"
              className="w-full resize-y rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-border-glow"
            />
          )}
        </div>
      )}
    </section>
  );
}
