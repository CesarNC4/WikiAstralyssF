"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { anioDeClave, diasPorAnio, edadEn, formatoAnio, textoEdad, type Calendario, type TextosFecha } from "@/lib/fechas";
import { useLectura, useModoFecha } from "./store";

/** Una fecha en la lectura que haya elegido el visitante. */
export function FechaTexto({ t, className }: { t: TextosFecha; className?: string }) {
  const modo = useModoFecha();
  return <span className={className}>{t[modo]}</span>;
}

/** Interruptor "Eras / Año absoluto" (§13, "Cómo lo ve el público"). */
export function ConmutadorFechas({ className }: { className?: string }) {
  const modo = useModoFecha();
  const setModo = useLectura((s) => s.setModo);
  return (
    <div
      role="group"
      aria-label="Cómo leer las fechas"
      className={cn("inline-flex overflow-hidden rounded-full border border-border-base text-[11px]", className)}
    >
      {(
        [
          ["eras", "Eras"],
          ["absoluto", "Año absoluto"],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          type="button"
          aria-pressed={modo === m}
          onClick={() => setModo(m)}
          className={cn("px-3 py-1 transition-colors", modo === m ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Edad de un personaje en el momento de lectura, con el control para cambiar
 * ese momento a mano. `nacimiento` y `muerte` son días absolutos.
 */
export function EdadLectura({ cal, nacimiento, muerte }: { cal: Calendario; nacimiento: number; muerte: number | null }) {
  const modo = useModoFecha();
  const { momento, origen, setMomento } = useLectura();
  const actual = momento ?? 0;
  const anio = anioDeClave(cal, actual);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(String(anio));

  const aplicar = () => {
    if (/^-?\d+$/.test(texto.trim())) setMomento(Number(texto) * diasPorAnio(cal));
    setEditando(false);
  };

  return (
    <span className="block">
      <span>{textoEdad(edadEn(cal, nacimiento, muerte, actual))}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-fg-muted">
        {editando ? (
          <form
            className="inline-flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              aplicar();
            }}
          >
            en el año absoluto
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/[^\d-]/g, ""))}
              onBlur={aplicar}
              inputMode="numeric"
              aria-label="Año del momento de lectura"
              className="w-16 rounded border border-border-base bg-surface px-1 font-mono text-fg outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTexto(String(anio));
              setEditando(true);
            }}
            className="underline decoration-dotted underline-offset-2 hover:text-fg"
            title="Cambiar el momento de lectura"
          >
            {origen ?? `en ${formatoAnio(cal, anio, modo).replace(/^Año/, "el año")}`}
          </button>
        )}
        {momento != null && !editando && (
          <button type="button" onClick={() => setMomento(null)} className="hover:text-fg" title="Volver al año 0">
            · volver al año 0
          </button>
        )}
      </span>
    </span>
  );
}

/**
 * Fija el momento de lectura al abrir un capítulo o un acto (§13). No pinta
 * nada. Se queda puesto al salir: así la edad de un personaje enlazado desde el
 * capítulo es la que tenía en ese capítulo.
 */
export function FijarMomento({ clave, origen }: { clave: number; origen: string }) {
  const setMomento = useLectura((s) => s.setMomento);
  useEffect(() => {
    setMomento(clave, origen);
  }, [clave, origen, setMomento]);
  return null;
}
