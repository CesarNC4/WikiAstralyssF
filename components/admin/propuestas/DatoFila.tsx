"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { subInp } from "@/components/admin/blocks/shared";
import { MarkdownField, Select } from "@/components/admin/fields";
import { SelectorFicha } from "@/components/admin/vinculos/SelectorFicha";
import { textosFecha } from "@/lib/fechas/formato";
import { leerFecha } from "@/lib/fechas/leer";
import type { Calendario } from "@/lib/fechas/tipos";
import { diferencias } from "@/lib/propuestas/diff";
import { faltaEn, type Analisis, type DatoAnalizado, type Decision, type Objetivo } from "@/lib/propuestas/tipos";
import { cn } from "@/lib/utils";

/**
 * Un dato de una propuesta: lo que hay ahora, lo que se propone (editable) y qué hacer
 * con él. Lo que se deja para luego o se descarta no se edita: se queda en el archivo
 * tal cual estaba, o desaparece, y un retoque ahí se perdería sin avisar.
 */

const ETIQUETAS: Record<Decision, string> = {
  visible: "Visible",
  oculto: "Oculto",
  notas: "A notas",
  descartar: "Descartar",
  luego: "Luego",
};

const TONOS: Record<Decision, string> = {
  visible: "bg-success/15 text-success",
  oculto: "bg-warning/15 text-warning",
  notas: "bg-accent/15 text-accent",
  descartar: "bg-error/15 text-error",
  luego: "bg-elevated text-fg",
};

function opcionesDe(d: DatoAnalizado): Decision[] {
  if (d.obligatorio) return ["visible"];
  if (d.vaciar) return ["visible", "descartar", "luego"];
  if (d.clase === "quitar" || d.clase === "quitar-lista") return ["visible", "descartar", "luego"];
  if (d.clase === "nota") return ["notas", "descartar", "luego"];
  if (d.clase === "desconocido") return ["notas", "descartar", "luego"];
  return [...(["visible"] as const), ...(d.ocultable ? (["oculto"] as const) : []), ...(d.aNotas ? (["notas"] as const) : []), "descartar", "luego"];
}

function Decisiones({ dato, onCambio }: { dato: DatoAnalizado; onCambio: (d: Decision) => void }) {
  const quitar = dato.clase === "quitar" || dato.clase === "quitar-lista";
  // Sin esto, "Visible" en algo que se va a borrar no significaría nada.
  const aplicar = quitar ? "Quitar" : dato.vaciar ? "Vaciar" : ETIQUETAS.visible;
  return (
    <div role="group" aria-label={`Qué hacer con ${dato.rotulo}`} className="flex flex-wrap gap-0.5 rounded-lg border border-border-base p-0.5 text-[11px]">
      {opcionesDe(dato).map((op) => (
        <button
          key={op}
          type="button"
          aria-pressed={dato.decision === op}
          onClick={() => onCambio(op)}
          className={cn("rounded px-1.5 py-0.5 transition-colors", dato.decision === op ? TONOS[op] : "text-fg-muted hover:text-fg")}
        >
          {op === "visible" ? aplicar : ETIQUETAS[op]}
        </button>
      ))}
    </div>
  );
}

/** Lo actual y lo propuesto, uno sobre otro, con lo que cambia resaltado. */
function Comparar({ actual, propuesto, anadir }: { actual: string; propuesto: string; anadir: boolean }) {
  const tramos = useMemo(() => (anadir ? null : diferencias(actual, propuesto)), [actual, propuesto, anadir]);
  const caja = "max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border-base bg-deep/40 px-3 py-2 text-sm text-fg-secondary";
  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-fg-muted">Ahora</p>
        <div className={caja}>
          {tramos
            ? tramos.filter((t) => t.tipo !== "anadido").map((t, i) => (t.tipo === "quitado" ? <del key={i} className="rounded bg-error/20 text-error">{t.texto}</del> : <span key={i}>{t.texto}</span>))
            : actual}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-fg-muted">{anadir ? "Se añade al final" : "Propuesto"}</p>
        <div className={caja}>
          {tramos
            ? tramos.filter((t) => t.tipo !== "quitado").map((t, i) => (t.tipo === "anadido" ? <ins key={i} className="rounded bg-success/20 text-success no-underline">{t.texto}</ins> : <span key={i}>{t.texto}</span>))
            : propuesto}
        </div>
      </div>
    </div>
  );
}

