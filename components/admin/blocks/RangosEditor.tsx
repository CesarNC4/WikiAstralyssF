"use client";

import { newKey, type RangoRow } from "@/lib/admin/complejas";
import { useDragList, DragHandle, IconButton, subInp } from "./shared";

/**
 * Rangos ordenados por arrastre. El "peso" se deriva de la posición al guardar
 * (el de más arriba pesa más), así que aquí solo importa el orden.
 */
export function RangosEditor({ rows, onChange }: { rows: RangoRow[]; onChange: (r: RangoRow[]) => void }) {
  const { rowProps, dragging } = useDragList(rows, onChange);
  const patch = (i: number, p: Partial<RangoRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: newKey("rango"), nombre: "", peso: 0 }]);

  return (
    <div>
      <p className="mb-2 text-xs text-fg-muted">Arrastra para ordenar de mayor a menor rango. El de arriba manda.</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.key}
            {...rowProps(i)}
            className={
              "flex items-center gap-2 rounded-xl border bg-surface/40 p-2 " +
              (dragging === i ? "border-border-glow opacity-70" : "border-border-base")
            }
          >
            <DragHandle />
            <span className="w-6 text-center text-xs text-fg-muted" title="Peso por posición">
              {rows.length - i}
            </span>
            <input
              value={r.nombre}
              onChange={(e) => patch(i, { nombre: e.target.value })}
              placeholder="Nombre del rango (p. ej. Maestre)"
              className={subInp + " flex-1"}
            />
            <IconButton onClick={() => remove(i)} title="Quitar" danger>
              ✕
            </IconButton>
          </div>
        ))}
        {rows.length === 0 && <p className="py-3 text-center text-sm text-fg-muted">Sin rangos aún.</p>}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg"
      >
        + Añadir rango
      </button>
    </div>
  );
}
