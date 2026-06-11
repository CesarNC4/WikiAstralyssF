"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, type Node, type Edge, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface OrgMiembro {
  key: string;
  nombre: string;
  sub?: string | null;
  peso?: number | null;
  href?: string | null;
  destacado?: boolean;
}

/** Organigrama por niveles de rango (§ punto 6). Líder arriba; clic navega a la ficha. */
export function OrgChart({ miembros, accent = "#c9a227" }: { miembros: OrgMiembro[]; accent?: string }) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    // Niveles por peso de rango (mayor peso = más arriba). Sin peso → un solo nivel.
    const pesos = [...new Set(miembros.map((m) => m.peso ?? 0))].sort((a, b) => b - a);
    const nivelDe = (m: OrgMiembro) => pesos.indexOf(m.peso ?? 0);
    const porNivel = new Map<number, OrgMiembro[]>();
    miembros.forEach((m) => {
      const lvl = nivelDe(m);
      const arr = porNivel.get(lvl) ?? [];
      arr.push(m);
      porNivel.set(lvl, arr);
    });

    const W = 180;
    const GAPX = 30;
    const GAPY = 130;
    const ns: Node[] = [];
    const es: Edge[] = [];

    porNivel.forEach((fila, lvl) => {
      const filaW = fila.length * (W + GAPX) - GAPX;
      fila.forEach((m, i) => {
        ns.push({
          id: m.key,
          position: { x: i * (W + GAPX) - filaW / 2, y: lvl * GAPY },
          data: { label: m.sub ? `${m.nombre}\n${m.sub}` : m.nombre },
          draggable: true,
          style: {
            width: W,
            borderRadius: 12,
            border: `1px solid ${m.destacado || lvl === 0 ? accent : "rgba(255,255,255,0.16)"}`,
            background: lvl === 0 ? `${accent}22` : "rgba(20,20,30,0.9)",
            color: "#e8e8f0",
            fontSize: 12,
            padding: 8,
            textAlign: "center",
            whiteSpace: "pre-line",
            cursor: m.href ? "pointer" : "default",
          },
        });
      });
    });

    // Aristas: cada nodo se conecta con el primero del nivel superior (embudo a liderazgo).
    for (let lvl = 1; lvl < pesos.length; lvl++) {
      const arriba = porNivel.get(lvl - 1);
      const padre = arriba && arriba.length ? arriba[0] : undefined;
      if (!padre) continue;
      (porNivel.get(lvl) ?? []).forEach((m) => {
        es.push({ id: `e-${m.key}`, source: padre.key, target: m.key, style: { stroke: `${accent}66` } });
      });
    }

    return { nodes: ns, edges: es };
  }, [miembros, accent]);

  const onNodeClick: NodeMouseHandler = (_, node) => {
    const m = miembros.find((x) => x.key === node.id);
    if (m?.href) router.push(m.href);
  };

  return (
    <div className="h-[440px] overflow-hidden rounded-2xl border border-border-base bg-deep/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} color="rgba(255,255,255,0.04)" />
      </ReactFlow>
    </div>
  );
}
