"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { colorTipo, pluralTipo, singularTipo } from "@/components/grafo/comun";
import { cn } from "@/lib/utils";
import { COLOR_ARISTA } from "@/lib/relaciones/colores";
import { COLOR_SIN_CATEGORIA, estiloArista, type CategoriaRelacion } from "@/lib/relaciones/categorias";
import type { AristaMapa, NodoMapa } from "@/lib/queries/mapaRelaciones";
import type { NodoGrafo } from "./tipos";

/**
 * Atlas público (spec §11): el grafo de todo lo que se conecta en Astralys.
 * En escritorio es 3D navegable; en móvil, 2D. Cada vista se descarga solo
 * cuando hace falta: el móvil nunca pide three.js.
 */

const Cargando = () => <div className="grid h-full place-items-center text-sm text-fg-muted">Tejiendo el atlas…</div>;
const Atlas3D = dynamic(() => import("./Atlas3D").then((m) => m.Atlas3D), { ssr: false, loading: Cargando });
const Atlas2D = dynamic(() => import("./Atlas2D").then((m) => m.Atlas2D), { ssr: false, loading: Cargando });

const ESCRITORIO = "(min-width: 1024px) and (pointer: fine)";

export function Atlas({
  nodos,
  aristas,
  categorias,
  categoriaDeTipo,
}: {
  nodos: NodoMapa[];
  aristas: AristaMapa[];
  categorias: CategoriaRelacion[];
  categoriaDeTipo: Record<string, number>;
}) {
  // null hasta saber en qué pantalla estamos (en el servidor no se sabe).
  const [es3D, setEs3D] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(ESCRITORIO);
    const fijar = () => setEs3D(mq.matches);
    fijar();
    mq.addEventListener("change", fijar);
    return () => mq.removeEventListener("change", fijar);
  }, []);
  const [forzar2D, setForzar2D] = useState(false);

  const tipos = useMemo(() => [...new Set(nodos.map((n) => n.tipo))].sort((a, b) => pluralTipo(a).localeCompare(pluralTipo(b))), [nodos]);
  const [apagados, setApagados] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const [foco, setFoco] = useState<{ id: string; n: number } | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const grado = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of aristas) {
      m.set(a.a, (m.get(a.a) ?? 0) + 1);
      m.set(a.b, (m.get(a.b) ?? 0) + 1);
    }
    return m;
  }, [aristas]);
  const visibles: NodoGrafo[] = useMemo(
    () => nodos.filter((n) => !apagados.has(n.tipo)).map((n) => ({ ...n, grado: grado.get(n.id) ?? 0 })),
    [nodos, apagados, grado],
  );
  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);

  const vecinos = useMemo(() => {
    if (!sel) return null;
    const s = new Set([sel]);
    for (const a of aristas) {
      if (a.a === sel) s.add(a.b);
      if (a.b === sel) s.add(a.a);
    }
    return s;
  }, [sel, aristas]);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const estilo = useMemo(
    () => (a: AristaMapa) => estiloArista(a.relId, a.matiz, catMap, categoriaDeTipo, COLOR_ARISTA),
    [catMap, categoriaDeTipo],
  );

  const ir = (id: string) => {
    const n = porId.get(id);
    if (!n) return;
    if (apagados.has(n.tipo)) setApagados((p) => new Set([...p].filter((t) => t !== n.tipo)));
    setSel(id);
    setFoco((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  };

  const opciones = useMemo(() => nodos.map((n) => ({ id: n.id, texto: `${n.label} (${singularTipo(n.tipo)})` })), [nodos]);
  const elegido = sel ? porId.get(sel) ?? null : null;
  const conexiones = elegido ? [...(vecinos ?? [])].filter((x) => x !== sel).map((x) => porId.get(x)!).filter(Boolean) : [];
  const usar3D = es3D && !forzar2D;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {tipos.map((t) => {
          const on = !apagados.has(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => setApagados((p) => (on ? new Set(p).add(t) : new Set([...p].filter((x) => x !== t))))}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors", on ? "text-fg" : "text-fg-muted opacity-60")}
              style={{ borderColor: on ? `${colorTipo(t)}99` : "var(--border-base)", background: on ? `${colorTipo(t)}1a` : "transparent" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colorTipo(t) }} /> {pluralTipo(t)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          list="atlas-fichas"
          value={busqueda}
          onChange={(e) => {
            const v = e.target.value;
            setBusqueda(v);
            const hit = opciones.find((o) => o.texto === v);
            if (hit) {
              ir(hit.id);
              setBusqueda("");
            }
          }}
          placeholder="Buscar una ficha y volar hasta ella…"
          aria-label="Buscar en el atlas"
          className="min-w-0 flex-1 rounded-full border border-border-base bg-surface/60 px-4 py-1.5 text-sm text-fg outline-none focus:border-border-glow sm:max-w-sm"
        />
        <datalist id="atlas-fichas">
          {opciones.map((o) => (
            <option key={o.id} value={o.texto} />
          ))}
        </datalist>
        {categorias.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
            {categorias.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1">
                <span className="h-0.5 w-4" style={{ background: c.color }} /> {c.nombre}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-4" style={{ background: COLOR_SIN_CATEGORIA }} /> Otras relaciones entre personajes
            </span>
          </div>
        )}
        {es3D && (
          <button type="button" onClick={() => setForzar2D((v) => !v)} className="ml-auto rounded-full border border-border-base px-3 py-1 text-xs text-fg-secondary hover:text-fg">
            {forzar2D ? "Ver en 3D" : "Ver en 2D"}
          </button>
        )}
      </div>

      <div className="relative h-[72vh] min-h-[420px] overflow-hidden rounded-2xl border border-border-glow bg-gradient-to-b from-deep to-void">
        {es3D === null ? (
          <Cargando />
        ) : usar3D ? (
          <Atlas3D nodos={visibles} aristas={aristas} estilo={estilo} seleccion={sel} vecinos={vecinos} foco={foco} onNodo={setSel} />
        ) : (
          <Atlas2D nodos={visibles} aristas={aristas} estilo={estilo} seleccion={sel} vecinos={vecinos} foco={foco} onNodo={setSel} />
        )}

        {elegido && (
          <aside className="absolute inset-x-2 bottom-2 z-10 max-h-[45%] overflow-y-auto rounded-2xl border border-border-glow bg-deep/90 p-4 backdrop-blur-xl sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-auto sm:max-h-[calc(100%-1.5rem)] sm:w-72">
            <button type="button" onClick={() => setSel(null)} aria-label="Cerrar" className="absolute right-3 top-3 text-fg-muted hover:text-fg">
              <Icon name="X" size={16} />
            </button>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider" style={{ color: colorTipo(elegido.tipo) }}>
              <span className="h-2 w-2 rounded-full" style={{ background: colorTipo(elegido.tipo) }} /> {singularTipo(elegido.tipo)}
            </p>
            <h2 className="mt-1 pr-6 font-display text-xl text-fg">{elegido.label}</h2>
            <Link href={elegido.href} className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Ver ficha <Icon name="ArrowRight" size={13} />
            </Link>
            {conexiones.length > 0 && (
              <>
                <p className="mb-1 mt-4 text-[11px] uppercase tracking-wider text-fg-muted">{conexiones.length} conexiones</p>
                <ul className="space-y-0.5">
                  {conexiones.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => ir(c.id)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm text-fg-secondary hover:bg-surface hover:text-fg">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorTipo(c.tipo) }} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}

        <p className="pointer-events-none absolute bottom-3 left-3 hidden text-[11px] text-fg-muted sm:block">
          {usar3D ? "Arrastra para girar · rueda para acercar · clic derecho para desplazar" : "Pellizca o usa la rueda para acercar · arrastra para moverte"}
        </p>
      </div>
    </div>
  );
}