function TextoLargo({ dato, onValor }: { dato: DatoAnalizado; onValor: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const hayActual = Boolean(dato.actual);
  return (
    <div>
      {editando || !dato.valor ? (
        <MarkdownField value={dato.valor} onChange={onValor} rows={Math.min(14, Math.max(4, dato.valor.split("\n").length + 2))} />
      ) : hayActual ? (
        <Comparar actual={dato.actual!} propuesto={dato.valor} anadir={dato.anadir} />
      ) : (
        <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border-base bg-deep/40 px-3 py-2 text-sm text-fg-secondary">{dato.valor}</div>
      )}
      {dato.valor && (
        <button type="button" onClick={() => setEditando(!editando)} className="mt-1 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
          <Icon name="Pencil" size={11} /> {editando ? (hayActual ? "Volver a comparar" : "Terminar de editar") : "Editar el texto"}
        </button>
      )}
    </div>
  );
}

const estadoCorto = (e: string | null) => (e && e !== "publicado" ? ` · ${e}` : "");

/** A qué ficha apunta: la elegida, un borrador por crear, o un nombre sin ficha. */
function ElegirFicha({ objetivo, rotulo, onCambio }: { objetivo: Objetivo; rotulo?: string; onCambio: (o: Objetivo) => void }) {
  const [buscando, setBuscando] = useState(false);
  const entidad = objetivo.entidadElegida ?? objetivo.entidad;
  const limpio: Objetivo = { ...objetivo, id: null, label: null, estado: null, crear: false, sinFicha: false };
  const puedeCrear = entidad !== "*";
  const boton = "rounded border border-border-base px-1.5 py-0.5 text-xs text-fg-secondary hover:border-border-glow hover:text-fg";

  let estado;
  if (objetivo.id != null) estado = <><Icon name="Check" size={12} className="text-success" /> <span className="text-fg">{objetivo.label}</span> <span className="text-fg-muted">#{objetivo.id}{estadoCorto(objetivo.estado)}</span></>;
  else if (objetivo.crear) estado = <><Icon name="Plus" size={12} className="text-accent" /> <span className="text-fg">{objetivo.nombre}</span> <span className="text-fg-muted">se crea como borrador al aplicar</span></>;
  else if (objetivo.sinFicha) estado = <><span className="text-fg">{objetivo.nombre}</span> <span className="text-fg-muted">sin ficha: solo se guarda el nombre</span></>;
  else estado = <><Icon name="TriangleAlert" size={12} className="text-warning" /> <span className="text-fg">{objetivo.nombre}</span> <span className="text-warning">{objetivo.nombre ? "sin resolver" : "falta elegirla"}</span></>;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {rotulo && <span className="text-xs text-fg-muted">{rotulo}:</span>}
        {estado}
        {!buscando && (
          <button type="button" onClick={() => setBuscando(true)} className={boton}>
            {objetivo.id != null || objetivo.crear || objetivo.sinFicha ? "Cambiar" : "Buscar otra"}
          </button>
        )}
      </div>
      {objetivo.id == null && !buscando && (
        <div className="flex flex-wrap items-center gap-1.5">
          {objetivo.candidatos.map((c) => (
            <button key={`${c.entidad}:${c.id}`} type="button" onClick={() => onCambio({ ...limpio, id: c.id, entidadElegida: c.entidad, label: c.label, estado: c.estado })} className={boton}>
              {c.label} <span className="text-fg-muted">#{c.id}{c.detalle ? ` · ${c.detalle}` : ""}{estadoCorto(c.estado)}</span>
            </button>
          ))}
          {puedeCrear && !objetivo.crear && objetivo.nombre && (
            <button type="button" onClick={() => onCambio({ ...limpio, crear: true })} className={boton}>
              Crear «{objetivo.nombre}» como borrador
            </button>
          )}
          {objetivo.admiteSinFicha && !objetivo.sinFicha && (
            <button type="button" onClick={() => onCambio({ ...limpio, sinFicha: true })} className={boton}>
              Sin ficha
            </button>
          )}
        </div>
      )}
      {buscando && (
        <SelectorFicha
          entidad={entidad}
          yaVinculados={objetivo.id != null ? [objetivo.id] : []}
          autoFocus
          onCerrar={() => setBuscando(false)}
          onElegir={(fichas) => {
            const f = fichas[0];
            if (f) onCambio({ ...limpio, id: f.id, entidadElegida: f.entidad, label: f.label, estado: f.estado });
            setBuscando(false);
          }}
        />
      )}
    </div>
  );
}

