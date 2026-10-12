"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { FechaInput } from "@/components/admin/FechaInput";
import { BloqueVinculos } from "@/components/admin/vinculos/BloqueVinculos";
import {
  asignarFase,
  borrarActo,
  crearHiloEnActo,
  crearHojaEnActo,
  guardarActo,
  marcarHiloEnActo,
  vincularEventoActo,
} from "@/lib/actions/taller";
import type { Calendario, Fecha } from "@/lib/fechas";
import type { ActoEditor as DatosActo, FaseTaller } from "@/lib/queries/taller";
import { bloqueDe } from "@/lib/relaciones/registro";
import { cn } from "@/lib/utils";
import { botonCls, botonPrimarioCls, Campo, inputCls, InsigniaFase, SelectEstado, SelectTexto } from "../ui";

/** Relaciones del acto que se editan aquí, en este orden (spec §4). */
const RELACIONES_ACTO = ["acto_pov", "acto_personaje", "acto_nacion", "acto_region", "acto_locacion", "acto_arco", "acto_cancion"];

/**
 * Editor completo de un acto (spec §4). Los datos propios y la fecha se guardan
 * con el botón; las relaciones, la fase y la trama se guardan al momento, cada
 * una por su lado, igual que en el resto del panel.
 */
export function ActoEditor({
  datos,
  etiqueta,
  capitulo,
  fases,
  estadosNarrativos,
  cal,
}: {
  datos: DatosActo;
  etiqueta: string;
  capitulo: { id: number; numero: string; titulo: string; plantillaId: number | null } | null;
  fases: FaseTaller[];
  estadosNarrativos: string[];
  cal: Calendario | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const a = datos.acto;

  const [nombre, setNombre] = useState(a.nombre);
  const [resumen, setResumen] = useState(a.descripcion ?? "");
  const [estado, setEstado] = useState(a.estado ?? "");
  const [notas, setNotas] = useState(a.notasPrivadas ?? "");
  const [discord, setDiscord] = useState(a.discordUrl ?? "");
  const [publicacion, setPublicacion] = useState(a.estadoPublicacion);
  const [fecha, setFecha] = useState<Fecha | null>(datos.fecha);
  const [importante, setImportante] = useState(datos.importante);
  const [cambios, setCambios] = useState(false);

  const marcar =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setCambios(true);
    };

  // Avisa antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!cambios) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [cambios]);

  const guardar = () =>
    start(async () => {
      const r = await guardarActo(a.id, {
        nombre,
        descripcion: resumen,
        estado,
        notasPrivadas: notas,
        discordUrl: discord,
        estadoPublicacion: publicacion,
        fecha,
        importante,
      });
      if (!r.ok) return toast(r.error, "error");
      setCambios(false);
      toast("Acto guardado.", "success");
      router.refresh();
    });

  /** Ejecuta una acción inmediata y refresca los datos del servidor. */
  const ya = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "No se pudo guardar.", "error");
      if (ok) toast(ok, "success");
      router.refresh();
    });

  const faseActual = fases.find((f) => f.id === a.faseId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 py-6 pb-28">
      {/* ── Cabecera ─────────────────────────────────────────────────── */}
      <div>
        <p className="mb-1 flex items-center gap-2 text-xs text-fg-muted">
          {capitulo ? (
            <Link href={`/admin/taller/capitulos/${capitulo.id}`} className="hover:text-fg">
              {capitulo.numero} — {capitulo.titulo}
            </Link>
          ) : (
            <span className="text-warning">Sin capítulo</span>
          )}
          <span>·</span>
          <span className="text-fg-secondary">{etiqueta}</span>
        </p>
        <input
          value={nombre}
          onChange={(e) => marcar(setNombre)(e.target.value)}
          placeholder="Nombre del acto"
          className="w-full rounded-xl border border-border-base bg-surface/60 px-4 py-3 font-display text-2xl text-fg outline-none focus:border-border-glow"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Campo label="Fase" hint={faseActual?.guia ?? undefined}>
          {capitulo?.plantillaId ? (
            <div className="flex items-center gap-2">
              <select
                value={a.faseId ?? ""}
                onChange={(e) => ya(() => asignarFase(a.id, Number(e.target.value)), "Fase cambiada.")}
                className={inputCls}
              >
                {a.faseId == null && <option value="">— Elige fase —</option>}
                {fases.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
              <InsigniaFase fase={faseActual} />
            </div>
          ) : (
            <p className="py-2 text-xs text-warning">
              El capítulo no tiene plantilla.{" "}
              <Link href="/admin/taller/estructura" className="underline">
                Elígela en Estructura
              </Link>
              .
            </p>
          )}
        </Campo>
        <Campo label="Estado narrativo">
          <SelectTexto value={estado} onChange={marcar(setEstado)} opciones={estadosNarrativos} />
        </Campo>
        <Campo label="Publicación">
          <SelectEstado value={publicacion} onChange={marcar(setPublicacion)} />
        </Campo>
      </div>

      <Campo label="Resumen" hint="Se añade a la descripción pública del capítulo, debajo de su intro.">
        <textarea value={resumen} onChange={(e) => marcar(setResumen)(e.target.value)} rows={5} className={inputCls} />
      </Campo>

      <Campo label="Fecha (inicio y fin)">
        {cal ? (
          <>
            <FechaInput cal={cal} value={fecha} onChange={marcar(setFecha)} />
            <label className="mt-2 flex items-center gap-1.5 text-xs text-fg-secondary">
              <input type="checkbox" checked={importante} onChange={(e) => marcar(setImportante)(e.target.checked)} />
              Importante (sale en la cronología destacada)
            </label>
          </>
        ) : (
          <p className="text-xs text-warning">El calendario no está disponible.</p>
        )}
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Enlace en Discord">
          <input value={discord} onChange={(e) => marcar(setDiscord)(e.target.value)} placeholder="https://discord.com/…" className={inputCls} />
        </Campo>
        <Campo label="Notas privadas" hint="No se publican nunca.">
          <textarea value={notas} onChange={(e) => marcar(setNotas)(e.target.value)} rows={2} className={inputCls} />
        </Campo>
      </div>

      {/* ── Relaciones ───────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="font-display text-lg text-fg">Personajes, lugares y trama</h2>
        <p className="text-xs text-fg-muted">Se guardan al momento. El capítulo suma los de todos sus actos.</p>
        <div className="grid grid-cols-2 gap-2">
          {RELACIONES_ACTO.map((relId) => {
            const b = bloqueDe("actos", relId, "a");
            return b ? <BloqueVinculos key={relId} bloque={b} ownerId={a.id} abiertoInicial /> : null;
          })}
        </div>
      </section>

      <Trama datos={datos} pendiente={pending} ya={ya} />

      {/* ── Barra de acciones ────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-[calc(220px+340px)] right-0 z-20 flex items-center gap-3 border-t border-border-base bg-deep/95 px-8 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            if (!confirm(`¿Mandar «${a.nombre}» a la papelera?`)) return;
            start(async () => {
              const r = await borrarActo(a.id);
              if (!r.ok) return toast(r.error, "error");
              toast("Acto en la papelera.", "success");
              router.push("/admin/taller/escribe");
            });
          }}
          className={cn(botonCls, "hover:text-error")}
        >
          <Icon name="Trash2" size={14} /> Papelera
        </button>
        {cambios && <span className="ml-auto text-xs text-warning">Hay cambios sin guardar</span>}
        <button type="button" onClick={guardar} disabled={pending || !cambios} className={cn(botonPrimarioCls, !cambios && "ml-auto")}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

/** Hojas, hilos y eventos ligados al acto. Todo se guarda al momento. */
function Trama({
  datos,
  pendiente,
  ya,
}: {
  datos: DatosActo;
  pendiente: boolean;
  ya: (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => void;
}) {
  const id = datos.acto.id;
  const [hoja, setHoja] = useState("");
  const [hiloNuevo, setHiloNuevo] = useState("");
  const [hiloSel, setHiloSel] = useState("");
  const [eventoSel, setEventoSel] = useState("");

  const ligados = new Set(datos.eventos.map((e) => e.id));

  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg text-fg">Hojas, hilos y cronología</h2>

      <div className="grid grid-cols-3 gap-4">
        {/* Hojas */}
        <div className="rounded-xl border border-border-base bg-surface/30 p-3">
          <h3 className="mb-2 text-sm font-medium text-fg">Hojas de trama</h3>
          <ul className="mb-2 space-y-1">
            {datos.hojas.map((h) => (
              <li key={h.id}>
                <Link href={`/admin/taller/trama/hojas/${h.id}`} className="block truncate text-sm text-fg-secondary hover:text-accent">
                  {h.titulo}
                  {h.estado && <span className="text-fg-muted"> · {h.estado}</span>}
                </Link>
              </li>
            ))}
            {datos.hojas.length === 0 && <li className="text-xs italic text-fg-muted">Ninguna.</li>}
          </ul>
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!hoja.trim()) return;
              ya(() => crearHojaEnActo(id, hoja), "Hoja creada.");
              setHoja("");
            }}
          >
            <input value={hoja} onChange={(e) => setHoja(e.target.value)} placeholder="Nueva hoja…" className={cn(inputCls, "py-1 text-xs")} />
            <button type="submit" disabled={pendiente} className={botonCls}>
              <Icon name="Plus" size={13} />
            </button>
          </form>
        </div>

        {/* Hilos */}
        <div className="rounded-xl border border-border-base bg-surface/30 p-3">
          <h3 className="mb-2 text-sm font-medium text-fg">Hilos</h3>
          {(["apertura", "cierre"] as const).map((cual) => {
            const lista = cual === "apertura" ? datos.hilosAbre : datos.hilosCierra;
            return (
              <div key={cual} className="mb-2">
                <p className="text-[11px] uppercase tracking-wide text-fg-muted">{cual === "apertura" ? "Abre" : "Cierra"}</p>
                {lista.map((h) => (
                  <div key={h.id} className="flex items-center gap-1 text-sm text-fg-secondary">
                    <Link href={`/admin/taller/trama/hilos/${h.id}`} className="flex-1 truncate hover:text-accent">
                      {h.nombre}
                    </Link>
                    <button
                      type="button"
                      onClick={() => ya(() => marcarHiloEnActo(h.id, id, cual, false))}
                      className="text-fg-muted hover:text-error"
                      aria-label="Quitar"
                    >
                      <Icon name="X" size={13} />
                    </button>
                  </div>
                ))}
                {lista.length === 0 && <p className="text-xs italic text-fg-muted">Ninguno.</p>}
              </div>
            );
          })}
          <div className="flex gap-1">
            <select value={hiloSel} onChange={(e) => setHiloSel(e.target.value)} className={cn(inputCls, "py-1 text-xs")}>
              <option value="">Hilo existente…</option>
              {datos.todosHilos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </select>
            <button type="button" disabled={!hiloSel || pendiente} onClick={() => ya(() => marcarHiloEnActo(Number(hiloSel), id, "apertura", true))} className={botonCls}>
              Abre
            </button>
            <button type="button" disabled={!hiloSel || pendiente} onClick={() => ya(() => marcarHiloEnActo(Number(hiloSel), id, "cierre", true))} className={botonCls}>
              Cierra
            </button>
          </div>
          <form
            className="mt-1 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!hiloNuevo.trim()) return;
              ya(() => crearHiloEnActo(id, hiloNuevo), "Hilo creado: se abre en este acto.");
              setHiloNuevo("");
            }}
          >
            <input value={hiloNuevo} onChange={(e) => setHiloNuevo(e.target.value)} placeholder="Hilo nuevo…" className={cn(inputCls, "py-1 text-xs")} />
            <button type="submit" disabled={pendiente} className={botonCls}>
              <Icon name="Plus" size={13} />
            </button>
          </form>
        </div>

        {/* Eventos */}
        <div className="rounded-xl border border-border-base bg-surface/30 p-3">
          <h3 className="mb-2 text-sm font-medium text-fg">Eventos de la cronología</h3>
          <ul className="mb-2 space-y-1">
            {datos.eventos.map((ev) => (
              <li key={ev.id} className="flex items-center gap-1 text-sm text-fg-secondary">
                <span className="flex-1 truncate">
                  {ev.titulo} {ev.fecha && <span className="font-mono text-xs text-fg-muted">{ev.fecha}</span>}
                </span>
                <button type="button" onClick={() => ya(() => vincularEventoActo(ev.id, null))} className="text-fg-muted hover:text-error" aria-label="Desligar">
                  <Icon name="X" size={13} />
                </button>
              </li>
            ))}
            {datos.eventos.length === 0 && <li className="text-xs italic text-fg-muted">Ninguno.</li>}
          </ul>
          <div className="flex gap-1">
            <select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} className={cn(inputCls, "py-1 text-xs")}>
              <option value="">Evento…</option>
              {datos.todosEventos
                .filter((ev) => !ligados.has(ev.id))
                .map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.fecha ? `${ev.fecha} · ${ev.titulo}` : ev.titulo}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!eventoSel || pendiente}
              onClick={() => {
                ya(() => vincularEventoActo(Number(eventoSel), id), "Evento ligado.");
                setEventoSel("");
              }}
              className={botonCls}
            >
              <Icon name="Plus" size={13} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
