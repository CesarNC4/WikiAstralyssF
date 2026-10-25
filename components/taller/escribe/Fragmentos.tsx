"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { FechaInput } from "@/components/admin/FechaInput";
import { BloqueVinculos } from "@/components/admin/vinculos/BloqueVinculos";
import { bloqueDe } from "@/lib/relaciones/registro";
import {
  borrarFragmento,
  crearFragmento,
  guardarFragmento,
  reordenarFragmentos,
  type FragmentoCambios,
  type ResultadoFragmentos,
} from "@/lib/actions/taller";
import { validarFecha, type Calendario, type Fecha } from "@/lib/fechas";
import type { FragmentoEditor, FragmentosActo } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { botonCls, inputCls } from "../ui";

type Vista = "lectura" | "fecha";
type Estado = FragmentosActo & { povAnadido: boolean };

/**
 * Fragmentos del acto (docs/fragmentos-y-musica.md §2.4): una lista en orden de
 * lectura, cada uno con POV, título, enlace y fecha. Se guarda al momento, como
 * los vínculos: cada acción devuelve el bloque entero y el editor lo pinta tal
 * cual. El orden se cambia arrastrando, solo en la vista "Lectura".
 */
export function Fragmentos({
  actoId,
  inicial,
  personajes,
  cal,
  onCambio,
}: {
  actoId: number;
  inicial: FragmentosActo;
  personajes: { id: number; nombre: string }[];
  cal: Calendario | null;
  /** Para que el editor del acto actualice su fecha y el bloque POV. */
  onCambio: (estado: Estado) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [lista, setLista] = useState(inicial.fragmentos);
  const [vista, setVista] = useState<Vista>("lectura");
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  const aplicar = (r: ResultadoFragmentos, ok?: string) => {
    if (!r.ok) {
      toast(r.error, "error");
      return;
    }
    setLista(r.data.fragmentos);
    onCambio(r.data);
    if (ok) toast(ok, "success");
  };

  const ejecutar = (fn: () => Promise<ResultadoFragmentos>, ok?: string) =>
    start(async () => aplicar(await fn(), ok));

  const guardar = (id: number, cambios: FragmentoCambios) => ejecutar(() => guardarFragmento(id, cambios));

  // Los POV ya usados en el acto, primero: son los que más se repiten.
  const opcionesPov = useMemo(() => {
    const usados = new Set(lista.map((f) => f.personajeId).filter((x): x is number => x != null));
    return {
      usados: personajes.filter((p) => usados.has(p.id)),
      resto: personajes.filter((p) => !usados.has(p.id)),
    };
  }, [lista, personajes]);

  const visibles = vista === "lectura" ? lista : [...lista].sort((a, b) => (a.clave ?? Infinity) - (b.clave ?? Infinity));
  const numero = new Map(lista.map((f, i) => [f.id, i + 1]));

  const soltar = (destinoId: number) => {
    setSobre(null);
    if (arrastrado == null || arrastrado === destinoId) return;
    const ids = lista.map((f) => f.id).filter((id) => id !== arrastrado);
    ids.splice(ids.indexOf(destinoId), 0, arrastrado);
    // Optimista: se reordena ya; si el servidor lo rechaza, vuelve como estaba.
    const antes = lista;
    setLista(ids.map((id) => lista.find((f) => f.id === id)!));
    setArrastrado(null);
    ejecutar(async () => {
      const r = await reordenarFragmentos(actoId, ids);
      if (!r.ok) setLista(antes);
      return r;
    });
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-lg text-fg">Fragmentos</h2>
        {lista.length > 1 && (
          <div role="group" aria-label="Orden de los fragmentos" className="flex overflow-hidden rounded-lg border border-border-base text-xs">
            {(
              [
                ["lectura", "Lectura"],
                ["fecha", "Por fecha"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista === v}
                onClick={() => setVista(v)}
                className={cn("px-3 py-1", vista === v ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {pending && <span className="text-xs text-fg-muted">Guardando…</span>}
      </div>
      <p className="text-xs text-fg-muted">
        Cada tramo del acto con su POV, su enlace y su fecha. Se guardan al momento y son públicos en la ficha del acto.
        {vista === "lectura" && lista.length > 1 && " Arrastra para cambiar el orden de lectura."}
      </p>

      <div className="space-y-2">
        {visibles.map((f) => (
          <div
            key={f.id}
            data-fragmento
            onDragOver={(e) => {
              if (vista !== "lectura" || arrastrado == null) return;
              e.preventDefault();
              setSobre(f.id);
            }}
            onDragLeave={() => setSobre((s) => (s === f.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              soltar(f.id);
            }}
            className={cn(
              "rounded-xl border bg-surface/30 p-3",
              sobre === f.id ? "border-border-glow bg-surface" : "border-border-base",
              arrastrado === f.id && "opacity-50",
            )}
          >
            <FilaFragmento
              fragmento={f}
              numero={numero.get(f.id) ?? 0}
              arrastrable={vista === "lectura"}
              onAgarrar={(e) => {
                setArrastrado(f.id);
                e.dataTransfer.effectAllowed = "move";
                // Firefox no arrastra nada sin datos.
                e.dataTransfer.setData("text/plain", String(f.id));
                // Se arrastra desde el asa, pero lo que se ve moverse es la fila.
                const fila = e.currentTarget.closest("[data-fragmento]");
                if (fila) e.dataTransfer.setDragImage(fila, 16, 16);
              }}
              onSoltarAgarre={() => {
                setArrastrado(null);
                setSobre(null);
              }}
              opcionesPov={opcionesPov}
              cal={cal}
              onGuardar={(cambios) => guardar(f.id, cambios)}
              onBorrar={() => {
                if (!confirm(`¿Borrar el fragmento ${numero.get(f.id)}${f.titulo ? ` «${f.titulo}»` : ""}? No va a la papelera.`)) return;
                ejecutar(() => borrarFragmento(f.id), "Fragmento borrado.");
              }}
            />
          </div>
        ))}
        {lista.length === 0 && <p className="text-xs italic text-fg-muted">Sin fragmentos: el acto se lee de corrido.</p>}
      </div>

      <button
        type="button"
        disabled={pending}
        // El POV del último fragmento suele seguir en el siguiente: es un buen punto de partida.
        onClick={() => ejecutar(() => crearFragmento(actoId, lista.at(-1)?.personajeId ?? null))}
        className={botonCls}
      >
        <Icon name="Plus" size={13} /> Añadir fragmento
      </button>
    </section>
  );
}

const misma = (a: Fecha | null, b: Fecha | null) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Una fila. Título y enlace se guardan al salir del campo y el POV al elegirlo.
 * La fecha, al salir del grupo de la fecha: guardarla con cada tecla mandaría al
 * servidor años a medio escribir.
 */
function FilaFragmento({
  fragmento: f,
  numero,
  arrastrable,
  onAgarrar,
  onSoltarAgarre,
  opcionesPov,
  cal,
  onGuardar,
  onBorrar,
}: {
  fragmento: FragmentoEditor;
  numero: number;
  arrastrable: boolean;
  onAgarrar: (e: React.DragEvent<HTMLElement>) => void;
  onSoltarAgarre: () => void;
  opcionesPov: { usados: { id: number; nombre: string }[]; resto: { id: number; nombre: string }[] };
  cal: Calendario | null;
  onGuardar: (cambios: FragmentoCambios) => void;
  onBorrar: () => void;
}) {
  const [pov, setPov] = useState(f.personajeId);
  const [titulo, setTitulo] = useState(f.titulo ?? "");
  const [enlace, setEnlace] = useState(f.enlace ?? "");
  const [fecha, setFecha] = useState<Fecha | null>(f.fecha);

  const fechaSinGuardar = !misma(fecha, f.fecha);
  const guardarFecha = () => {
    if (!fechaSinGuardar || !cal) return;
    if (fecha && validarFecha(cal, fecha).length) return; // FechaInput ya enseña el error.
    onGuardar({ fecha });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {arrastrable && (
          <span draggable onDragStart={onAgarrar} onDragEnd={onSoltarAgarre} className="shrink-0 cursor-grab text-fg-muted" title="Arrastra para reordenar">
            <Icon name="GripVertical" size={14} />
          </span>
        )}
        <span className="w-6 shrink-0 text-center font-mono text-xs text-fg-muted">{numero}</span>
        <select
          value={pov ?? ""}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            setPov(v);
            onGuardar({ personajeId: v });
          }}
          className={cn(inputCls, "w-44 shrink-0 py-1.5")}
          aria-label="POV"
        >
          <option value="">POV…</option>
          {opcionesPov.usados.length > 0 && (
            <optgroup label="En este acto">
              {opcionesPov.usados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Todos">
            {opcionesPov.resto.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </optgroup>
        </select>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => titulo.trim() !== (f.titulo ?? "") && onGuardar({ titulo })}
          placeholder="Título (opcional)"
          className={cn(inputCls, "py-1.5")}
        />
        <input
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          onBlur={() => enlace.trim() !== (f.enlace ?? "") && onGuardar({ enlace })}
          placeholder="https://discord.com/…"
          className={cn(inputCls, "py-1.5")}
        />
        <button type="button" onClick={onBorrar} className="shrink-0 text-fg-muted hover:text-error" aria-label="Borrar fragmento" title="Borrar fragmento">
          <Icon name="Trash2" size={14} />
        </button>
      </div>

      {cal && (
        <div
          className="pl-8"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) guardarFecha();
          }}
        >
          <FechaInput cal={cal} value={fecha} onChange={setFecha} />
          {fechaSinGuardar && <p className="mt-1 text-xs text-warning">La fecha se guarda al salir del campo.</p>}
        </div>
      )}

      {/* El "momento exacto" en que suena una canción se elige desde aquí (§3.5). */}
      {bloqueCanciones && (
        <div className="pl-8">
          <BloqueVinculos bloque={bloqueCanciones} ownerId={f.id} />
        </div>
      )}
    </div>
  );
}

const bloqueCanciones = bloqueDe("fragmentos", "fragmento_cancion", "a");
