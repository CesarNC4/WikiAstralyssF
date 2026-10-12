"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { cn } from "@/lib/utils";
import { entityByKey } from "@/lib/entities";
import { actualizarVinculo, borrarVinculo, crearVinculo, listarVinculos } from "@/lib/actions/vinculos";
import { CUALQUIERA, RELACIONES } from "@/lib/relaciones/registro";
import type { CampoVinculo, RelacionDef } from "@/lib/relaciones/tipos";
import { COLOR_ARISTA, COLOR_ENTIDAD, COLOR_ENTIDAD_POR_DEFECTO } from "@/lib/relaciones/colores";
import { estiloArista, type CategoriaRelacion, type ClaveCategoria } from "@/lib/relaciones/categorias";
import type { AristaMapa, NodoMapa } from "@/lib/queries/mapaRelaciones";

/**
 * Mapa de relaciones del taller (spec §11, "Mapa del taller"): 2D, con
 * posiciones por simulación de fuerzas, y editable.
 *
 *  - Se pulsan dos nodos para unirlos: se ofrecen las relaciones que el
 *    registro declara para ese par de tipos.
 *  - Se pulsa una línea para editar sus campos o borrarla.
 *  - Filtros por tipo de entidad y por categoría de relación, y un buscador que
 *    centra el nodo.
 *
 * Escribe con las mismas acciones que el panel de conexiones de las fichas, así
 * que un vínculo creado aquí es exactamente el mismo que uno creado allí.
 */

type N = NodoMapa & { grado: number };
type L = { id: string; source: string; target: string; arista: AristaMapa };


const color = (tipo: string) => COLOR_ENTIDAD[tipo] ?? COLOR_ENTIDAD_POR_DEFECTO;
const nombreTipo = (tipo: string) => entityByKey(tipo)?.plural ?? tipo;
const singular = (tipo: string) => entityByKey(tipo)?.singular ?? tipo;

/** Relaciones del registro que pueden unir dos tipos, vistas desde el primero. */
function opcionesEntre(origen: string, destino: string): { rel: RelacionDef; lado: "a" | "b" }[] {
  const encaja = (decl: string, real: string) => decl === CUALQUIERA || decl === real;
  const out: { rel: RelacionDef; lado: "a" | "b" }[] = [];
  for (const rel of RELACIONES) {
    if (rel.fueraDelAtlas) continue;
    if (encaja(rel.a.entidad, origen) && encaja(rel.b.entidad, destino)) out.push({ rel, lado: "a" });
    else if (encaja(rel.a.entidad, destino) && encaja(rel.b.entidad, origen)) out.push({ rel, lado: "b" });
  }
  return out;
}

