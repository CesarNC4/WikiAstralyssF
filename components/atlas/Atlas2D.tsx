"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import { dibujarNodo, radioNodo, singularTipo, useClicTolerante, useTamano } from "@/components/grafo/comun";
import type { EnlaceGrafo, NodoGrafo, PropsGrafo } from "./tipos";

/** El Atlas en 2D: el de los móviles (spec §11, "Atlas público"). */
export function Atlas2D({ nodos, aristas, estilo, seleccion, vecinos, foco, onNodo }: PropsGrafo) {
  const caja = useRef<HTMLDivElement>(null);
  const tam = useTamano(caja);
  useClicTolerante(caja);
  const fg = useRef<ForceGraphMethods<NodeObject<NodoGrafo>, LinkObject<NodoGrafo, EnlaceGrafo>> | undefined>(undefined);
  // Los objetos de nodo guardan la posición que les da la simulación: se
  // reutilizan al filtrar para que el grafo no se recoloque entero.
  const [cache] = useState(() => new Map<string, NodeObject<NodoGrafo>>());

  const datos = useMemo(() => {
    const nodes = nodos.map((n) => {
      const o = cache.get(n.id);
      const obj = o ? Object.assign(o, n) : { ...n };
      cache.set(n.id, obj);
      return obj;
    });
    const ids = new Set(nodos.map((n) => n.id));
    const links: EnlaceGrafo[] = aristas.filter((a) => ids.has(a.a) && ids.has(a.b)).map((a) => ({ id: a.id, source: a.a, target: a.b, arista: a }));
    return { nodes, links };
  }, [nodos, aristas, cache]);

  useEffect(() => {
    if (!foco) return;
    const o = cache.get(foco.id);
    if (o?.x == null || o.y == null) return;
    fg.current?.centerAt(o.x, o.y, 600);
    fg.current?.zoom(3, 600);
  }, [foco, cache]);

  return (
    <div ref={caja} className="absolute inset-0">
      {tam.w > 0 && (
        <ForceGraph2D<NodoGrafo, EnlaceGrafo>
          ref={fg}
          width={tam.w}
          height={tam.h}
          graphData={datos}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={150}
          onEngineStop={() => !seleccion && fg.current?.zoomToFit(400, 30)}
          nodeLabel={(n) => `${n.label} · ${singularTipo(n.tipo)}`}
          linkColor={(l) => estilo(l.arista).color}
          linkLineDash={(l) => estilo(l.arista).patron}
          linkWidth={(l) => (seleccion && (l.arista.a === seleccion || l.arista.b === seleccion) ? 2 : 1)}
          onNodeClick={(n) => onNodo(n.id as string)}
          onBackgroundClick={() => onNodo(null)}
          nodeCanvasObject={(n, ctx, escala) => {
            const id = n.id as string;
            dibujarNodo(ctx, n, radioNodo(n.grado), escala, {
              resaltado: id === seleccion,
              conNombre: id === seleccion || (vecinos?.has(id) ?? false) || escala > 1.8,
              apagado: vecinos != null && !vecinos.has(id),
            });
          }}
          nodePointerAreaPaint={(n, pintura, ctx) => {
            ctx.fillStyle = pintura;
            ctx.beginPath();
            ctx.arc(n.x!, n.y!, radioNodo(n.grado) + 3, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />
      )}
    </div>
  );
}
