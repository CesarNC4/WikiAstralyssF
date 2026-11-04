"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { leerCamposOcultos, marcarCampo } from "@/lib/actions/notas";
import { marcarFechaOculta } from "@/lib/actions/fechas";

/**
 * Los candados del panel (docs/area-ia.md, Fase 4): ocultar al público un campo,
 * una conexión o una fecha. Lo oculto sigue aquí, editable; el lector ve "???".
 *
 * Los candados de campo y de fecha se guardan al momento, como las conexiones: no
 * dependen del botón "Guardar" del formulario.
 */

interface Candados {
  ocultos: Set<string>;
  alternar: (campo: string) => void;
}

const Contexto = createContext<Candados | null>(null);

export function useCandados() {
  return useContext(Contexto);
}

/** Da candado a los `Field` con `campo` que haya dentro. Sin id (ficha nueva) no hay candados. */
export function CandadosFicha({ entidad, id, children }: { entidad: string; id: number | null | undefined; children: ReactNode }) {
  const toast = useToast();
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    leerCamposOcultos(entidad, id)
      .then((r) => {
        if (vivo) setOcultos(new Set(r));
      })
      .catch(() => {
        if (vivo) toast("No se pudo cargar lo oculto.", "error");
      });
    return () => {
      vivo = false;
    };
  }, [entidad, id, toast]);

  const alternar = useCallback(
    (campo: string) => {
      if (!id) return;
      const estaba = ocultos.has(campo);
      const previo = ocultos;
      const siguiente = new Set(ocultos);
      if (estaba) siguiente.delete(campo);
      else siguiente.add(campo);
      setOcultos(siguiente);
      marcarCampo(entidad, id, campo, estaba)
        .then((r) => setOcultos(new Set(r)))
        .catch(() => {
          setOcultos(previo);
          toast("No se pudo cambiar la visibilidad.", "error");
        });
    },
    [entidad, id, ocultos, toast],
  );

  const valor = useMemo(() => (id ? { ocultos, alternar } : null), [id, ocultos, alternar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** El botón del candado, abierto o cerrado. Sirve para campos, filas y fechas. */
export function BotonOculto({
  oculto,
  onClick,
  disabled,
  texto,
  titulo,
}: {
  oculto: boolean;
  onClick: () => void;
  disabled?: boolean;
  texto?: string;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={oculto}
      aria-label={oculto ? "Oculto al público: pulsa para mostrarlo" : "Visible: pulsa para ocultarlo"}
      title={titulo ?? (oculto ? 'Oculto: el público ve "???". Pulsa para mostrarlo.' : "Visible. Pulsa para ocultarlo al público.")}
      onClick={(e) => {
        // Dentro de un <label>, el clic no debe llevar el foco al campo.
        e.preventDefault();
        onClick();
      }}
      className={
        "inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] normal-case tracking-normal transition-colors disabled:opacity-40 " +
        (oculto ? "bg-warning/15 text-warning" : "text-fg-muted/60 hover:text-fg")
      }
    >
      <Icon name={oculto ? "Lock" : "LockOpen"} size={12} />
      {oculto ? "oculto" : texto}
    </button>
  );
}

/** Candado de un campo de la ficha. Fuera de `CandadosFicha` no pinta nada. */
export function CandadoCampo({ campo, texto }: { campo: string; texto?: string }) {
  const c = useCandados();
  if (!c) return null;
  return <BotonOculto oculto={c.ocultos.has(campo)} onClick={() => c.alternar(campo)} texto={texto} />;
}

/** Candado de una fecha de la ficha. Se guarda al momento; sin fecha guardada no hay nada que ocultar. */
export function CandadoFecha({
  entidad,
  id,
  rol,
  inicial,
  hayFecha,
}: {
  entidad: string;
  id: number;
  rol: string;
  inicial: boolean;
  hayFecha: boolean;
}) {
  const toast = useToast();
  const [oculto, setOculto] = useState(inicial);
  return (
    <BotonOculto
      oculto={oculto}
      disabled={!hayFecha}
      titulo={hayFecha ? undefined : "Guarda la fecha para poder ocultarla."}
      onClick={() => {
        const siguiente = !oculto;
        setOculto(siguiente);
        marcarFechaOculta(entidad, id, rol, siguiente).then((r) => {
          if (r.ok) return;
          setOculto(!siguiente);
          toast(r.error, "error");
        });
      }}
    />
  );
}
