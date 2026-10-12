"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/viz/timelineShared";
import { ConmutadorFechas } from "@/components/fechas/Lectura";
import { claveRef, refsDe, type Suceso } from "@/lib/cronologia";
import { TIPOS_SUCESO, type TipoSuceso } from "@/lib/fechas";

/**
 * Filtros de la cronología (spec §14): por tipo de suceso, por era y por
 * entidad, y por defecto solo los importantes. Los comparten la línea temporal
 * y el calendario.
 */
export interface EstadoFiltros {
  tipos: Set<TipoSuceso>;
  era: number | null;
  /** "personajes:5" */
  entidad: string | null;
  soloImportantes: boolean;
}

/** `soloImportantes`: el público empieza viendo solo lo destacado (§14); el taller, todo. */
export function useFiltros(sucesos: Suceso[], { soloImportantes = true }: { soloImportantes?: boolean } = {}) {
  const [f, setF] = useState<EstadoFiltros>(() => ({
    tipos: new Set(TIPOS_SUCESO.map((t) => t.id)),
    era: null,
    entidad: null,
    soloImportantes,
  }));

  const sinImportancia = useMemo(
    () =>
      sucesos.filter(
        (s) =>
          f.tipos.has(s.tipo) &&
          (f.era == null || s.era?.id === f.era) &&
          (f.entidad == null || refsDe(s).some((r) => claveRef(r) === f.entidad)),
      ),
    [sucesos, f.tipos, f.era, f.entidad],
  );
  const filtrados = useMemo(() => (f.soloImportantes ? sinImportancia.filter((s) => s.importante) : sinImportancia), [sinImportancia, f.soloImportantes]);

  /** Cambia cuando cambia el resultado: sirve de `key` para remontar vistas con estado propio. */
  const firma = `${[...f.tipos].sort().join(",")}|${f.era}|${f.entidad}|${f.soloImportantes}`;
  return { f, setF, filtrados, ocultos: sinImportancia.length - filtrados.length, firma };
}

export function BarraFiltros({
  sucesos,
  f,
  setF,
  mostrados,
  ocultos,
}: {
  sucesos: Suceso[];
  f: EstadoFiltros;
  setF: (fn: (prev: EstadoFiltros) => EstadoFiltros) => void;
  mostrados: number;
  ocultos: number;
}) {
  const eras = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of sucesos) if (s.era) m.set(s.era.id, s.era.nombre);
    return [...m].map(([id, nombre]) => ({ id, nombre }));
  }, [sucesos]);

  // Las fichas que aparecen en algún suceso, con su tipo para distinguir homónimos.
  const entidades = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sucesos) for (const r of refsDe(s)) m.set(claveRef(r), `${r.nombre} (${ETIQUETA_TIPO[r.tipo] ?? r.tipo})`);
    return [...m].map(([clave, texto]) => ({ clave, texto })).sort((a, b) => a.texto.localeCompare(b.texto));
  }, [sucesos]);
  const [busqueda, setBusqueda] = useState(() => entidades.find((e) => e.clave === f.entidad)?.texto ?? "");

  const toggleTipo = (t: TipoSuceso) =>
    setF((p) => {
      const tipos = new Set(p.tipos);
      if (tipos.has(t)) tipos.delete(t);
      else tipos.add(t);
      return { ...p, tipos };
    });

  const inputCls = "rounded-full border border-border-base bg-surface/60 px-3 py-1 text-xs text-fg outline-none focus:border-border-glow";

  return (
    <div className="sticky top-14 z-30 mb-6 space-y-2 rounded-2xl border border-border-base bg-deep/70 p-2 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        {TIPOS_SUCESO.map((t) => (
          <Chip key={t.id} active={f.tipos.has(t.id)} color={t.color} icon={t.icono} onClick={() => toggleTipo(t.id)}>
            {t.etiqueta}
          </Chip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border-base sm:block" />
        <Chip active={f.soloImportantes} color="#e0b34a" icon="Star" onClick={() => setF((p) => ({ ...p, soloImportantes: !p.soloImportantes }))}>
          Solo importantes
        </Chip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {eras.length > 1 && (
          <select
            value={f.era ?? ""}
            onChange={(e) => setF((p) => ({ ...p, era: e.target.value ? Number(e.target.value) : null }))}
            aria-label="Era"
            className={inputCls}
          >
            <option value="">Todas las eras</option>
            {eras.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        )}
        <input
          list="cronologia-entidades"
          value={busqueda}
          onChange={(e) => {
            const v = e.target.value;
            setBusqueda(v);
            const hit = entidades.find((x) => x.texto === v);
            if (hit) setF((p) => ({ ...p, entidad: hit.clave }));
            else if (!v) setF((p) => ({ ...p, entidad: null }));
          }}
          placeholder="Filtrar por personaje, lugar, capítulo…"
          aria-label="Filtrar por entidad"
          className={`${inputCls} min-w-0 flex-1 sm:max-w-xs`}
        />
        <datalist id="cronologia-entidades">
          {entidades.map((e) => (
            <option key={e.clave} value={e.texto} />
          ))}
        </datalist>
        {f.entidad && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setF((p) => ({ ...p, entidad: null }));
            }}
            className="text-xs text-fg-muted hover:text-fg"
          >
            Quitar filtro
          </button>
        )}
        <ConmutadorFechas className="ml-auto" />
      </div>
      <p className="px-1 text-[11px] text-fg-muted">
        {mostrados} {mostrados === 1 ? "suceso" : "sucesos"}
        {ocultos > 0 && (
          <>
            {" "}
            · {ocultos} más sin destacar —{" "}
            <button type="button" onClick={() => setF((p) => ({ ...p, soloImportantes: false }))} className="text-accent hover:underline">
              verlos todos
            </button>
          </>
        )}
      </p>
    </div>
  );
}

const ETIQUETA_TIPO: Record<string, string> = {
  personajes: "Personaje",
  naciones: "Nación",
  organizaciones: "Organización",
  familias: "Familia",
  gremio: "Gremio",
  regiones: "Región",
  locaciones: "Locación",
  artefactos: "Artefacto",
  razas: "Raza",
  bestias: "Bestia",
  demonios: "Lord demonio",
  misiones: "Misión",
  lore: "Lore",
  capitulos: "Capítulo",
  actos: "Acto",
  timeline: "Evento",
};