function CampoSimple({ dato, catalogos, onCambio }: { dato: DatoAnalizado; catalogos: Analisis["catalogos"]; onCambio: (p: Partial<DatoAnalizado>) => void }) {
  const valor = dato.valor;
  const poner = (v: string) => onCambio({ valor: v });
  if (dato.vaciar) return <p className="text-sm text-fg-secondary">Se vacía el campo.</p>;
  switch (dato.editor) {
    case "opcion":
      return (
        <Select
          value={valor}
          onChange={poner}
          options={dato.opciones ?? (dato.catalogo ? (catalogos[dato.catalogo] ?? []) : [])}
          // Lo nuevo se añade al catálogo al aplicar, no al escribirlo.
          onCrear={dato.catalogo && dato.catalogo !== "elementos" ? () => undefined : undefined}
        />
      );
    case "si-no":
      return <Select value={valor} onChange={poner} options={["sí", "no"]} />;
    case "numero":
      return <input value={valor} onChange={(e) => poner(e.target.value)} inputMode="decimal" className={cn(subInp, "w-32 font-mono")} />;
    default:
      return (
        <>
          <input value={valor} onChange={(e) => poner(e.target.value)} className={cn(subInp, "w-full")} />
          {dato.editor === "lista" && <p className="mt-1 text-xs text-fg-muted">Separados por comas.</p>}
        </>
      );
  }
}

function CampoFecha({ dato, cal, onCambio }: { dato: DatoAnalizado; cal: Calendario; onCambio: (p: Partial<DatoAnalizado>) => void }) {
  if (dato.vaciar) return <p className="text-sm text-fg-secondary">Se borra la fecha.</p>;
  const fecha = leerFecha(cal, dato.valor);
  const textos = fecha ? textosFecha(cal, fecha) : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={dato.valor} onChange={(e) => onCambio({ valor: e.target.value })} className={cn(subInp, "min-w-48 flex-1")} placeholder="12 de la Cuarta Luna, año 1013 de la Era Post-Ishkoria" />
        <label className="flex items-center gap-1 text-xs text-fg-secondary" title="Sale en la cronología destacada">
          <input type="checkbox" checked={Boolean(dato.importante)} onChange={(e) => onCambio({ importante: e.target.checked })} /> ★ importante
        </label>
      </div>
      {textos && (
        <p className="mt-1 text-xs text-fg-muted">
          {textos.eras} · {textos.relativo}
        </p>
      )}
    </div>
  );
}

