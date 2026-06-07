"use client";

import { newKey, type HistorialRow } from "@/lib/admin/complejas";
import { useDragList, DragHandle, IconButton, MiembroPicker, subInp, type Opcion } from "./shared";

/** Miembros históricos / pasados. Ordenable por arrastre. */
export function HistorialEditor({
  rows,
  onChange,
  personajes,
}: {
  rows: HistorialRow[];
  onChange: (r: HistorialRow[]) => void;
  personajes: Opcion[];
}) {
  const { rowProps, dragging } = useDragList(rows, onChange);
  const patch = (i: number, p: Partial<HistorialRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...rows,
      {
        key: newKey("hist"),
        nombre: "",
        personajeId: null,
        estado: "",
        rol: "",
        periodo: "",
        destacado: false,
        motivoDestacado: "",
        notas: "",
      },
    ]);

  return (
    <div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.key}
            {...rowProps(i)}
            className={
              "rounded-xl border bg-surface/40 p-2 " +
              (dragging === i ? "border-border-glow opacity-70" : "border-border-base")
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <DragHandle />
              <MiembroPicker
                personajeId={r.personajeId}
                nombre={r.nombre}
                options={personajes}
                onChange={(v) => patch(i, v)}
              />
              <input value={r.rol} onChange={(e) => patch(i, { rol: e.target.value })} placeholder="Rol" className={subInp + " w-32"} />
              <input value={r.periodo} onChange={(e) => patch(i, { periodo: e.target.value })} placeholder="Periodo / era" className={subInp + " w-32"} />
              <input value={r.estado} onChange={(e) => patch(i, { estado: e.target.value })} placeholder="Estado" className={subInp + " w-28"} />
              <label className="flex items-center gap-1 text-xs text-fg-secondary" title="Destacar">
                <input type="checkbox" checked={r.destacado} onChange={(e) => patch(i, { destacado: e.target.checked })} />
                ★
              </label>
              <IconButton onClick={() => remove(i)} title="Quitar" danger>
                ✕
              </IconButton>
            </div>
            {r.destacado && (
              <input
                value={r.motivoDestacado}
                onChange={(e) => patch(i, { motivoDestacado: e.target.value })}
                placeholder="Motivo del destacado"
                className={subInp + " mt-2 w-full"}
              />
            )}
            <input
              value={r.notas}
              onChange={(e) => patch(i, { notas: e.target.value })}
              placeholder="Notas (opcional)"
              className={subInp + " mt-2 w-full"}
            />
          </div>
        ))}
        {rows.length === 0 && <p className="py-3 text-center text-sm text-fg-muted">Sin historial aún.</p>}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg"
      >
        + Añadir entrada
      </button>
    </div>
  );
}
