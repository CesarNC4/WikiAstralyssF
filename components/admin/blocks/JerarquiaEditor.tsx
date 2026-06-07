"use client";

import { newKey, type JerarquiaRow, type RangoRow, type FaccionRow } from "@/lib/admin/complejas";
import { useDragList, DragHandle, IconButton, MiembroPicker, subInp, type Opcion } from "./shared";

/**
 * Roster jerarquizado. Variante "org" (rango + apodo) o "familia" (títulos
 * nobiliario/familia). Rango y facción referencian las filas locales por `key`,
 * así funcionan aunque aún no estén guardadas.
 */
export function JerarquiaEditor({
  rows,
  onChange,
  variant,
  rangos,
  facciones,
  personajes,
}: {
  rows: JerarquiaRow[];
  onChange: (r: JerarquiaRow[]) => void;
  variant: "org" | "familia";
  rangos: RangoRow[];
  facciones: FaccionRow[];
  personajes: Opcion[];
}) {
  const { rowProps, dragging } = useDragList(rows, onChange);
  const patch = (i: number, p: Partial<JerarquiaRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...rows,
      {
        key: newKey("jer"),
        personajeId: null,
        nombre: "",
        rangoKey: null,
        faccionKey: null,
        tituloApodo: "",
        tituloNobiliario: "",
        tituloFamilia: "",
      },
    ]);

  return (
    <div>
      <p className="mb-2 text-xs text-fg-muted">Arrastra para ordenar. Enlaza una ficha o escribe un nombre suelto.</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.key}
            {...rowProps(i)}
            className={
              "flex flex-wrap items-center gap-2 rounded-xl border bg-surface/40 p-2 " +
              (dragging === i ? "border-border-glow opacity-70" : "border-border-base")
            }
          >
            <DragHandle />
            <span className="w-5 text-center text-xs text-fg-muted">{i + 1}</span>

            <MiembroPicker
              personajeId={r.personajeId}
              nombre={r.nombre}
              options={personajes}
              onChange={(v) => patch(i, v)}
            />

            {variant === "org" ? (
              <>
                <select
                  value={r.rangoKey ?? ""}
                  onChange={(e) => patch(i, { rangoKey: e.target.value || null })}
                  className={subInp + " w-36"}
                >
                  <option value="">— Rango —</option>
                  {rangos.map((rg) => (
                    <option key={rg.key} value={rg.key}>
                      {rg.nombre || "(sin nombre)"}
                    </option>
                  ))}
                </select>
                <input
                  value={r.tituloApodo}
                  onChange={(e) => patch(i, { tituloApodo: e.target.value })}
                  placeholder="Título / apodo"
                  className={subInp + " w-36"}
                />
              </>
            ) : (
              <>
                <input
                  value={r.tituloNobiliario}
                  onChange={(e) => patch(i, { tituloNobiliario: e.target.value })}
                  placeholder="Título nobiliario"
                  className={subInp + " w-40"}
                />
                <input
                  value={r.tituloFamilia}
                  onChange={(e) => patch(i, { tituloFamilia: e.target.value })}
                  placeholder="Título de familia"
                  className={subInp + " w-40"}
                />
              </>
            )}

            <select
              value={r.faccionKey ?? ""}
              onChange={(e) => patch(i, { faccionKey: e.target.value || null })}
              className={subInp + " w-32"}
            >
              <option value="">— Facción —</option>
              {facciones.map((fc) => (
                <option key={fc.key} value={fc.key}>
                  {fc.nombre || "(sin nombre)"}
                </option>
              ))}
            </select>

            <IconButton onClick={() => remove(i)} title="Quitar" danger>
              ✕
            </IconButton>
          </div>
        ))}
        {rows.length === 0 && <p className="py-3 text-center text-sm text-fg-muted">Sin miembros aún.</p>}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg"
      >
        + Añadir miembro
      </button>
    </div>
  );
}
