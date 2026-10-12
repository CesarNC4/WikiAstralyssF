"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { borrarPlantilla, guardarPlantilla, marcarPlantillaPredeterminada } from "@/lib/actions/taller";
import type { PlantillaTaller } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { botonCls, botonPrimarioCls, inputCls } from "../ui";

/**
 * Plantillas de estructura (spec §7): solo propias, una predeterminada. Cada
 * fase tiene nombre, abreviatura, color y guía. Una fase en uso no se puede
 * quitar (el servidor lo rechaza y dice cuántos actos la usan).
 */

interface FaseFila {
  clave: string;
  id: number | null;
  nombre: string;
  abreviatura: string;
  color: string;
  guia: string;
}

let n = 0;
const clave = () => `f${n++}`;

function filasDe(p: PlantillaTaller | null): FaseFila[] {
  if (!p) return [{ clave: clave(), id: null, nombre: "", abreviatura: "", color: "#7b5cff", guia: "" }];
  return p.fases.map((f) => ({
    clave: clave(),
    id: f.id,
    nombre: f.nombre,
    abreviatura: f.abreviatura ?? "",
    color: f.color ?? "#9aa3b2",
    guia: f.guia ?? "",
  }));
}

export function PlantillasEditor({ plantillas }: { plantillas: PlantillaTaller[] }) {
  const [nueva, setNueva] = useState(false);
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-5">
      <div className="flex items-center gap-3">
        <p className="text-sm text-fg-muted">
          Cada capítulo usa una plantilla y cada uno de sus actos se coloca en una de sus fases. La predeterminada viene
          elegida al crear un capítulo.
        </p>
        <button type="button" onClick={() => setNueva(true)} disabled={nueva} className={cn(botonCls, "ml-auto shrink-0")}>
          <Icon name="Plus" size={14} /> Plantilla
        </button>
      </div>
      {nueva && <PlantillaCard plantilla={null} onCerrar={() => setNueva(false)} />}
      {plantillas.map((p) => (
        <PlantillaCard key={p.id} plantilla={p} />
      ))}
      {plantillas.length === 0 && !nueva && (
        <p className="py-10 text-center text-sm italic text-fg-muted">Aún no hay plantillas. Crea la primera para poder crear capítulos.</p>
      )}
    </div>
  );
}

function PlantillaCard({ plantilla, onCerrar }: { plantilla: PlantillaTaller | null; onCerrar?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion ?? "");
  const [fases, setFases] = useState<FaseFila[]>(() => filasDe(plantilla));
  const [cambios, setCambios] = useState(!plantilla);

  const cambiar = (k: string, campo: keyof FaseFila, v: string) => {
    setFases((prev) => prev.map((f) => (f.clave === k ? { ...f, [campo]: v } : f)));
    setCambios(true);
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= fases.length) return;
    const copia = [...fases];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setFases(copia);
    setCambios(true);
  };

  const guardar = () =>
    start(async () => {
      const r = await guardarPlantilla({
        id: plantilla?.id ?? null,
        nombre,
        descripcion,
        fases: fases.map((f) => ({ id: f.id, nombre: f.nombre, abreviatura: f.abreviatura, color: f.color, guia: f.guia })),
      });
      if (!r.ok) return toast(r.error, "error");
      setCambios(false);
      toast("Plantilla guardada.", "success");
      onCerrar?.();
      router.refresh();
    });

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "No se pudo.", "error");
      toast(ok, "success");
      router.refresh();
    });

  return (
    <section className="rounded-2xl border border-border-base bg-surface/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setCambios(true);
          }}
          placeholder="Nombre de la plantilla"
          className={cn(inputCls, "font-display text-lg")}
        />
        {plantilla?.predeterminada ? (
          <span className="shrink-0 rounded-full border border-accent/50 px-2 py-0.5 text-xs text-accent">Predeterminada</span>
        ) : plantilla ? (
          <button type="button" disabled={pending} onClick={() => accion(() => marcarPlantillaPredeterminada(plantilla.id), "Ahora es la predeterminada.")} className={cn(botonCls, "shrink-0")}>
            Hacer predeterminada
          </button>
        ) : null}
      </div>
      <textarea
        value={descripcion}
        onChange={(e) => {
          setDescripcion(e.target.value);
          setCambios(true);
        }}
        placeholder="Para qué sirve esta plantilla (opcional)"
        rows={2}
        className={cn(inputCls, "mb-3")}
      />

      <div className="space-y-2">
        {fases.map((f, i) => (
          <div key={f.clave} className="grid grid-cols-[auto_1fr_7rem_3rem_auto] items-start gap-2 rounded-xl border border-border-base bg-deep/40 p-2">
            <div className="flex flex-col pt-1 text-fg-muted">
              <button type="button" onClick={() => mover(i, -1)} className="hover:text-fg" aria-label="Subir">
                <Icon name="ChevronUp" size={14} />
              </button>
              <button type="button" onClick={() => mover(i, 1)} className="hover:text-fg" aria-label="Bajar">
                <Icon name="ChevronDown" size={14} />
              </button>
            </div>
            <div className="space-y-1">
              <input value={f.nombre} onChange={(e) => cambiar(f.clave, "nombre", e.target.value)} placeholder="Nombre de la fase" className={inputCls} />
              <input value={f.guia} onChange={(e) => cambiar(f.clave, "guia", e.target.value)} placeholder="Guía: qué debería ocurrir aquí" className={cn(inputCls, "text-xs")} />
            </div>
            <input value={f.abreviatura} onChange={(e) => cambiar(f.clave, "abreviatura", e.target.value)} placeholder="Abrev." className={inputCls} />
            <input
              type="color"
              value={f.color}
              onChange={(e) => cambiar(f.clave, "color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-border-base bg-surface"
              aria-label="Color"
            />
            <button
              type="button"
              disabled={fases.length === 1}
              onClick={() => {
                setFases((prev) => prev.filter((x) => x.clave !== f.clave));
                setCambios(true);
              }}
              className="p-2 text-fg-muted hover:text-error disabled:opacity-30"
              aria-label="Quitar fase"
            >
              <Icon name="X" size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFases((prev) => [...prev, { clave: clave(), id: null, nombre: "", abreviatura: "", color: "#9aa3b2", guia: "" }]);
            setCambios(true);
          }}
          className={botonCls}
        >
          <Icon name="Plus" size={14} /> Fase
        </button>
        {plantilla ? (
          <button
            type="button"
            disabled={pending || plantilla.usos > 0}
            title={plantilla.usos > 0 ? `La usan ${plantilla.usos} capítulos` : "Borrar plantilla"}
            onClick={() => {
              if (confirm(`¿Borrar la plantilla «${plantilla.nombre}»?`)) accion(() => borrarPlantilla(plantilla.id), "Plantilla borrada.");
            }}
            className={cn(botonCls, "hover:text-error")}
          >
            <Icon name="Trash2" size={14} /> Borrar
          </button>
        ) : (
          <button type="button" onClick={onCerrar} className={botonCls}>
            Cancelar
          </button>
        )}
        {plantilla && <span className="text-xs text-fg-muted">Usada por {plantilla.usos} capítulos</span>}
        <button type="button" onClick={guardar} disabled={pending || !cambios} className={cn(botonPrimarioCls, "ml-auto")}>
          {pending ? "Guardando…" : plantilla ? "Guardar" : "Crear plantilla"}
        </button>
      </div>
    </section>
  );
}
