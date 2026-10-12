"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";
import { dibujarNodo, singularTipo, useTamano } from "@/components/grafo/comun";
import { COLOR_ARISTA } from "@/lib/relaciones/colores";
import { estiloArista, type CategoriaRelacion } from "@/lib/relaciones/categorias";

// El grafo usa canvas y `window` al cargarse: solo en el navegador.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as unknown as typeof import("react-force-graph-2d").default;

export interface VecinoMiniMapa {
  id: string;
  tipo: string;
  label: string;
  href: string | null;
  /** Relaciones con la ficha central: la primera decide el color de la línea. */
  relaciones: { relId: string; titulo: string; matiz: string | null }[];
}

type N = { id: string; tipo: string; label: string; href: string | null; centro: boolean };
type L = { source: string; target: string; vecino: VecinoMiniMapa };

/**
 * Mini-mapa de una ficha (spec §11): el mismo mapa del Atlas, centrado en la
 * ficha y con solo sus conexiones directas. Siempre en 2D.
 */
export function MiniMapa({
  centro,
  vecinos,
  categorias,
  categoriaDeTipo,
}: {
  centro: { id: string; tipo: string; label: string };
  vecinos: VecinoMiniMapa[];
  categorias: CategoriaRelacion[];
  categoriaDeTipo: Record<string, number>;
}) {
  const router = useRouter();
  const caja = useRef<HTMLDivElement>(null);
  const tam = useTamano(caja);
  const fg = useRef<ForceGraphMethods<NodeObject<N>, LinkObject<N, L>> | undefined>(undefined);
  const [hover, setHover] = useState<string | null>(null);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const datos = useMemo(() => {
    // La ficha central se queda fija en el medio; las demás se colocan alrededor.
    const nodes: NodeObject<N>[] = [
      { id: centro.id, tipo: centro.tipo, label: centro.label, href: null, centro: true, fx: 0, fy: 0 },
      ...vecinos.map((v) => ({ id: v.id, tipo: v.tipo, label: v.label, href: v.href, centro: false })),
    ];
    const links: L[] = vecinos.map((v) => ({ source: centro.id, target: v.id, vecino: v }));
    return { nodes, links };
  }, [centro, vecinos]);

  const estilo = (v: VecinoMiniMapa) => {
    const r = v.relaciones[0];
    return estiloArista(r?.relId ?? "", r?.matiz ?? null, catMap, categoriaDeTipo, COLOR_ARISTA);
  };

  return (
    <div ref={caja} className="relative h-80 overflow-hidden rounded-2xl border border-border-base bg-gradient-to-b from-deep/80 to-void">
      {tam.w > 0 && (
        <ForceGraph2D<N, L>
          ref={fg}
          width={tam.w}
          height={tam.h}
          graphData={datos}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          onEngineStop={() => fg.current?.zoomToFit(300, 40)}
          enableNodeDrag={false}
          nodeLabel={(n) => `${n.label} · ${singularTipo(n.tipo)}`}
          linkLabel={(l) => l.vecino.relaciones.map((r) => (r.matiz ? `${r.matiz} (${r.titulo})` : r.titulo)).join(" · ")}
          linkColor={(l) => estilo(l.vecino).color}
          linkLineDash={(l) => estilo(l.vecino).patron}
          linkWidth={(l) => (hover === l.vecino.id ? 2.4 : 1.4)}
          onNodeHover={(n) => setHover(n && !n.centro ? (n.id as string) : null)}
          onNodeClick={(n) => {
            if (n.href) router.push(n.href);
          }}
          nodeCanvasObject={(n, ctx, escala) =>
            dibujarNodo(ctx, n, n.centro ? 9 : 5, escala, { resaltado: n.centro || n.id === hover, conNombre: true })
          }
          nodePointerAreaPaint={(n, pintura, ctx) => {
            ctx.fillStyle = pintura;
            ctx.beginPath();
            ctx.arc(n.x!, n.y!, n.centro ? 11 : 8, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />
      )}
    </div>
  );
}
