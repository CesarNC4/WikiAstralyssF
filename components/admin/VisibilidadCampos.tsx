"use client";

import { useCallback, useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { getEntidadConfig } from "@/lib/admin/fields";
import { leerCamposOcultos, marcarCampo } from "@/lib/actions/notas";

/**
 * Oculta campos concretos de una ficha al público sin borrarlos: la edad de un
 * personaje mientras sea un misterio, el paradero de un artefacto, el desenlace
 * de una misión.
 *
 * La ausencia de marca significa visible, así que una ficha sin nada marcado se
 * comporta exactamente como antes.
 */
export function VisibilidadCampos({ entidad, ownerId }: { entidad: string; ownerId: number }) {
  const toast = useToast();
  const config = getEntidadConfig(entidad);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [cargado, setCargado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setOcultos(await leerCamposOcultos(entidad, ownerId));
    } catch {
      toast("No se pudo cargar la visibilidad.", "error");
    } finally {
      setCargado(true);
    }
  }, [entidad, ownerId, toast]);

  const alternar = () => {
    const abriendo = !abierto;
    setAbierto(abriendo);
    if (abriendo && !cargado) void cargar();
  };

  // Este control se apoya en la configuración declarativa del admin genérico.
  // Las fichas con formulario propio (personaje, organización, familia, gremio)
  // no la tienen y por ahora quedan fuera.
  if (!config) return null;

  const cambiar = async (campo: string, visible: boolean) => {
    const previo = ocultos;
    setOcultos(visible ? ocultos.filter((c) => c !== campo) : [...ocultos, campo]);
    try {
      setOcultos(await marcarCampo(entidad, ownerId, campo, visible));
    } catch {
      setOcultos(previo);
      toast("No se pudo cambiar la visibilidad.", "error");
    }
  };

  const n = cargado ? ocultos.length : null;

  return (
    <section className="rounded-xl border border-border-base bg-surface/30">
      <button
        type="button"
        onClick={alternar}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={abierto}
      >
        <Icon name="EyeOff" size={15} className="text-fg-muted" />
        <span className="text-sm font-medium text-fg">Campos ocultos</span>
        {n !== null && n > 0 && (
          <span className="rounded-full bg-surface px-1.5 text-xs text-warning">{n}</span>
        )}
        <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={14} className="ml-auto text-fg-muted" />
      </button>

      {abierto && (
        <div className="px-3 pb-3">
          {!cargado ? (
            <p className="text-xs text-fg-muted">Cargando…</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-fg-muted">
                Lo marcado no se muestra en la ficha pública, pero sigue guardado y editable aquí.
              </p>
              <ul className="space-y-1">
                {config.fields.map((f) => {
                  const oculto = ocultos.includes(f.name);
                  return (
                    <li key={f.name}>
                      <label className="flex items-center gap-2 text-sm text-fg-secondary">
                        <input
                          type="checkbox"
                          checked={oculto}
                          onChange={(e) => void cambiar(f.name, !e.target.checked)}
                        />
                        <span className={oculto ? "text-warning" : undefined}>{f.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