export function MapaRelaciones({
  nodos,
  aristas,
  categorias,
  categoriaDeTipo,
  catalogos,
}: {
  nodos: NodoMapa[];
  aristas: AristaMapa[];
  categorias: CategoriaRelacion[];
  categoriaDeTipo: Record<string, number>;
  /** Opciones de los campos de tipo lista, por catálogo. */
  catalogos: Record<string, string[]>;
}) {
  const router = useRouter();
  const fgRef = useRef<ForceGraphMethods<NodeObject<N>, LinkObject<N, L>> | undefined>(undefined);
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 800, h: 600 });

  const tipos = useMemo(() => [...new Set(nodos.map((n) => n.tipo))].sort((a, b) => nombreTipo(a).localeCompare(nombreTipo(b))), [nodos]);
  const [tiposOn, setTiposOn] = useState<Set<string>>(() => new Set(tipos));
  const [catsOn, setCatsOn] = useState<Set<ClaveCategoria>>(() => new Set<ClaveCategoria>(["sin", "otras", ...categorias.map((c) => c.id)]));
  const [soloConectados, setSoloConectados] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [origen, setOrigen] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [aristaSel, setAristaSel] = useState<AristaMapa | null>(null);

  // Tamaño del lienzo: el grafo necesita píxeles, no CSS.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  // "sin" = personaje–personaje sin categoría; "otras" = el resto de conexiones.
  const estilo = (a: AristaMapa) => estiloArista(a.relId, a.matiz, catMap, categoriaDeTipo, COLOR_ARISTA);
  const categoriaDe = (a: AristaMapa): ClaveCategoria => estilo(a).clave;

  // Los objetos de nodo se conservan entre recargas: la simulación guarda en
  // ellos la posición, y así el mapa no se recoloca entero tras cada cambio.
  // Es un almacén de objetos que la simulación muta (x, y, vx…), no estado de
  // React: por eso se guarda una vez y se reutiliza.
  const [cache] = useState(() => new Map<string, NodeObject<N>>());
  const grafo = useMemo(() => {
    const grado = new Map<string, number>();
    for (const a of aristas) {
      grado.set(a.a, (grado.get(a.a) ?? 0) + 1);
      grado.set(a.b, (grado.get(a.b) ?? 0) + 1);
    }
    const visibles = new Set(
      nodos.filter((n) => tiposOn.has(n.tipo) && (!soloConectados || grado.has(n.id) || n.id === origen)).map((n) => n.id),
    );
    const nodes: NodeObject<N>[] = [];
    for (const n of nodos) {
      if (!visibles.has(n.id)) continue;
      const previo = cache.get(n.id);
      const obj = previo ? Object.assign(previo, n, { grado: grado.get(n.id) ?? 0 }) : { ...n, grado: grado.get(n.id) ?? 0 };
      cache.set(n.id, obj);
      nodes.push(obj);
    }
    const links: L[] = aristas
      .filter((a) => visibles.has(a.a) && visibles.has(a.b) && catsOn.has(categoriaDe(a)))
      .map((a) => ({ id: a.id, source: a.a, target: a.b, arista: a }));
    return { nodes, links };
    // categoriaDe solo depende de catMap y categoriaDeTipo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodos, aristas, tiposOn, catsOn, soloConectados, origen, catMap, categoriaDeTipo, cache]);

  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);
  const nOrigen = origen ? porId.get(origen) ?? null : null;
  const nDestino = destino ? porId.get(destino) ?? null : null;

  const limpiar = () => {
    setOrigen(null);
    setDestino(null);
    setAristaSel(null);
  };

  const pulsarNodo = (n: NodeObject<N>) => {
    setAristaSel(null);
    if (!origen || origen === n.id) {
      setOrigen(origen === n.id ? null : n.id);
      setDestino(null);
      return;
    }
    setDestino(n.id);
  };

  const centrar = (id: string) => {
    const n = porId.get(id);
    if (!n) return;
    if (!tiposOn.has(n.tipo)) setTiposOn((p) => new Set(p).add(n.tipo));
    setOrigen(id);
    setDestino(null);
    setAristaSel(null);
    // Si el nodo estaba oculto, aún no tiene posición: se espera a que la tome.
    const colocado = cache.get(id)?.x != null;
    setTimeout(() => {
      const o = cache.get(id);
      if (o?.x != null && o.y != null) {
        fgRef.current?.centerAt(o.x, o.y, 600);
        fgRef.current?.zoom(4, 600);
      }
    }, colocado ? 0 : 400);
  };

  const etiquetasBusqueda = useMemo(() => nodos.map((n) => ({ id: n.id, texto: `${n.label} (${singular(n.tipo)})` })), [nodos]);

  const toggle = <T,>(set: Set<T>, v: T) => {
    const s = new Set(set);
    if (s.has(v)) s.delete(v);
    else s.add(v);
    return s;
  };

  const resaltados = new Set([origen, destino, hover].filter(Boolean) as string[]);

  return (
    <div className="flex h-[calc(100vh-9.5rem)] min-h-[520px]">
      {/* ── Lienzo ─────────────────────────────────────────────── */}
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-x-3 top-3 z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {tipos.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTiposOn((p) => toggle(p, t))}
                className={cn("rounded-full border px-2.5 py-0.5 text-[11px] backdrop-blur transition-colors", tiposOn.has(t) ? "text-fg" : "text-fg-muted opacity-60")}
                style={{ borderColor: tiposOn.has(t) ? color(t) : "var(--border-base)", background: tiposOn.has(t) ? `${color(t)}22` : "transparent" }}
              >
                {nombreTipo(t)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatsOn((p) => toggle(p, c.id))}
                className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] backdrop-blur", catsOn.has(c.id) ? "text-fg" : "text-fg-muted opacity-60")}
                style={{ borderColor: catsOn.has(c.id) ? c.color : "var(--border-base)" }}
              >
                <Icon name={c.icono} size={11} style={{ color: c.color }} /> {c.nombre}
              </button>
            ))}
            {(
              [
                ["sin", "Personajes sin categoría"],
                ["otras", "Otras conexiones"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCatsOn((p) => toggle(p, k))}
                className={cn("rounded-full border border-border-base px-2.5 py-0.5 text-[11px] backdrop-blur", catsOn.has(k) ? "text-fg" : "text-fg-muted opacity-60")}
              >
                {l}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1 text-[11px] text-fg-secondary">
              <input type="checkbox" checked={soloConectados} onChange={(e) => setSoloConectados(e.target.checked)} />
              Ocultar sueltos
            </label>
          </div>
        </div>

        <div ref={caja} className="absolute inset-0 overflow-hidden bg-gradient-to-b from-deep to-void">
          <ForceGraph2D<N, L>
            ref={fgRef}
            width={tam.w}
            height={tam.h}
            graphData={grafo}
            backgroundColor="rgba(0,0,0,0)"
            cooldownTicks={200}
            linkHoverPrecision={6}
            nodeLabel={(n) => `${n.label} · ${singular(n.tipo)}${n.publicado ? "" : " (borrador)"}`}
            linkLabel={(l) => etiquetaArista(l.arista)}
            linkColor={(l) => (aristaSel?.id === l.id ? "#ffffff" : estilo(l.arista).color)}
            linkLineDash={(l) => estilo(l.arista).patron}
            linkWidth={(l) => (aristaSel?.id === l.id ? 3 : categoriaDe(l.arista) === "otras" ? 0.8 : 1.6)}
            onLinkClick={(l) => {
              setAristaSel(l.arista);
              setOrigen(null);
              setDestino(null);
            }}
            onNodeClick={pulsarNodo}
            onNodeHover={(n) => setHover(n ? (n.id as string) : null)}
            onBackgroundClick={limpiar}
            nodeCanvasObject={(n, ctx, escala) => {
              const r = 3 + Math.min(6, Math.sqrt(n.grado) * 1.4);
              const c = color(n.tipo);
              const activo = resaltados.has(n.id as string);
              ctx.beginPath();
              ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
              ctx.fillStyle = n.publicado ? c : `${c}55`;
              ctx.fill();
              if (!n.publicado) {
                ctx.lineWidth = 1 / escala;
                ctx.strokeStyle = c;
                ctx.stroke();
              }
              if (activo) {
                ctx.beginPath();
                ctx.arc(n.x!, n.y!, r + 3 / escala + 1, 0, 2 * Math.PI);
                ctx.lineWidth = 2 / escala;
                ctx.strokeStyle = n.id === destino ? "#e0b34a" : "#ffffff";
                ctx.stroke();
              }
              if (activo || escala > 1.6) {
                const fs = 11 / escala;
                ctx.font = `${fs}px Inter, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.lineWidth = 3 / escala;
                ctx.strokeStyle = "#0b0b12";
                ctx.strokeText(n.label, n.x!, n.y! + r + 2 / escala);
                ctx.fillStyle = "#e7e5f4";
                ctx.fillText(n.label, n.x!, n.y! + r + 2 / escala);
              }
            }}
            nodePointerAreaPaint={(n, pintura, ctx) => {
              const r = 3 + Math.min(6, Math.sqrt(n.grado) * 1.4) + 2;
              ctx.fillStyle = pintura;
              ctx.beginPath();
              ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
              ctx.fill();
            }}
          />
        </div>

        <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-fg-muted">
          {grafo.nodes.length} fichas · {grafo.links.length} conexiones · los borradores van en hueco
        </p>
      </div>

      {/* ── Panel ──────────────────────────────────────────────── */}
      <aside className="flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border-base bg-deep/60 p-4">
        <div>
          <input
            list="mapa-fichas"
            value={busqueda}
            onChange={(e) => {
              const v = e.target.value;
              setBusqueda(v);
              const hit = etiquetasBusqueda.find((x) => x.texto === v);
              if (hit) {
                centrar(hit.id);
                setBusqueda("");
              }
            }}
            placeholder="Buscar y centrar una ficha…"
            className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-border-glow"
          />
          <datalist id="mapa-fichas">
            {etiquetasBusqueda.map((e) => (
              <option key={e.id} value={e.texto} />
            ))}
          </datalist>
        </div>

        {aristaSel ? (
          <EditarConexion
            key={aristaSel.id}
            arista={aristaSel}
            a={porId.get(aristaSel.a)!}
            b={porId.get(aristaSel.b)!}
            catalogos={catalogos}
            onHecho={() => {
              setAristaSel(null);
              router.refresh();
            }}
          />
        ) : nOrigen && nDestino ? (
          <NuevaConexion
            key={`${nOrigen.id}>${nDestino.id}`}
            origen={nOrigen}
            destino={nDestino}
            catalogos={catalogos}
            onCancelar={() => setDestino(null)}
            onHecho={() => {
              setDestino(null);
              router.refresh();
            }}
          />
        ) : nOrigen ? (
          <FichaElegida n={nOrigen} grado={aristas.filter((x) => x.a === nOrigen.id || x.b === nOrigen.id).length} onSoltar={limpiar} />
        ) : (
          <Ayuda categorias={categorias} />
        )}
      </aside>
    </div>
  );
}

function etiquetaArista(a: AristaMapa): string {
  const rel = RELACIONES.find((r) => r.id === a.relId);
  const nombre = rel ? `${rel.b.titulo} / ${rel.a.titulo}` : a.relId;
  return a.matiz ? `${a.matiz} · ${nombre}` : nombre;
}

function Ayuda({ categorias }: { categorias: CategoriaRelacion[] }) {
  return (
    <div className="space-y-3 text-sm text-fg-secondary">
      <p>
        <strong className="text-fg">Unir:</strong> pulsa una ficha y luego otra. Se ofrecen las relaciones que existen entre esos dos
        tipos.
      </p>
      <p>
        <strong className="text-fg">Editar o borrar:</strong> pulsa una línea.
      </p>
      <p className="text-xs text-fg-muted">
        Rueda para acercar, arrastra el fondo para moverte y los nodos para recolocarlos (no se guarda: las posiciones salen
        solas).
      </p>
      {categorias.length === 0 && (
        <p className="rounded-lg border border-border-base bg-surface/40 p-2 text-xs text-fg-muted">
          Las relaciones entre personajes se pueden agrupar por categorías con color y estilo de línea propios.{" "}
          <Link href="/admin/catalogos" className="text-accent hover:underline">
            Créalas en Catálogos
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function FichaElegida({ n, grado, onSoltar }: { n: NodoMapa; grado: number; onSoltar: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: color(n.tipo) }} />
        <span className="text-xs uppercase tracking-wider text-fg-muted">{singular(n.tipo)}</span>
        {!n.publicado && <span className="text-[10px] uppercase text-warning">borrador</span>}
      </div>
      <h3 className="font-display text-xl text-fg">{n.label}</h3>
      <p className="text-xs text-fg-muted">{grado} conexiones</p>
      <p className="rounded-lg border border-border-glow/60 bg-surface/40 p-2 text-sm text-fg-secondary">Pulsa otra ficha para unirlas.</p>
      <div className="flex gap-2">
        <Link href={n.href} className="rounded-lg border border-border-glow px-3 py-1.5 text-sm text-accent hover:bg-surface">
          Abrir editor
        </Link>
        <button type="button" onClick={onSoltar} className="rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
          Soltar
        </button>
      </div>
    </div>
  );
}

// ── Formularios ────────────────────────────────────────────────────────────

const inp = "w-full rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow";

/** Las opciones de un campo de lista. `tipoRelacion` sale del catálogo `tipo_relacion`. */
function opcionesDe(campo: CampoVinculo, relId: string, catalogos: Record<string, string[]>): string[] | null {
  if (relId === "relaciones" && campo.name === "tipoRelacion") return catalogos.tipo_relacion ?? [];
  if (campo.tipo !== "select") return null;
  return campo.catalogo ? catalogos[campo.catalogo] ?? [] : campo.opciones ?? [];
}

function Campos({
  rel,
  valores,
  set,
  catalogos,
}: {
  rel: RelacionDef;
  valores: Record<string, string>;
  set: (name: string, v: string) => void;
  catalogos: Record<string, string[]>;
}) {
  if (rel.campos.length === 0) return null;
  return (
    <div className="space-y-2">
      {rel.campos.map((c) => {
        const opciones = opcionesDe(c, rel.id, catalogos);
        return (
          <label key={c.name} className="block">
            <span className="mb-0.5 block text-[11px] uppercase tracking-wider text-fg-muted">{c.label}</span>
            {c.tipo === "checkbox" ? (
              <input type="checkbox" checked={valores[c.name] === "true"} onChange={(e) => set(c.name, String(e.target.checked))} />
            ) : opciones ? (
              <select value={valores[c.name] ?? ""} onChange={(e) => set(c.name, e.target.value)} className={inp}>
                <option value="">—</option>
                {/* Un valor antiguo que ya no está en el catálogo sigue visible. */}
                {valores[c.name] && !opciones.includes(valores[c.name]) && <option value={valores[c.name]}>{valores[c.name]}</option>}
                {opciones.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input value={valores[c.name] ?? ""} onChange={(e) => set(c.name, e.target.value)} className={inp} />
            )}
          </label>
        );
      })}
    </div>
  );
}

function NuevaConexion({
  origen,
  destino,
  catalogos,
  onCancelar,
  onHecho,
}: {
  origen: NodoMapa;
  destino: NodoMapa;
  catalogos: Record<string, string[]>;
  onCancelar: () => void;
  onHecho: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const opciones = useMemo(() => opcionesEntre(origen.tipo, destino.tipo), [origen.tipo, destino.tipo]);
  const [elegida, setElegida] = useState(0);
  const [valores, setValores] = useState<Record<string, string>>({});
  const op = opciones[elegida];

  const crear = () =>
    start(async () => {
      if (!op) return;
      try {
        await crearVinculo(op.rel.id, op.lado, origen.entidadId, { id: destino.entidadId, tipo: destino.tipo }, valores);
        toast("Conexión creada.", "success");
        onHecho();
      } catch {
        toast("No se pudo crear la conexión.", "error");
      }
    });

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-fg">Nueva conexión</h3>
      <p className="text-sm text-fg-secondary">
        <span className="text-fg">{origen.label}</span> <span className="text-fg-muted">({singular(origen.tipo)})</span> ↔{" "}
        <span className="text-fg">{destino.label}</span> <span className="text-fg-muted">({singular(destino.tipo)})</span>
      </p>
      {opciones.length === 0 ? (
        <p className="rounded-lg border border-border-base bg-surface/40 p-2 text-sm text-fg-muted">
          El registro de relaciones no declara ninguna relación entre {nombreTipo(origen.tipo).toLowerCase()} y{" "}
          {nombreTipo(destino.tipo).toLowerCase()}.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            {opciones.map((o, i) => {
              const titulo = o.lado === "a" ? o.rel.a.titulo : o.rel.b.titulo;
              return (
                <label key={`${o.rel.id}:${o.lado}`} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm", i === elegida ? "border-border-glow bg-surface/60" : "border-border-base")}>
                  <input
                    type="radio"
                    checked={i === elegida}
                    onChange={() => {
                      setElegida(i);
                      setValores({});
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-fg">{titulo}</span>
                    <span className="block text-xs text-fg-muted">
                      En la ficha de {origen.label}
                      {o.rel.medio === "referencia" ? " · sustituye la que tuviera" : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {op && <Campos rel={op.rel} valores={valores} set={(k, v) => setValores((p) => ({ ...p, [k]: v }))} catalogos={catalogos} />}
        </>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={pending || !op} onClick={crear} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-void disabled:opacity-40">
          {pending ? "Creando…" : "Unir"}
        </button>
        <button type="button" onClick={onCancelar} className="rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function EditarConexion({
  arista,
  a,
  b,
  catalogos,
  onHecho,
}: {
  arista: AristaMapa;
  a: NodoMapa;
  b: NodoMapa;
  catalogos: Record<string, string[]>;
  onHecho: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const rel = RELACIONES.find((r) => r.id === arista.relId);
  const [valores, setValores] = useState<Record<string, string> | null>(null);
  const [cambiado, setCambiado] = useState(false);

  // Los campos de la fila se piden al abrirla: el mapa solo trae el destacado.
  useEffect(() => {
    let vivo = true;
    listarVinculos(arista.relId, "a", a.entidadId)
      .then((filas) => {
        if (vivo) setValores(filas.find((f) => f.id === arista.fila)?.campos ?? {});
      })
      .catch(() => vivo && setValores({}));
    return () => {
      vivo = false;
    };
  }, [arista.relId, arista.fila, a.entidadId]);

  if (!rel) return <p className="text-sm text-fg-muted">Relación desconocida: {arista.relId}.</p>;

  const guardar = () =>
    start(async () => {
      try {
        await actualizarVinculo(rel.id, "a", a.entidadId, arista.fila, valores ?? {});
        toast("Conexión guardada.", "success");
        onHecho();
      } catch {
        toast("No se pudo guardar.", "error");
      }
    });

  const borrar = () => {
    if (!confirm(`¿Borrar la conexión entre ${a.label} y ${b.label}?`)) return;
    start(async () => {
      try {
        await borrarVinculo(rel.id, "a", a.entidadId, arista.fila);
        toast("Conexión borrada.", "success");
        onHecho();
      } catch {
        toast("No se pudo borrar.", "error");
      }
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-fg">Conexión</h3>
      <div className="space-y-1 text-sm">
        {[
          [a, rel.a.titulo],
          [b, rel.b.titulo],
        ].map(([n, titulo]) => {
          const nodo = n as NodoMapa;
          return (
            <Link key={nodo.id} href={nodo.href} className="flex items-center gap-2 rounded-lg border border-border-base bg-surface/40 px-2 py-1.5 hover:border-border-glow">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color(nodo.tipo) }} />
              <span className="min-w-0 flex-1 truncate text-fg">{nodo.label}</span>
              <span className="text-[11px] text-fg-muted">ve «{titulo as string}»</span>
            </Link>
          );
        })}
      </div>
      {valores === null ? (
        <p className="text-xs text-fg-muted">Cargando…</p>
      ) : rel.campos.length === 0 ? (
        <p className="text-xs text-fg-muted">Esta relación no tiene más datos que el enlace.</p>
      ) : (
        <Campos
          rel={rel}
          valores={valores}
          set={(k, v) => {
            setValores((p) => ({ ...(p ?? {}), [k]: v }));
            setCambiado(true);
          }}
          catalogos={catalogos}
        />
      )}
      <div className="flex gap-2">
        {rel.campos.length > 0 && (
          <button type="button" disabled={pending || !cambiado} onClick={guardar} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-void disabled:opacity-40">
            Guardar
          </button>
        )}
        <button type="button" disabled={pending} onClick={borrar} className="rounded-lg border border-error/40 px-3 py-1.5 text-sm text-error hover:bg-error/10 disabled:opacity-40">
          Borrar conexión
        </button>
      </div>
    </div>
  );
}
