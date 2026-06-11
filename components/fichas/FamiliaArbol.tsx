"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, type Node, type Edge, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface ArbolNodo {
  id: number;
  nombre: string;
  generacion: number | null;
  padreId: number | null;
  madreId: number | null;
  estado: string | null;
  destacado: boolean | null;
  personajeId: number | null;
}

/** Árbol genealógico interactivo (§ punto 7). Filas por generación; líneas padre/madre. */
export function FamiliaArbol({ nodos, accent = "#c9a227" }: { nodos: ArbolNodo[]; accent?: string }) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const byGen = new Map<number, ArbolNodo[]>();
    for (const m of nodos) {
      const g = m.generacion ?? 0;
      const arr = byGen.get(g) ?? [];
      arr.push(m);
      byGen.set(g, arr);
    }
    const gens = [...byGen.keys()].sort((a, b) => a - b);
    const W = 170;
    const GAPX = 28;
    const GAPY = 130;
    const ns: Node[] = [];
    gens.forEach((g, gi) => {
      const fila = byGen.get(g)!;
      const filaW = fila.length * (W + GAPX) - GAPX;
      fila.forEach((m, i) => {
        ns.push({
          id: String(m.id),
          position: { x: i * (W + GAPX) - filaW / 2, y: gi * GAPY },
          data: { label: m.estado ? `${m.destacado ? "★ " : ""}${m.nombre}\n${m.estado}` : `${m.destacado ? "★ " : ""}${m.nombre}` },
          style: {
            width: W,
            borderRadius: 12,
            border: `1px solid ${m.destacado ? accent : "rgba(255,255,255,0.16)"}`,
            background: m.destacado ? `${accent}1f` : "rgba(20,20,30,0.9)",
            color: "#e8e8f0",
            fontSize: 12,
            padding: 8,
            textAlign: "center",
            whiteSpace: "pre-line",
            cursor: m.personajeId ? "pointer" : "default",
          },
        });
      });
    });

    const ids = new Set(nodos.map((m) => m.id));
    const es: Edge[] = [];
    for (const m of nodos) {
      if (m.padreId && ids.has(m.padreId)) es.push({ id: `p-${m.id}`, source: String(m.padreId), target: String(m.id), style: { stroke: "#5b8def" } });
      if (m.madreId && ids.has(m.madreId)) es.push({ id: `m-${m.id}`, source: String(m.madreId), target: String(m.id), style: { stroke: "#c2185b" } });
    }
    return { nodes: ns, edges: es };
  }, [nodos, accent]);

  const onNodeClick: NodeMouseHandler = (_, node) => {
    const m = nodos.find((x) => String(x.id) === node.id);
    if (m?.personajeId) router.push(`/personajes/${m.personajeId}`);
  };

  return (
    <div>
      <div className="mb-2 text-xs text-fg-muted">Líneas azules = padre · rosas = madre. Clic en un miembro con ficha para visitarlo.</div>
      <div className="h-[460px] overflow-hidden rounded-2xl border border-border-base bg-deep/40">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} color="rgba(255,255,255,0.04)" />
        </ReactFlow>
      </div>
    </div>
  );
}
