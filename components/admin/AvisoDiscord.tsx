"use client";

import { useCallback, useEffect, useState } from "react";
import { opcionesAviso, type OpcionesAviso } from "@/lib/actions/discord";
import { ES_TIPO_CON_AVISO } from "@/lib/discord-tipos";
import { OpcionesCanal } from "@/components/admin/CanalesDiscord";
import { cn } from "@/lib/utils";

/**
 * Lo que el autor elige sobre el aviso a Discord al guardar. Viaja en el campo
 * `aviso` del formulario (JSON) y la acción lo lee con `eleccionDe`.
 * `canal`: ausente = el de por defecto; `null` = no avisar.
 */
export interface ValorAviso {
  canal?: string | null;
  cambio?: boolean;
  nota?: string;
}

/** El estado del aviso de un formulario. Tras guardar bien, `reiniciar()`: lo siguiente ya es otro aviso. */
export function useAviso() {
  const [valor, setValor] = useState<ValorAviso>({});
  const [version, setVersion] = useState(0);
  const reiniciar = useCallback(() => {
    setValor({});
    setVersion((v) => v + 1);
  }, []);
  return { valor, reiniciar, props: { valor, onChange: setValor, version } };
}

/**
 * El aviso a Discord, junto al estado de publicación de una ficha.
 *  - Si se va a estrenar (nunca se ha publicado y está en Publicado): el canal,
 *    ya elegido, o «No avisar».
 *  - Si ya está publicada: «Avisar del cambio», con su canal y una nota.
 * No sale si Discord no responde, si el tipo no avisa o si la ficha no va a quedar publicada.
 */
export function AvisoDiscord({
  tipo,
  id,
  estado,
  valor,
  onChange,
  version = 0,
  hacia = "arriba",
}: {
  tipo: string;
  id?: number | null;
  estado: string;
  valor: ValorAviso;
  onChange: (v: ValorAviso) => void;
  /** Cambia tras cada guardado, para volver a preguntar si la ficha ya está publicada. */
  version?: number;
  /** Dónde se abre el panel: hacia arriba en la barra de abajo, hacia abajo en un formulario. */
  hacia?: "arriba" | "abajo";
}) {
  const [op, setOp] = useState<OpcionesAviso | null>(null);
  const [abierto, setAbierto] = useState(false);
  const avisa = ES_TIPO_CON_AVISO.has(tipo);

  useEffect(() => {
    if (!avisa) return;
    let vivo = true;
    opcionesAviso(tipo, id ?? null)
      .then((o) => vivo && setOp(o))
      .catch(() => vivo && setOp(null));
    return () => {
      vivo = false;
    };
  }, [avisa, tipo, id, version]);

  if (!avisa || !op?.activo || estado !== "publicado") return null;
  if (op.noSeVe) {
    return (
      <span title={op.noSeVe} className="inline-block max-w-[22rem] truncate rounded-lg border border-border-base px-3 py-2 text-sm text-fg-muted">
        🔕 Sin aviso: no se ve todavía
      </span>
    );
  }

  const canal = valor.canal === undefined ? op.sugerido : valor.canal;
  const nombre = op.canales.find((c) => c.id === canal)?.nombre;
  const cambio = op.yaPublicada;
  const encendido = cambio ? Boolean(valor.cambio) && Boolean(nombre) : Boolean(nombre);
  const rotulo = cambio
    ? encendido
      ? `📝 Aviso del cambio en #${nombre}`
      : valor.cambio
        ? "📝 Aviso del cambio: elige canal"
        : "📝 Avisar del cambio"
    : encendido
      ? `🔔 Aviso en #${nombre}`
      : "🔕 Sin aviso";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        title="Aviso en Discord"
        className={cn(
          "max-w-[22rem] truncate rounded-lg border px-3 py-2 text-sm",
          encendido ? "border-accent/50 bg-accent/10 text-fg" : "border-border-base text-fg-muted hover:text-fg",
        )}
      >
        {rotulo}
      </button>
      {abierto && (
        <>
          <button type="button" aria-label="Cerrar" className="fixed inset-0 z-40 cursor-default" onClick={() => setAbierto(false)} />
          <div
            className={cn(
              "absolute right-0 z-50 w-80 space-y-3 rounded-lg border border-border-base bg-deep p-3 text-sm shadow-xl",
              hacia === "arriba" ? "bottom-full mb-2" : "top-full mt-2",
            )}
          >
            {cambio ? (
              <>
                <label className="flex items-center gap-2 text-fg">
                  <input
                    type="checkbox"
                    checked={Boolean(valor.cambio)}
                    onChange={(e) => onChange({ ...valor, cambio: e.target.checked })}
                  />
                  Avisar del cambio en Discord al guardar
                </label>
                {valor.cambio && (
                  <>
                    <SelectCanal op={op} canal={canal} onChange={(c) => onChange({ ...valor, canal: c })} />
                    <label className="block">
                      <span className="mb-1 block text-xs text-fg-muted">Qué cambió (opcional, lo verán los jugadores)</span>
                      <textarea
                        value={valor.nota ?? ""}
                        onChange={(e) => onChange({ ...valor, nota: e.target.value })}
                        rows={3}
                        maxLength={1000}
                        className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none"
                      />
                    </label>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="text-fg">Es su primera publicación: se avisa al guardar.</p>
                <SelectCanal op={op} canal={canal} onChange={(c) => onChange({ ...valor, canal: c })} />
              </>
            )}
            <p className="text-xs text-fg-muted">El aviso solo lleva lo que ven los jugadores: nada de lo oculto.</p>
          </div>
        </>
      )}
    </div>
  );
}

function SelectCanal({ op, canal, onChange }: { op: OpcionesAviso; canal: string | null; onChange: (c: string | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">Canal</span>
      <select
        value={canal ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none"
      >
        <option value="">— No avisar —</option>
        <OpcionesCanal canales={op.canales} />
      </select>
    </label>
  );
}
