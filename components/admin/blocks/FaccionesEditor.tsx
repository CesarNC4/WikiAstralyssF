"use client";

import { newKey, type FaccionRow } from "@/lib/admin/complejas";
import { IconButton, subInp, ColorField } from "./shared";

/** Facciones (nombre + color). Sin orden — se listan tal cual. */
export function FaccionesEditor({ rows, onChange }: { rows: FaccionRow[]; onChange: (r: FaccionRow[]) => void }) {
  const patch = (i: number, p: Partial<FaccionRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: newKey("facc"), nombre: "", color: "" }]);

  return (
    <div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-border-base"
              style={{ backgroundColor: r.color || "transparent" }}
              title={r.color || "sin color"}
            />
            <input
              value={r.nombre}
              onChange={(e) => patch(i, { nombre: e.target.value })}
              placeholder="Nombre de la facción"
              className={subInp + " min-w-[10rem] flex-1"}
            />
            <ColorField value={r.color} onChange={(v) => patch(i, { color: v })} />
            <IconButton onClick={() => remove(i)} title="Quitar" danger>
              ✕
            </IconButton>
          </div>
        ))}
        {rows.length === 0 && <p className="py-3 text-center text-sm text-fg-muted">Sin facciones aún.</p>}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg"
      >
        + Añadir facción
      </button>
    </div>
  );
}
