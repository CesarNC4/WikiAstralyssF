"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, type Node, type Edge, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface RelNode {
  key: string;
  nombre: string;
  tipo?: string | null;
  href?: string | null;
}

/** Grafo radial e interactivo de los vínculos de un personaje (§ punto 2). */
export function RelacionesGraph({ centro, vinculos }: { centro: string; vinculos: RelNode[] }) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const cx = 0;
    const cy = 0;
    const radio = Math.max(180, 90 + vinculos.length * 14);
    const ns: Node[] = [
      {
        id: "__centro",
        position: { x: cx, y: cy },
        data: { label: centro },
        draggable: false,
        style: {
          width: 150,
          borderRadius: 16,
          border: "1.5px solid var(--color-primary, #8b7bff)",
          background: "rgba(139,123,255,0.16)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          padding: 8,
          textAlign: "center",
        },
      },
    ];
    const es: Edge[] = [];
    vinculos.forEach((v, i) => {
      const a = (-90 + (360 / Math.max(1, vinculos.length)) * i) * (Math.PI / 180);
      ns.push({
        id: v.key,
        position: { x: cx + radio * Math.cos(a), y: cy + radio * Math.sin(a) },
        data: { label: v.nombre },
        style: {
          width: 140,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(20,20,30,0.9)",
          color: "#e8e8f0",
          fontSize: 12,
          padding: 6,
          textAlign: "center",
          cursor: v.href ? "pointer" : "default",
        },
      });
      es.push({
        id: `e-${v.key}`,
        source: "__centro",
        target: v.key,
        label: v.tipo ?? undefined,
        animated: true,
        style: { stroke: "rgba(139,123,255,0.45)" },
        labelStyle: { fill: "#aab", fontSize: 10 },
        labelBgStyle: { fill: "rgba(15,15,22,0.85)" },
      });
    });
    return { nodes: ns, edges: es };
  }, [centro, vinculos]);

  const onNodeClick: NodeMouseHandler = (_, node) => {
    const v = vinculos.find((x) => x.key === node.id);
    if (v?.href) router.push(v.href);
  };

  return (
    <div className="h-[420px] overflow-hidden rounded-2xl border border-border-base bg-deep/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} color="rgba(255,255,255,0.04)" />
      </ReactFlow>
    </div>
  );
}
