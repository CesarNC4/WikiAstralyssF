"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { subInp } from "@/components/admin/blocks/shared";
import { buscarFichas, crearBorradorRapido, type OpcionFicha } from "@/lib/actions/vinculos";
import { entityByKey } from "@/lib/entities";
import { CUALQUIERA } from "@/lib/relaciones/registro";

/**
 * Buscador de fichas para vincular. Con 210 personajes y sólo 4 con imagen, una
 * lista desplegable no sirve: hace falta filtrar por texto y ver contexto
 * (título, estado) para no confundir homónimos.
 *
 * Permite marcar varias y vincularlas de golpe, y crear la ficha que falta como
 * borrador sin salir de aquí.
 */
export function SelectorFicha({
  entidad,
  yaVinculados,
  onElegir,
  autoFocus,
  onCerrar,
}: {
  /** Entidad objetivo, o `*` para aceptar fichas de cualquier tipo. */
  entidad: string;
  /** Ids ya presentes en el bloque: se marcan, pero no se bloquean. */
  yaVinculados: number[];
  onElegir: (fichas: OpcionFicha[]) => Promise<void> | void;
  autoFocus?: boolean;
  onCerrar?: () => void;
}) {
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<OpcionFicha[]>([]);
  const [marcadas, setMarcadas] = useState<OpcionFicha[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const peticion = useRef(0);

  // Se busca en el servidor con un respiro para no lanzar una consulta por tecla.
  useEffect(() => {
    const mio = ++peticion.current;
    // El indicador se enciende dentro del temporizador, no en el cuerpo del
    // efecto: hacerlo aquí provocaría un render en cascada en cada tecla.
    const t = setTimeout(() => {
      setCargando(true);
      buscarFichas(entidad, q)
        .then((r) => { if (peticion.current === mio) setOpciones(r); })
        .catch(() => { if (peticion.current === mio) setOpciones([]); })
        .finally(() => { if (peticion.current === mio) setCargando(false); });
    }, 180);
    return () => clearTimeout(t);
  }, [entidad, q]);

  const vinculados = new Set(yaVinculados);
  const marcadasIds = new Set(marcadas.map((m) => `${m.entidad}:${m.id}`));

  const alternar = (o: OpcionFicha) => {
    const clave = `${o.entidad}:${o.id}`;
    setMarcadas((prev) =>
      marcadasIds.has(clave) ? prev.filter((m) => `${m.entidad}:${m.id}` !== clave) : [...prev, o],
    );
  };

  const confirmar = async (fichas: OpcionFicha[]) => {
    if (fichas.length === 0) return;
    setGuardando(true);
    try {
      await onElegir(fichas);
      setMarcadas([]);
      setQ("");
      onCerrar?.();
    } finally {
      setGuardando(false);
    }
  };

  const crearYVincular = async () => {
    const nombre = q.trim();
    if (!nombre || entidad === CUALQUIERA) return;
    setGuardando(true);
    try {
      const ficha = await crearBorradorRapido(entidad, nombre);
      if (ficha) await onElegir([ficha]);
      setQ("");
      onCerrar?.();
    } finally {
      setGuardando(false);
    }
  };

  const sinCoincidencias = !cargando && q.trim() !== "" && opciones.length === 0;
  const puedeCrear = entidad !== CUALQUIERA && q.trim() !== "";

  return (
    <div className="rounded-lg border border-border-glow bg-elevated p-2">
      <div className="flex items-center gap-2">
        <Icon name="Search" size={14} className="text-fg-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Buscar ficha…"
          className={subInp + " flex-1"}
        />
        {onCerrar && (
          <button type="button" onClick={onCerrar} className="text-fg-muted hover:text-fg" aria-label="Cerrar buscador">
            ✕
          </button>
        )}
      </div>

      <div className="mt-2 max-h-64 overflow-auto">
        {cargando && <p className="px-2 py-1.5 text-xs text-fg-muted">Buscando…</p>}

        {!cargando &&
          opciones.map((o) => {
            const clave = `${o.entidad}:${o.id}`;
            const yaEsta = vinculados.has(o.id);
            return (
              <button
                key={clave}
                type="button"
                onClick={() => alternar(o)}
                className={
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface " +
                  (marcadasIds.has(clave) ? "bg-accent/10 text-fg" : "text-fg-secondary")
                }
              >
                <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded">
                  <EntityImage src={o.imagenUrl} alt={o.label} name={o.label} sizes="24px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {(o.detalle || entidad === CUALQUIERA) && (
                    <span className="block truncate text-xs text-fg-muted">
                      {[entidad === CUALQUIERA ? entityByKey(o.entidad)?.singular : null, o.detalle]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                {o.estado && o.estado !== "publicado" && (
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
                    {o.estado}
                  </span>
                )}
                {/* Los duplicados están permitidos: se avisa, no se bloquea. */}
                {yaEsta && <span className="shrink-0 text-[10px] text-warning">ya vinculado</span>}
                {marcadasIds.has(clave) && <Icon name="Check" size={14} className="shrink-0 text-accent" />}
              </button>
            );
          })}

        {sinCoincidencias && !puedeCrear && (
          <p className="px-2 py-1.5 text-xs text-fg-muted">Sin coincidencias.</p>
        )}

        {sinCoincidencias && puedeCrear && (
          <button
            type="button"
            onClick={crearYVincular}
            disabled={guardando}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-accent hover:bg-surface disabled:opacity-50"
          >
            <Icon name="Plus" size={14} />
            Crear <strong className="font-medium">{q.trim()}</strong> como borrador y vincular
          </button>
        )}
      </div>

      {marcadas.length > 0 && (
        <div className="mt-2 flex items-center gap-2 border-t border-border-base pt-2">
          <span className="text-xs text-fg-muted">{marcadas.length} marcadas</span>
          <button
            type="button"
            onClick={() => confirmar(marcadas)}
            disabled={guardando}
            className="ml-auto rounded-lg bg-primary px-3 py-1 text-sm font-medium text-void disabled:opacity-50"
          >
            {guardando ? "Vinculando…" : "Vincular"}
          </button>
        </div>
      )}
    </div>
  );
}
