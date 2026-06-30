"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { AccordionSection } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";
import { subInp, IconButton } from "@/components/admin/blocks/shared";
import { getRelacion, setRelacion, getOpcionesRelacion, type OpcionRel } from "@/lib/actions/relaciones";
import { getRelacionesDe, type RelacionDef, type RelacionRow } from "@/lib/admin/relaciones";

/** Todos los bloques de relación de una entidad (solo en edición: requieren id). */
export function RelacionesEditor({ entidad, ownerId, revalidar }: { entidad: string; ownerId: number; revalidar?: string }) {
  const defs = getRelacionesDe(entidad);
  if (defs.length === 0) return null;
  return (
    <>
      {defs.map((def) => (
        <RelacionBloque key={def.key + def.titulo} entidad={entidad} ownerId={ownerId} def={def} revalidar={revalidar} />
      ))}
    </>
  );
}

function RelacionBloque({ entidad, ownerId, def, revalidar }: { entidad: string; ownerId: number; def: RelacionDef; revalidar?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<RelacionRow[]>([]);
  const [opciones, setOpciones] = useState<OpcionRel[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      getRelacion(entidad, def.key, ownerId),
      def.target ? getOpcionesRelacion(def.target.source) : Promise.resolve([] as OpcionRel[]),
    ])
      .then(([r, o]) => {
        if (!vivo) return;
        setRows(r);
        // Evita auto-referencia cuando la fuente es la propia entidad.
        const selfSource = def.target?.source === entidad;
        setOpciones(selfSource ? o.filter((x) => x.id !== ownerId) : o);
        setCargado(true);
      })
      .catch(() => setCargado(true));
    return () => { vivo = false; };
  }, [entidad, def.key, def.target?.source, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const labelDe = useMemo(() => {
    const m = new Map(opciones.map((o) => [o.id, o.label]));
    return (id: number | null) => (id == null ? "" : m.get(id) ?? `#${id}`);
  }, [opciones]);

  // ¿Esta fila la persiste el servidor? (mismo criterio que setRelacion). Las filas
  // "en progreso" (aún sin objetivo / sin texto) se conservan en el UI para poder
  // editarlas; el servidor las descarta hasta que tengan contenido real.
  const seGuarda = (r: RelacionRow) =>
    def.target ? r.targetId != null : !!(def.libre && (r.campos[def.libre.col] ?? "").trim());

  const persistir = async (next: RelacionRow[]) => {
    setRows(next);
    try {
      const fresh = await setRelacion(entidad, def.key, ownerId, next, revalidar);
      // Reanexa las filas en progreso que el servidor aún no guarda, para no borrar
      // la fila que el usuario está rellenando.
      const enProgreso = next.filter((r) => !seGuarda(r));
      setRows([...fresh, ...enProgreso]);
    } catch {
      toast("No se pudo guardar la relación.", "error");
    }
  };

  const setCampo = (i: number, col: string, val: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, campos: { ...r.campos, [col]: val } } : r)));
  };
  const commit = () => persistir(rows);

  // Añade una fila vacía SOLO en el cliente: no persiste hasta tener contenido (si
  // no, el servidor la descartaría y desaparecería al instante).
  const addFila = () => setRows((prev) => [...prev, { targetId: null, campos: {} }]);
  const quitar = (i: number) => persistir(rows.filter((_, idx) => idx !== i));
  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    persistir(next);
  };
  const setTarget = (i: number, id: number | null) => persistir(rows.map((r, idx) => (idx === i ? { ...r, targetId: id } : r)));

  const count = rows.length;

  return (
    <AccordionSection title={`${def.titulo}${count ? ` (${count})` : ""}`}>
      {def.hint && <p className="mb-2 text-xs text-fg-muted">{def.hint}</p>}
      <div className="space-y-2">
        {!cargado && <p className="text-xs text-fg-muted">Cargando…</p>}
        {cargado && rows.length === 0 && <p className="text-xs text-fg-muted">Sin elementos. Añade el primero.</p>}

        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-base bg-surface/40 p-2">
            {def.reorder && (
              <div className="flex flex-col">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="text-xs text-fg-muted disabled:opacity-30">▲</button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === rows.length - 1} className="text-xs text-fg-muted disabled:opacity-30">▼</button>
              </div>
            )}

            {/* Objetivo enlazado */}
            {def.target && (
              <div className="min-w-[12rem] flex-1">
                {row.targetId != null ? (
                  <span className="inline-flex w-full items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-2 py-1.5 text-sm text-fg">
                    <Icon name={def.icon} size={13} className="text-accent" />
                    <span className="truncate">{labelDe(row.targetId)}</span>
                    <button type="button" className="ml-auto text-fg-muted hover:text-error" onClick={() => setTarget(i, null)}>✕</button>
                  </span>
                ) : (
                  <TargetPicker label={def.target.label} opciones={opciones} excluir={rows.map((r) => r.targetId)} onPick={(id) => setTarget(i, id)} />
                )}
              </div>
            )}

            {/* Campo libre (p.ej. usos) */}
            {def.libre && (
              <>
                <input
                  value={row.campos[def.libre.col] ?? ""}
                  onChange={(e) => setCampo(i, def.libre!.col, e.target.value)}
                  onBlur={commit}
                  placeholder={def.libre.label}
                  className={subInp + " min-w-[10rem] flex-1"}
                />
                {def.libre.detalleCol && (
                  <input
                    value={row.campos[def.libre.detalleCol] ?? ""}
                    onChange={(e) => setCampo(i, def.libre!.detalleCol!, e.target.value)}
                    onBlur={commit}
                    placeholder={def.libre.detalleLabel ?? "Detalle"}
                    className={subInp + " min-w-[10rem] flex-[2]"}
                  />
                )}
              </>
            )}

            {/* Campos extra */}
            {def.extra.map((campo) =>
              campo.tipo === "select" ? (
                <select
                  key={campo.name}
                  value={row.campos[campo.name] ?? ""}
                  onChange={(e) => { setCampo(i, campo.name, e.target.value); }}
                  onBlur={commit}
                  className={subInp + " w-36"}
                  title={campo.label}
                >
                  <option value="">{campo.label}…</option>
                  {campo.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  key={campo.name}
                  value={row.campos[campo.name] ?? ""}
                  onChange={(e) => setCampo(i, campo.name, e.target.value)}
                  onBlur={commit}
                  placeholder={campo.label}
                  className={subInp + " w-40"}
                />
              ),
            )}

            <IconButton onClick={() => quitar(i)} title="Quitar" danger>✕</IconButton>
          </div>
        ))}

        <button
          type="button"
          onClick={addFila}
          className="rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
        >
          + Añadir
        </button>
      </div>
      <p className="mt-2 text-xs text-fg-muted">Se guarda al instante (independiente del botón Guardar).</p>
    </AccordionSection>
  );
}

function TargetPicker({ label, opciones, excluir, onPick }: { label: string; opciones: OpcionRel[]; excluir: (number | null)[]; onPick: (id: number) => void }) {
  const [q, setQ] = useState("");
  const usados = new Set(excluir.filter((x): x is number => x != null));
  const filtered = opciones.filter((o) => !usados.has(o.id) && (q ? o.label.toLowerCase().includes(q.toLowerCase()) : true)).slice(0, 8);
  return (
    <div className="relative">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}…`} className={subInp + " w-full"} />
      {q && (
        <div className="absolute z-30 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-border-glow bg-elevated p-1 shadow-xl">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onPick(o.id); setQ(""); }}
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-fg-secondary hover:bg-surface hover:text-fg"
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2 py-1.5 text-xs text-fg-muted">Sin coincidencias.</p>}
        </div>
      )}
    </div>
  );
}