/** Conexión, habilidad, miembro de un árbol…: una ficha o un nombre, con sus datos propios. */
function CampoFila({ dato, catalogos, onCambio }: { dato: DatoAnalizado; catalogos: Analisis["catalogos"]; onCambio: (p: Partial<DatoAnalizado>) => void }) {
  const quitar = dato.clase === "quitar" || dato.clase === "quitar-lista";
  const subs = (dato.subcampos ?? []).filter((s) => dato.clase !== "estadisticas" || s.valor || s.actual);
  const ponerSub = (name: string, valor: string) => onCambio({ subcampos: dato.subcampos?.map((s) => (s.name === name ? { ...s, valor } : s)) });
  const conNombre = dato.lista && dato.nombre !== undefined && (!dato.objetivo || dato.lista === "fragmentos");
  return (
    <div className="space-y-2">
      {conNombre && !quitar && <input value={dato.nombre} onChange={(e) => onCambio({ nombre: e.target.value })} placeholder="Título (opcional)" className={cn(subInp, "w-full")} />}
      {quitar && <p className="text-sm text-fg-secondary">Se quita: <span className="text-fg">{dato.objetivo?.label ?? dato.nombre ?? dato.objetivo?.nombre}</span></p>}
      {dato.objetivo && !quitar && <ElegirFicha objetivo={dato.objetivo} rotulo={dato.lista === "fragmentos" ? "POV" : undefined} onCambio={(objetivo) => onCambio({ objetivo })} />}
      {subs.length > 0 && !quitar && (
        <div className="grid gap-2 sm:grid-cols-2">
          {subs.map((s) => (
            <div key={s.name}>
              <p className="mb-0.5 text-[11px] text-fg-muted">
                {s.label}
                {s.actual && s.actual !== s.valor ? <span> · ahora: {s.actual}</span> : null}
              </p>
              {s.tipo === "opcion" ? (
                <Select value={s.valor} onChange={(v) => ponerSub(s.name, v)} placeholder={s.actual ? "Se conserva" : undefined} options={s.opciones ?? (s.catalogo ? (catalogos[s.catalogo] ?? []) : [])} onCrear={s.catalogo && s.catalogo !== "elementos" ? () => undefined : undefined} />
              ) : (
                <input value={s.valor} onChange={(e) => ponerSub(s.name, e.target.value)} placeholder={s.actual ? "Se conserva" : undefined} inputMode={s.tipo === "numero" ? "decimal" : undefined} className={cn(subInp, "w-full")} />
              )}
            </div>
          ))}
        </div>
      )}
      {dato.lista && !quitar && (dato.lista === "habilidades" || dato.lista === "secciones") && (
        <div>
          <p className="mb-0.5 text-[11px] text-fg-muted">{dato.lista === "habilidades" ? "Descripción" : "Contenido"}</p>
          <MarkdownField value={dato.valor} onChange={(valor) => onCambio({ valor })} rows={Math.min(10, Math.max(3, dato.valor.split("\n").length + 1))} />
        </div>
      )}
      {dato.filaId != null && dato.clase === "conexion" && !dato.igual && (
        <div role="group" aria-label="Si ya existe" className="flex flex-wrap items-center gap-3 text-xs text-fg-secondary">
          <span className="text-fg-muted">Ya está conectada:</span>
          {(["actualizar", "anadir"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" checked={dato.modoFila === m} onChange={() => onCambio({ modoFila: m })} />
              {m === "actualizar" ? "actualizar esa fila" : "añadir otra fila"}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function DatoFila({
  dato,
  cal,
  catalogos,
  fallo,
  rutaFicha,
  onCambio,
}: {
  dato: DatoAnalizado;
  cal: Calendario;
  catalogos: Analisis["catalogos"];
  /** Por qué no se pudo aplicar la última vez. */
  fallo?: string;
  rutaFicha?: string | null;
  onCambio: (p: Partial<DatoAnalizado>) => void;
}) {
  const falta = faltaEn(dato, cal);
  const inactivo = dato.decision === "descartar" || dato.decision === "luego";
  const nombreFila = dato.lista && dato.lista !== "fragmentos" ? dato.nombre : dato.clase === "conexion" || dato.clase === "quitar" ? dato.objetivo?.nombre : null;

  return (
    <div className={cn("rounded-xl border p-3", falta || fallo ? "border-warning/50 bg-warning/5" : "border-border-base bg-surface/40", inactivo && "opacity-70")}>
      <div className="flex flex-wrap items-start gap-2">
        {/* Con ancho mínimo, en un móvil los botones bajan de línea en vez de pisar el rótulo. */}
        <div className="min-w-32 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
            {dato.rotulo}
            {nombreFila ? <span className="normal-case tracking-normal text-fg-secondary"> · {nombreFila}</span> : null}
            {dato.anadir && dato.clase === "campo" ? <span className="normal-case tracking-normal"> · añadir</span> : null}
          </p>
          {dato.actual && dato.editor !== "largo" && !dato.igual && <p className="mt-0.5 whitespace-pre-wrap text-xs text-fg-muted">Ahora: {dato.actual}</p>}
          {dato.igual && <p className="mt-0.5 text-xs text-success">Ya está así en la ficha.</p>}
        </div>
        <Decisiones dato={dato} onCambio={(decision) => onCambio({ decision })} />
      </div>

      {!inactivo && (
        <div className="mt-2">
          {dato.clase === "desconocido" ? (
            <textarea value={dato.valor} onChange={(e) => onCambio({ valor: e.target.value })} rows={Math.min(8, dato.valor.split("\n").length + 1)} className={cn(subInp, "w-full font-mono text-xs")} />
          ) : dato.clase === "nota" || dato.editor === "largo" ? (
            <TextoLargo dato={dato} onValor={(valor) => onCambio({ valor })} />
          ) : dato.editor === "fecha" ? (
            <CampoFecha dato={dato} cal={cal} onCambio={onCambio} />
          ) : dato.editor === "ficha" ? (
            dato.objetivo ? <ElegirFicha objetivo={dato.objetivo} onCambio={(objetivo) => onCambio({ objetivo })} /> : <p className="text-sm text-fg-secondary">Se vacía el campo.</p>
          ) : dato.editor === "fila" ? (
            <CampoFila dato={dato} catalogos={catalogos} onCambio={onCambio} />
          ) : (
            <CampoSimple dato={dato} catalogos={catalogos} onCambio={onCambio} />
          )}
        </div>
      )}

      {inactivo && dato.decision === "luego" && <p className="mt-1 text-xs text-fg-muted">Se queda en el archivo, tal como está.</p>}
      {dato.aviso && !inactivo && <p className="mt-2 text-xs text-warning">{dato.aviso}</p>}
      {falta && <p className="mt-2 text-xs text-warning">{falta}</p>}
      {fallo && (
        <p className="mt-2 text-xs text-error">
          No se pudo aplicar: {fallo} Sigue en el archivo.
          {rutaFicha ? <Link href={rutaFicha} className="ml-1 underline">Abrir la ficha</Link> : null}
        </p>
      )}
    </div>
  );
}
