"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon, NOMBRES_ICONO } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { asignarCategoria, borrarCategoria, crearCategoria, guardarCategoria } from "@/lib/actions/categoriasRelacion";
import {
  ESTILOS_LINEA,
  PATRON_LINEA,
  type CategoriaRelacion,
  type EstiloLinea,
  type TipoRelacionAsignado,
} from "@/lib/relaciones/categorias";

const inp = "rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow";

/**
 * Categorías de las relaciones entre personajes (spec §11): su aspecto en el
 * mapa y qué tipos de relación entran en cada una.
 */
export function CategoriasRelacion({ categorias, tipos }: { categorias: CategoriaRelacion[]; tipos: TipoRelacionAsignado[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [nueva, setNueva] = useState("");

  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? "No se pudo guardar.", "error");
      if (ok) toast(ok, "success");
      router.refresh();
    });

  const sinCategoria = tipos.filter((t) => t.categoriaId == null).length;

  return (
    <AccordionSection
      title="Categorías de relación"
      subtitle={`${categorias.length} categorías · ${sinCategoria} de ${tipos.length} tipos sin asignar`}
      defaultOpen={categorias.length === 0}
    >
      <div className="space-y-5">
        <p className="text-xs text-fg-muted">
          Agrupan los tipos de relación entre personajes para pintarlos en el mapa de relaciones del taller: cada categoría
          tiene su color, su icono y su estilo de línea. Las demás conexiones (personaje–nación, bestia–región…) no cambian.
        </p>

        <div className="space-y-2">
          {categorias.map((c) => (
            <FilaCategoria key={`${c.id}:${c.nombre}:${c.color}:${c.icono}:${c.estilo}`} c={c} pending={pending} correr={correr} />
          ))}
          {categorias.length === 0 && <p className="text-sm italic text-fg-muted">Todavía no hay categorías.</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nueva.trim()) return;
              correr(() => crearCategoria(nueva), `Categoría «${nueva.trim()}» creada.`);
              setNueva("");
            }}
          >
            <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva categoría (Familia, Conflicto…)" className={`${inp} flex-1`} />
            <button type="submit" disabled={pending || !nueva.trim()} className="rounded-lg border border-border-glow px-3 py-1.5 text-sm text-accent disabled:opacity-40">
              Añadir
            </button>
          </form>
        </div>

        <div>
          <h4 className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Tipos de relación</h4>
          {categorias.length === 0 ? (
            <p className="text-xs text-fg-muted">Crea una categoría para poder asignar los tipos.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {tipos.map((t) => {
                const cat = categorias.find((c) => c.id === t.categoriaId);
                return (
                  <label key={t.id} className="flex items-center gap-2 rounded-lg border border-border-base bg-surface/30 px-2 py-1">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat?.color ?? "transparent", border: cat ? undefined : "1px dashed var(--fg-muted)" }} />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{t.valor}</span>
                    <select
                      value={t.categoriaId ?? ""}
                      disabled={pending}
                      onChange={(e) => correr(() => asignarCategoria(t.id, e.target.value ? Number(e.target.value) : null))}
                      className={`${inp} w-36 py-1 text-xs`}
                      aria-label={`Categoría de ${t.valor}`}
                    >
                      <option value="">Sin categoría</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AccordionSection>
  );
}

function FilaCategoria({
  c,
  pending,
  correr,
}: {
  c: CategoriaRelacion;
  pending: boolean;
  correr: (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => void;
}) {
  const [nombre, setNombre] = useState(c.nombre);
  const [color, setColor] = useState(c.color);
  const [icono, setIcono] = useState(c.icono);
  const [estilo, setEstilo] = useState<EstiloLinea>(c.estilo);
  const cambiado = nombre !== c.nombre || color !== c.color || icono !== c.icono || estilo !== c.estilo;
  const patron = PATRON_LINEA[estilo];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-base bg-surface/30 p-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${color}22`, color }}>
        <Icon name={icono} size={16} />
      </span>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" className={`${inp} min-w-32 flex-1`} />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color" className="h-8 w-10 cursor-pointer rounded border border-border-base bg-surface" />
      <select value={icono} onChange={(e) => setIcono(e.target.value)} aria-label="Icono" className={`${inp} w-36`}>
        {NOMBRES_ICONO.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select value={estilo} onChange={(e) => setEstilo(e.target.value as EstiloLinea)} aria-label="Estilo de línea" className={`${inp} w-32`}>
        {ESTILOS_LINEA.map((e) => (
          <option key={e.id} value={e.id}>
            {e.etiqueta}
          </option>
        ))}
      </select>
      <svg width="48" height="10" aria-hidden className="shrink-0">
        <line x1="2" y1="5" x2="46" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={patron ? patron.map((x) => x * 1.5).join(" ") : undefined} strokeLinecap="round" />
      </svg>
      <button
        type="button"
        disabled={pending || !cambiado}
        onClick={() => correr(() => guardarCategoria(c.id, { nombre, color, icono, estilo }), "Categoría guardada.")}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-void disabled:opacity-40"
      >
        Guardar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`¿Borrar la categoría «${c.nombre}»? Sus tipos se quedan sin categoría.`)) correr(() => borrarCategoria(c.id), "Categoría borrada.");
        }}
        className="rounded px-1.5 text-fg-muted hover:text-error"
        title="Borrar"
      >
        ✕
      </button>
    </div>
  );
}
