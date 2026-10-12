"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { crearCapitulo, moverActo, reordenarCapitulos } from "@/lib/actions/taller";
import type { CapituloEditor, CapituloTaller, OpcionesCapitulo, TallerIndice } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { botonCls, Campo, inputCls, InsigniaFase, PuntoEstado, SelectId, SelectTexto } from "../ui";
import { CapituloForm } from "./CapituloForm";

/**
 * Organizar capítulos (spec §6): árbol libro > capítulo > acto.
 *
 * - Los capítulos se arrastran dentro de su libro (cambia su número).
 * - Los actos se arrastran entre capítulos o dentro del suyo, o se mandan a
 *   otro con su desplegable. Al cambiar de plantilla caen en la primera fase.
 * - El libro de un capítulo se cambia en su editor, no arrastrando.
 *
 * El arrastre es la API nativa de HTML5: el taller es solo de escritorio.
 */

type Arrastre = { tipo: "capitulo"; id: number; libro: string } | { tipo: "acto"; id: number };
const MIME = "application/x-astralys-taller";

export function Organizar({
  indice,
  opciones,
  seleccionado,
}: {
  indice: TallerIndice;
  opciones: OpcionesCapitulo;
  seleccionado: CapituloEditor | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [cerrados, setCerrados] = useState<Set<number>>(new Set());
  const [sobre, setSobre] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const fases = useMemo(() => new Map(indice.plantillas.flatMap((p) => p.fases).map((f) => [f.id, f])), [indice.plantillas]);
  const porLibro = useMemo(
    () =>
      indice.libros.map((libro) => ({
        libro,
        capitulos: indice.capitulos.filter((c) => (c.libro ?? "") === libro).sort((a, b) => a.orden - b.orden || a.id - b.id),
      })),
    [indice],
  );
  const capitulosPlanos = porLibro.flatMap((l) => l.capitulos);

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "No se pudo guardar.", "error");
      if (ok) toast(ok, "success");
      router.refresh();
    });

  const leer = (e: React.DragEvent): Arrastre | null => {
    try {
      return JSON.parse(e.dataTransfer.getData(MIME)) as Arrastre;
    } catch {
      return null;
    }
  };

  /** Soltar sobre un capítulo: reordenar capítulos del mismo libro, o meter un acto al final. */
  const soltarEnCapitulo = (e: React.DragEvent, destino: CapituloTaller, hermanos: CapituloTaller[]) => {
    e.preventDefault();
    setSobre(null);
    const d = leer(e);
    if (!d) return;
    if (d.tipo === "acto") {
      const n = indice.actos.filter((a) => a.capituloId === destino.id && a.id !== d.id).length;
      return ejecutar(() => moverActo(d.id, destino.id, n));
    }
    if (d.libro !== (destino.libro ?? "")) return toast("Para cambiar de libro, edita el capítulo.", "info");
    if (d.id === destino.id) return;
    const ids = hermanos.map((c) => c.id).filter((id) => id !== d.id);
    ids.splice(ids.indexOf(destino.id), 0, d.id);
    ejecutar(() => reordenarCapitulos(destino.libro, ids), "Capítulos reordenados.");
  };

  /** Soltar un acto sobre otro acto: ocupa su posición. */
  const soltarEnActo = (e: React.DragEvent, capituloId: number, posicion: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSobre(null);
    const d = leer(e);
    if (!d || d.tipo !== "acto") return;
    ejecutar(() => moverActo(d.id, capituloId, posicion));
  };

  return (
    <div className={cn("grid h-screen", seleccionado ? "grid-cols-[1fr_440px]" : "grid-cols-1")}>
      <div className="h-screen overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-base bg-deep/90 px-6 py-4 backdrop-blur">
          <h1 className="font-display text-xl text-fg">Organizar capítulos</h1>
          <span className="text-xs text-fg-muted">Arrastra para reordenar o mover actos</span>
          <button type="button" onClick={() => setCreando((v) => !v)} className={cn(botonCls, "ml-auto")}>
            <Icon name="Plus" size={14} /> Capítulo
          </button>
        </header>

        {creando && (
          <NuevoCapitulo
            opciones={opciones}
            indice={indice}
            pending={pending}
            onCrear={(datos) =>
              start(async () => {
                const r = await crearCapitulo(datos);
                if (!r.ok) return toast(r.error, "error");
                setCreando(false);
                toast("Capítulo creado.", "success");
                router.push(`/admin/taller/capitulos?capitulo=${r.data.id}`);
              })
            }
          />
        )}

        <div className="space-y-6 px-6 py-6">
          {porLibro.map(({ libro, capitulos }) => (
            <section key={libro || "_sin"}>
              <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-accent">
                <Icon name="BookOpen" size={16} /> {libro || "Sin libro"}
                <span className="text-xs text-fg-muted">{capitulos.length} capítulos</span>
              </h2>
              <div className="space-y-2">
                {capitulos.map((c) => {
                  const actos = indice.actos.filter((a) => a.capituloId === c.id);
                  const abierto = !cerrados.has(c.id);
                  const plantilla = indice.plantillas.find((p) => p.id === c.plantillaId);
                  const clave = `cap-${c.id}`;
                  return (
                    <div
                      key={c.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setSobre(clave);
                      }}
                      onDragLeave={() => setSobre((s) => (s === clave ? null : s))}
                      onDrop={(e) => soltarEnCapitulo(e, c, capitulos)}
                      className={cn(
                        "rounded-xl border bg-surface/40 transition-colors",
                        seleccionado?.id === c.id ? "border-accent" : "border-border-base",
                        sobre === clave && "border-border-glow bg-surface",
                      )}
                    >
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(MIME, JSON.stringify({ tipo: "capitulo", id: c.id, libro: c.libro ?? "" } satisfies Arrastre));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className="flex cursor-grab items-center gap-2 px-3 py-2.5"
                      >
                        <Icon name="GripVertical" size={15} className="text-fg-muted" />
                        <button
                          type="button"
                          onClick={() =>
                            setCerrados((prev) => {
                              const n = new Set(prev);
                              if (n.has(c.id)) n.delete(c.id);
                              else n.add(c.id);
                              return n;
                            })
                          }
                          className="text-fg-muted"
                          aria-label={abierto ? "Plegar" : "Desplegar"}
                        >
                          <Icon name={abierto ? "ChevronDown" : "ChevronRight"} size={15} />
                        </button>
                        <PuntoEstado estado={c.estadoPublicacion} />
                        <Link href={`/admin/taller/capitulos?capitulo=${c.id}`} className="min-w-0 flex-1 truncate">
                          <span className="font-display text-sm text-accent">{c.numero}</span>
                          <span className="text-fg"> — {c.titulo}</span>
                        </Link>
                        {plantilla ? (
                          <span className="text-[11px] text-fg-muted">{plantilla.nombre}</span>
                        ) : (
                          <span className="text-[11px] text-warning">Sin plantilla</span>
                        )}
                        <span className="text-xs text-fg-muted">({actos.length})</span>
                      </div>

                      {abierto && (
                        <div className="space-y-1 border-t border-border-base px-3 py-2">
                          {actos.map((a) => {
                            const claveActo = `acto-${a.id}`;
                            return (
                              <div
                                key={a.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData(MIME, JSON.stringify({ tipo: "acto", id: a.id } satisfies Arrastre));
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSobre(claveActo);
                                }}
                                onDrop={(e) => soltarEnActo(e, c.id, a.posicion)}
                                className={cn(
                                  "flex cursor-grab items-center gap-2 rounded-lg border px-2 py-1.5",
                                  sobre === claveActo ? "border-border-glow bg-surface" : "border-transparent hover:bg-surface/60",
                                )}
                              >
                                <Icon name="GripVertical" size={13} className="text-fg-muted" />
                                <PuntoEstado estado={a.estadoPublicacion} />
                                <Link href={`/admin/taller/escribe?acto=${a.id}`} className="min-w-0 flex-1 truncate text-sm text-fg-secondary hover:text-fg">
                                  <span className="text-fg-muted">{a.etiqueta} · </span>
                                  {a.nombre}
                                </Link>
                                <InsigniaFase fase={fases.get(a.faseId ?? -1)} />
                                <select
                                  value={c.id}
                                  onChange={(e) => {
                                    const destino = Number(e.target.value);
                                    const n = indice.actos.filter((x) => x.capituloId === destino).length;
                                    ejecutar(() => moverActo(a.id, destino, n), "Acto movido.");
                                  }}
                                  className="max-w-48 rounded-md border border-border-base bg-surface px-1.5 py-0.5 text-[11px] text-fg-muted"
                                  title="Mover a otro capítulo"
                                >
                                  {capitulosPlanos.map((x) => (
                                    <option key={x.id} value={x.id}>
                                      {x.numero} — {x.titulo}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                          {actos.length === 0 && <p className="px-2 py-1 text-xs italic text-fg-muted">Sin actos. Suelta uno aquí.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {capitulos.length === 0 && <p className="text-sm italic text-fg-muted">Este libro aún no tiene capítulos.</p>}
              </div>
            </section>
          ))}
          {porLibro.length === 0 && <p className="text-sm italic text-fg-muted">Aún no hay capítulos.</p>}
        </div>
      </div>

      {seleccionado && (
        <aside className="h-screen overflow-y-auto border-l border-border-base bg-deep/60 px-5 py-5">
          <div className="mb-3 flex items-center">
            <h2 className="font-display text-lg text-fg">Edición rápida</h2>
            <Link href="/admin/taller/capitulos" className="ml-auto text-fg-muted hover:text-fg" aria-label="Cerrar">
              <Icon name="X" size={16} />
            </Link>
          </div>
          <CapituloForm key={seleccionado.id} capitulo={seleccionado} opciones={opciones} plantillas={indice.plantillas} compacto />
        </aside>
      )}
    </div>
  );
}

function NuevoCapitulo({
  opciones,
  indice,
  pending,
  onCrear,
}: {
  opciones: OpcionesCapitulo;
  indice: TallerIndice;
  pending: boolean;
  onCrear: (d: { titulo: string; libro: string | null; tipo: string | null; plantillaId: number | null }) => void;
}) {
  const predeterminada = indice.plantillas.find((p) => p.predeterminada) ?? null;
  const [titulo, setTitulo] = useState("");
  const [libro, setLibro] = useState(opciones.libros[0] ?? "");
  const [tipo, setTipo] = useState("");
  const [plantillaId, setPlantillaId] = useState<number | null>(predeterminada?.id ?? null);

  if (indice.plantillas.length === 0)
    return (
      <p className="border-b border-border-base bg-deep/60 px-6 py-3 text-sm text-warning">
        Todo capítulo necesita una plantilla de estructura.{" "}
        <Link href="/admin/taller/estructura?vista=plantillas" className="underline">
          Crea la primera en Estructura
        </Link>
        .
      </p>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (titulo.trim()) onCrear({ titulo: titulo.trim(), libro: libro || null, tipo: tipo || null, plantillaId });
      }}
      className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-end gap-3 border-b border-border-base bg-deep/60 px-6 py-4"
    >
      <Campo label="Título">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus className={inputCls} />
      </Campo>
      <Campo label="Libro">
        <SelectTexto value={libro} onChange={setLibro} opciones={opciones.libros} vacio="Sin libro" />
      </Campo>
      <Campo label="Tipo">
        <SelectTexto value={tipo} onChange={setTipo} opciones={opciones.tipos} />
      </Campo>
      <Campo label="Plantilla">
        <SelectId value={plantillaId} onChange={setPlantillaId} opciones={indice.plantillas.map((p) => ({ id: p.id, label: p.nombre }))} />
      </Campo>
      <button type="submit" disabled={pending || !titulo.trim() || plantillaId == null} className={botonCls}>
        Crear
      </button>
    </form>
  );
}
