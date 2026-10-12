"use client";

import { useEffect, useState, type RefObject } from "react";
import { entityByKey } from "@/lib/entities";
import { COLOR_ENTIDAD, COLOR_ENTIDAD_POR_DEFECTO } from "@/lib/relaciones/colores";

/**
 * Piezas comunes de los grafos del mundo (Atlas 3D y 2D, mini-mapa de las
 * fichas). Client-safe.
 */

export const colorTipo = (tipo: string) => COLOR_ENTIDAD[tipo] ?? COLOR_ENTIDAD_POR_DEFECTO;
export const pluralTipo = (tipo: string) => entityByKey(tipo)?.plural ?? tipo;
export const singularTipo = (tipo: string) => entityByKey(tipo)?.singular ?? tipo;

/** Radio de un nodo según cuántas conexiones tiene. */
export const radioNodo = (grado: number) => 3 + Math.min(6, Math.sqrt(grado) * 1.4);

/** Tamaño en píxeles de un contenedor: los grafos dibujan en canvas y lo necesitan. */
export function useTamano(ref: RefObject<HTMLElement | null>) {
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return tam;
}

/**
 * Que un clic con temblor siga siendo un clic. Las librerías de grafos dan por
 * arrastre cualquier `pointermove` con el botón pulsado, aunque sea de 0 px (el
 * 2D cuando hay `onBackgroundClick`, el 3D siempre), y tras un arrastre
 * descartan el clic. Chrome en Windows emite ese movimiento al pulsar, así que
 * no se podía seleccionar ningún nodo.
 *
 * Se filtran en captura, sobre el envoltorio, los movimientos de menos de
 * `margen` px mientras el botón está pulsado. El pan y el arrastre de nodos no
 * cambian: pasado el margen, los movimientos llegan todos.
 */
export function useClicTolerante(ref: RefObject<HTMLElement | null>, margen = 5) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inicio: { x: number; y: number } | null = null;
    const abajo = (e: PointerEvent) => {
      inicio = { x: e.clientX, y: e.clientY };
    };
    const mueve = (e: PointerEvent) => {
      if (!inicio || e.buttons === 0) return;
      if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < margen) e.stopPropagation();
      else inicio = null; // ya es un arrastre: deja pasar el resto
    };
    const arriba = () => {
      inicio = null;
    };
    el.addEventListener("pointerdown", abajo, true);
    el.addEventListener("pointermove", mueve, true);
    el.addEventListener("pointerup", arriba, true);
    el.addEventListener("pointercancel", arriba, true);
    return () => {
      el.removeEventListener("pointerdown", abajo, true);
      el.removeEventListener("pointermove", mueve, true);
      el.removeEventListener("pointerup", arriba, true);
      el.removeEventListener("pointercancel", arriba, true);
    };
  }, [ref, margen]);
}

/** Dibuja un nodo en el canvas 2D: círculo de color y, si toca, su nombre debajo. */
export function dibujarNodo(
  ctx: CanvasRenderingContext2D,
  n: { x?: number; y?: number; tipo: string; label: string },
  r: number,
  escala: number,
  { resaltado = false, conNombre = false, apagado = false }: { resaltado?: boolean; conNombre?: boolean; apagado?: boolean } = {},
) {
  const x = n.x ?? 0;
  const y = n.y ?? 0;
  const c = colorTipo(n.tipo);
  ctx.globalAlpha = apagado ? 0.2 : 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = c;
  ctx.fill();
  if (resaltado) {
    ctx.beginPath();
    ctx.arc(x, y, r + 3 / escala + 1, 0, 2 * Math.PI);
    ctx.lineWidth = 2 / escala;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  if (conNombre) {
    const fs = 11 / escala;
    ctx.font = `${fs}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 3 / escala;
    ctx.strokeStyle = "#0b0b12";
    ctx.strokeText(n.label, x, y + r + 2 / escala);
    ctx.fillStyle = "#e7e5f4";
    ctx.fillText(n.label, x, y + r + 2 / escala);
  }
  ctx.globalAlpha = 1;
}
