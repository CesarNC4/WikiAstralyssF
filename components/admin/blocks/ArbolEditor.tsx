"use client";

import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { newKey, type ArbolRow } from "@/lib/admin/complejas";
import { MiembroPicker, subInp, type Opcion } from "./shared";
import { Combobox } from "@/components/admin/fields";

/**
 * Árbol genealógico visual (React Flow). Los nodos se colocan solos por
 * generación (fila) — no se guardan posiciones. Clic en un nodo abre el panel
 * lateral donde se editan padre/madre (desplegables) y el resto de campos.
 */
export function ArbolEditor({
  rows,
  onChange,
  personajes,
  estadoOptions,
}: {
  rows: ArbolRow[];
  onChange: (r: ArbolRow[]) => void;
  personajes: Opcion[];
  estadoOptions: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const patch = (key: string, p: Partial<ArbolRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const remove = (key: string) => {
    // Limpia referencias padre/madre que apunten al nodo borrado.
    onChange(
      rows
        .filter((r) => r.key !== key)
        .map((r) => ({
          ...r,
          padreKey: r.padreKey === key ? null : r.padreKey,
          madreKey: r.madreKey === key ? null : r.madreKey,
        })),
    );
    if (selected === key) setSelected(null);
  };

  const add = () => {
    const maxGen = rows.reduce((m, r) => Math.max(m, r.generacion), -1);
    const key = newKey("arbol");
    onChange([
      ...rows,
      {
        key,
        nombre: "Nueva persona",
        personajeId: null,
        generacion: rows.length ? maxGen : 0,
        padreKey: null,
        madreKey: null,
        estado: "",
        destacado: false,
        motivoDestacado: "",
        notas: "",
      },
    ]);
    setSelected(key);
  };

  const labelOf = (r: ArbolRow) => {
    const linked = r.personajeId != null ? personajes.find((o) => o.id === r.personajeId) : undefined;
    return linked ? linked.label : r.nombre || "(sin nombre)";
  };

  // Auto-layout: agrupar por generación → fila; posición por índice dentro de la fila.
  const nodes: Node[] = useMemo(() => {
    const byGen = new Map<number, ArbolRow[]>();
    for (const r of rows) {
      const g = r.generacion ?? 0;
      const fila = byGen.get(g) ?? [];
      fila.push(r);
      byGen.set(g, fila);
    }
    const gens = [...byGen.keys()].sort((a, b) => a - b);
    const out: Node[] = [];
    gens.forEach((g, gi) => {
      const fila = byGen.get(g)!;
      fila.forEach((r, ci) => {
        out.push({
          id: r.key,
          position: { x: ci * 200, y: gi * 130 },
          data: { label: `${r.destacado ? "★ " : ""}${labelOf(r)}${r.personajeId != null ? " ◆" : ""}` },
          selected: selected === r.key,
          style: {
            width: 170,
            borderRadius: 12,
            border: `1px solid ${r.destacado ? "var(--accent, #c9a227)" : "rgba(255,255,255,0.15)"}`,
            background: selected === r.key ? "rgba(201,162,39,0.12)" : "rgba(20,20,30,0.85)",
            color: "#e8e8f0",
            fontSize: 12,
            padding: 6,
          },
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selected, personajes]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    const keys = new Set(rows.map((r) => r.key));
    for (const r of rows) {
      if (r.padreKey && keys.has(r.padreKey)) out.push({ id: `${r.padreKey}->${r.key}:p`, source: r.padreKey, target: r.key, style: { stroke: "#5b8def" } });
      if (r.madreKey && keys.has(r.madreKey)) out.push({ id: `${r.madreKey}->${r.key}:m`, source: r.madreKey, target: r.key, style: { stroke: "#c2185b" } });
    }
    return out;
  }, [rows]);

  const sel = selected ? rows.find((r) => r.key === selected) ?? null : null;
  const otras = rows.filter((r) => r.key !== selected);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={add} className="rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg">
          + Añadir persona
        </button>
        <span className="text-xs text-fg-muted">
          Líneas azules = padre · rosas = madre. Clic en un nodo para editarlo.
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="h-[440px] overflow-hidden rounded-xl border border-border-base bg-deep/40">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            fitView
            onNodeClick={(_, n) => setSelected(n.id)}
            onPaneClick={() => setSelected(null)}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="rgba(255,255,255,0.05)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="rounded-xl border border-border-base bg-surface/40 p-3">
          {!sel ? (
            <p className="py-8 text-center text-sm text-fg-muted">
              {rows.length === 0 ? "Añade la primera persona del árbol." : "Selecciona un nodo para editarlo."}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm text-fg">Editar persona</span>
                <button type="button" onClick={() => remove(sel.key)} className="rounded border border-error/40 px-2 py-0.5 text-xs text-error hover:bg-error/10">
                  Eliminar
                </button>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs text-fg-muted">Nombre / ficha</span>
                <MiembroPicker
                  personajeId={sel.personajeId}
                  nombre={sel.nombre}
                  options={personajes}
                  onChange={(v) => patch(sel.key, v)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-fg-muted">Generación</span>
                <input
                  type="number"
                  value={String(sel.generacion)}
                  onChange={(e) => patch(sel.key, { generacion: Number(e.target.value) || 0 })}
                  className={subInp + " w-24 font-mono"}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-fg-muted">Padre</span>
                <select value={sel.padreKey ?? ""} onChange={(e) => patch(sel.key, { padreKey: e.target.value || null })} className={subInp + " w-full"}>
                  <option value="">— Ninguno —</option>
                  {otras.map((o) => (
                    <option key={o.key} value={o.key}>{labelOf(o)}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-fg-muted">Madre</span>
                <select value={sel.madreKey ?? ""} onChange={(e) => patch(sel.key, { madreKey: e.target.value || null })} className={subInp + " w-full"}>
                  <option value="">— Ninguna —</option>
                  {otras.map((o) => (
                    <option key={o.key} value={o.key}>{labelOf(o)}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-fg-muted">Estado</span>
                <Combobox value={sel.estado} onChange={(v) => patch(sel.key, { estado: v })} options={estadoOptions} campo="arbol_estado" placeholder="Vivo, fallecido…" />
              </label>

              <label className="flex items-center gap-2 text-sm text-fg-secondary">
                <input type="checkbox" checked={sel.destacado} onChange={(e) => patch(sel.key, { destacado: e.target.checked })} />
                Destacar este nodo
              </label>
              {sel.destacado && (
                <input value={sel.motivoDestacado} onChange={(e) => patch(sel.key, { motivoDestacado: e.target.value })} placeholder="Motivo del destacado" className={subInp + " w-full"} />
              )}

              <label className="block">
                <span className="mb-1 block text-xs text-fg-muted">Notas</span>
                <textarea value={sel.notas} onChange={(e) => patch(sel.key, { notas: e.target.value })} rows={2} className={subInp + " w-full resize-y"} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
