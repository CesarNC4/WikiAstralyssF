"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-3d";
import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial } from "three";
import { colorTipo, radioNodo, singularTipo, useClicTolerante, useTamano } from "@/components/grafo/comun";
import type { EnlaceGrafo, NodoGrafo, PropsGrafo } from "./tipos";

/**
 * El Atlas en 3D real (spec §11, "Atlas público"): se gira, se acerca y se
 * recorre. Cada ficha es una esfera del color de su tipo con su nombre debajo.
 * Solo se carga en escritorio, así el móvil no descarga three.js.
 */

/** Rótulo como sprite: siempre mira a la cámara. */
function rotulo(texto: string): Sprite {
  const fs = 40;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fs}px Inter, sans-serif`;
  const w = Math.ceil(ctx.measureText(texto).width) + 16;
  canvas.width = w;
  canvas.height = fs + 16;
  ctx.font = `${fs}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(11,11,18,0.9)";
  ctx.strokeText(texto, w / 2, canvas.height / 2);
  ctx.fillStyle = "#e7e5f4";
  ctx.fillText(texto, w / 2, canvas.height / 2);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  const sprite = new Sprite(new SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  const alto = 3.2;
  sprite.scale.set((alto * w) / canvas.height, alto, 1);
  return sprite;
}

export function Atlas3D({ nodos, aristas, estilo, seleccion, vecinos, foco, onNodo }: PropsGrafo) {
  const caja = useRef<HTMLDivElement>(null);
  const tam = useTamano(caja);
  useClicTolerante(caja);
  const fg = useRef<ForceGraphMethods<NodeObject<NodoGrafo>, LinkObject<NodoGrafo, EnlaceGrafo>> | undefined>(undefined);
  const [cache] = useState(() => new Map<string, NodeObject<NodoGrafo>>());
  const ajustado = useRef(false);

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

  // Vuela la cámara hasta la ficha pedida.
  useEffect(() => {
    if (!foco) return;
    const o = cache.get(foco.id);
    if (o?.x == null || o.y == null || o.z == null) return;
    const d = 70;
    const lejos = Math.hypot(o.x, o.y, o.z);
    const pos = lejos > 1 ? { x: o.x * (1 + d / lejos), y: o.y * (1 + d / lejos), z: o.z * (1 + d / lejos) } : { x: o.x, y: o.y, z: o.z + d };
    fg.current?.cameraPosition(pos, { x: o.x, y: o.y, z: o.z }, 1200);
  }, [foco, cache]);

  const apagado = (id: string) => vecinos != null && !vecinos.has(id);

  return (
    <div ref={caja} className="absolute inset-0">
      {tam.w > 0 && (
        <ForceGraph3D<NodoGrafo, EnlaceGrafo>
          ref={fg}
          width={tam.w}
          height={tam.h}
          graphData={datos}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          cooldownTicks={200}
          onEngineStop={() => {
            // Encuadre inicial, una sola vez: después manda el visitante.
            if (ajustado.current) return;
            ajustado.current = true;
            fg.current?.zoomToFit(800, 40);
          }}
          nodeLabel={(n) => `${n.label} · ${singularTipo(n.tipo)}`}
          nodeVal={(n) => radioNodo(n.grado) ** 2 / 4}
          nodeColor={(n) => (apagado(n.id as string) ? "#2a2a3a" : n.id === seleccion ? "#ffffff" : colorTipo(n.tipo))}
          nodeOpacity={0.95}
          nodeResolution={16}
          nodeThreeObjectExtend
          nodeThreeObject={(n) => {
            const s = rotulo(n.label);
            s.position.y = -(radioNodo(n.grado) + 3);
            return s;
          }}
          linkColor={(l) => estilo(l.arista).color}
          linkOpacity={0.55}
          linkWidth={(l) => (seleccion && (l.arista.a === seleccion || l.arista.b === seleccion) ? 1.2 : 0.4)}
          onNodeClick={(n) => onNodo(n.id as string)}
          onBackgroundClick={() => onNodo(null)}
        />
      )}
    </div>
  );
}
