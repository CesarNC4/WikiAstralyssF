"use client";

import { useCallback, useState } from "react";
import { AccordionSection } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";
import { subInp, IconButton } from "@/components/admin/blocks/shared";
import { getRelacion, setRelacion } from "@/lib/actions/relaciones";
import { getRelacionesDe, type RelacionDef, type RelacionRow } from "@/lib/admin/relaciones";

/**
 * Editor de las sub-listas de texto de una ficha (los usos de un mineral). Las
 * relaciones con otras fichas no se editan aquí: las lleva el panel de
 * conexiones, que las muestra en los dos sentidos desde un único registro.
 */
export function RelacionesEditor({ entidad, ownerId, revalidar }: { entidad: string; ownerId: number; revalidar?: string }) {
  const defs = getRelacionesDe(entidad);
  if (defs.length === 0) return null;
  return (
    <>
      {defs.map((def) => (
        <ListaTexto key={def.key} entidad={entidad} ownerId={ownerId} def={def} revalidar={revalidar} />
      ))}
    </>
  );
}

function ListaTexto({ entidad, ownerId, def, revalidar }: { entidad: string; ownerId: number; def: RelacionDef; revalidar?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<RelacionRow[]>([]);
  const [cargado, setCargado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setRows(await getRelacion(entidad, def.key, ownerId));
    } catch {
      toast("No se pudo cargar la lista.", "error");
    } finally {
      setCargado(true);
    }
  }, [entidad, def.key, ownerId, toast]);

  // Se carga al desplegar, desde el propio evento: no hay nada externo que
  // sincronizar, así que no corresponde un efecto.
  const alternar = () => {
    const abriendo = !abierto;
    setAbierto(abriendo);
    if (abriendo && !cargado) void cargar();
  };

  const persistir = async (next: RelacionRow[]) => {
    setRows(next);
    try {
      const fresh = await setRelacion(entidad, def.key, ownerId, next, revalidar);
      // Las filas aún vacías no las guarda el servidor; se conservan en pantalla
      // para poder terminar de escribirlas.
      const enProgreso = next.filter((r) => (r.campos[def.libre.col] ?? "").trim() === "");
      setRows([...fresh, ...enProgreso]);
    } catch {
      toast("No se pudo guardar la lista.", "error");
    }
  };

  const setCampo = (i: number, col: string, val: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, campos: { ...r.campos, [col]: val } } : r)));

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    void persistir(next);
  };

  return (
    <AccordionSection
      title={`${def.titulo}${cargado && rows.length ? ` (${rows.length})` : ""}`}
      open={abierto}
      onOpenChange={alternar}
    >
      {def.hint && <p className="mb-2 text-xs text-fg-muted">{def.hint}</p>}
      <div className="space-y-2">
        {!cargado && <p className="text-xs text-fg-muted">Cargando…</p>}
        {cargado && rows.length === 0 && <p className="text-xs text-fg-muted">Sin elementos. Añade el primero.</p>}

        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-base bg-surface/40 p-2">
            {def.reorder && (
              <div className="flex flex-col">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="text-xs text-fg-muted disabled:opacity-30" aria-label="Subir">▲</button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === rows.length - 1} className="text-xs text-fg-muted disabled:opacity-30" aria-label="Bajar">▼</button>
              </div>
            )}

            <input
              value={row.campos[def.libre.col] ?? ""}
              onChange={(e) => setCampo(i, def.libre.col, e.target.value)}
              onBlur={() => persistir(rows)}
              placeholder={def.libre.label}
              className={subInp + " min-w-[10rem] flex-1"}
            />
            {def.libre.detalleCol && (
              <input
                value={row.campos[def.libre.detalleCol] ?? ""}
                onChange={(e) => setCampo(i, def.libre.detalleCol!, e.target.value)}
                onBlur={() => persistir(rows)}
                placeholder={def.libre.detalleLabel ?? "Detalle"}
                className={subInp + " min-w-[10rem] flex-[2]"}
              />
            )}

            <IconButton onClick={() => persistir(rows.filter((_, idx) => idx !== i))} title="Quitar" danger>✕</IconButton>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { campos: {} }])}
          className="rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
        >
          + Añadir
        </button>
      </div>
      <p className="mt-2 text-xs text-fg-muted">Se guarda al instante, sin pasar por el botón Guardar.</p>
    </AccordionSection>
  );
}
