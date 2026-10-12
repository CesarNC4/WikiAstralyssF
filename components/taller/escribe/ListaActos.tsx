"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { crearActo } from "@/lib/actions/taller";
import type { TallerIndice } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { botonCls, InsigniaFase, PuntoEstado } from "../ui";

const selCls =
  "w-full rounded-md border border-border-base bg-surface px-2 py-1 text-xs text-fg-secondary outline-none focus:border-border-glow";

/**
 * Lista de actos de "Escribe" (spec §5): todos los actos, agrupados por
 * capítulo, con los filtros de libro, capítulo, POV, personaje, fase, estado
 * narrativo, estado de publicación y un buscador.
 */
export function ListaActos({
  indice,
  seleccionado,
  estadosNarrativos,
}: {
  indice: TallerIndice;
  seleccionado: number | null;
  estadosNarrativos: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [libro, setLibro] = useState("");
  const [capitulo, setCapitulo] = useState("");
  const [pov, setPov] = useState("");
  const [personaje, setPersonaje] = useState("");
  const [fase, setFase] = useState("");
  const [estado, setEstado] = useState("");
  const [publicacion, setPublicacion] = useState("");
  const [q, setQ] = useState("");
  const [creando, setCreando] = useState(false);

  const fases = useMemo(() => new Map(indice.plantillas.flatMap((p) => p.fases).map((f) => [f.id, f])), [indice.plantillas]);
  const capPorId = useMemo(() => new Map(indice.capitulos.map((c) => [c.id, c])), [indice.capitulos]);

  const capitulosOrdenados = useMemo(
    () =>
      indice.libros.flatMap((l) =>
        indice.capitulos.filter((c) => (c.libro ?? "") === l).sort((a, b) => a.orden - b.orden || a.id - b.id),
      ),
    [indice],
  );

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return indice.actos.filter((a) => {
      const cap = a.capituloId != null ? capPorId.get(a.capituloId) : undefined;
      if (libro && (cap?.libro ?? "") !== libro) return false;
      if (capitulo && String(a.capituloId) !== capitulo) return false;
      if (pov && !a.pov.some((p) => String(p.id) === pov)) return false;
      if (personaje && !a.personajes.includes(Number(personaje))) return false;
      if (fase && fases.get(a.faseId ?? -1)?.nombre !== fase) return false;
      if (estado && (a.estado ?? "") !== estado) return false;
      if (publicacion && a.estadoPublicacion !== publicacion) return false;
      if (t && !a.nombre.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [indice.actos, capPorId, fases, libro, capitulo, pov, personaje, fase, estado, publicacion, q]);

  const nombresFase = useMemo(() => [...new Set([...fases.values()].map((f) => f.nombre))], [fases]);
  const povs = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of indice.actos) for (const p of a.pov) m.set(p.id, p.nombre);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [indice.actos]);

  const hayFiltros = libro || capitulo || pov || personaje || fase || estado || publicacion || q;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-base px-4 py-3">
        <h1 className="font-display text-lg text-fg">Actos</h1>
        <span className="text-xs text-fg-muted">{filtrados.length}</span>
        <button type="button" onClick={() => setCreando((v) => !v)} className={cn(botonCls, "ml-auto")}>
          <Icon name="Plus" size={14} /> Nuevo
        </button>
      </div>

      {creando && (
        <NuevoActo
          indice={indice}
          capitulos={capitulosOrdenados}
          pending={pending}
          onCrear={(capituloId, nombre, faseId) =>
            start(async () => {
              const r = await crearActo({ capituloId, nombre, faseId });
              if (!r.ok) return toast(r.error, "error");
              setCreando(false);
              toast("Acto creado.", "success");
              router.push(`/admin/taller/escribe?acto=${r.data.id}`);
            })
          }
        />
      )}

      <div className="grid grid-cols-2 gap-1.5 border-b border-border-base px-4 py-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className={cn(selCls, "col-span-2")} />
        <select value={libro} onChange={(e) => setLibro(e.target.value)} className={selCls}>
          <option value="">Todos los libros</option>
          {indice.libros.map((l) => (
            <option key={l} value={l}>
              {l || "Sin libro"}
            </option>
          ))}
        </select>
        <select value={capitulo} onChange={(e) => setCapitulo(e.target.value)} className={selCls}>
          <option value="">Todos los capítulos</option>
          {capitulosOrdenados
            .filter((c) => !libro || (c.libro ?? "") === libro)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} — {c.titulo}
              </option>
            ))}
        </select>
        <select value={pov} onChange={(e) => setPov(e.target.value)} className={selCls}>
          <option value="">Todos los POV</option>
          {povs.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <select value={personaje} onChange={(e) => setPersonaje(e.target.value)} className={selCls}>
          <option value="">Cualquier personaje</option>
          {indice.personajes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <select value={fase} onChange={(e) => setFase(e.target.value)} className={selCls}>
          <option value="">Todas las fases</option>
          {nombresFase.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className={selCls}>
          <option value="">Cualquier estado</option>
          {estadosNarrativos.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select value={publicacion} onChange={(e) => setPublicacion(e.target.value)} className={cn(selCls, "col-span-2")}>
          <option value="">Publicados, borradores y ocultos</option>
          <option value="publicado">Publicados</option>
          <option value="borrador">Borradores</option>
          <option value="oculto">Ocultos</option>
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setLibro(""); setCapitulo(""); setPov(""); setPersonaje(""); setFase(""); setEstado(""); setPublicacion(""); setQ("");
            }}
            className="col-span-2 text-left text-xs text-accent hover:underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {capitulosOrdenados.map((c) => {
          const suyos = filtrados.filter((a) => a.capituloId === c.id);
          if (suyos.length === 0) return null;
          return (
            <div key={c.id} className="mb-2">
              <p className="truncate px-2 pb-1 pt-2 text-[11px] uppercase tracking-wide text-fg-muted">
                {c.numero} — {c.titulo}
              </p>
              {suyos.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/taller/escribe?acto=${a.id}`}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors",
                    a.id === seleccionado ? "border-accent bg-surface" : "border-transparent hover:bg-surface/60",
                  )}
                >
                  <span className="mt-1.5">
                    <PuntoEstado estado={a.estadoPublicacion} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      <span className="text-fg-muted">{a.etiqueta} · </span>
                      {a.nombre}
                    </span>
                    {a.pov.length > 0 && (
                      <span className="block truncate text-[11px] text-accent">
                        POV: {a.pov.map((p) => p.nombre).join(", ")}
                      </span>
                    )}
                  </span>
                  <InsigniaFase fase={fases.get(a.faseId ?? -1)} />
                </Link>
              ))}
            </div>
          );
        })}
        {(() => {
          // Actos cuyo capítulo no existe o está en la papelera: se listan para no perderlos de vista.
          const sueltos = filtrados.filter((a) => a.capituloId == null || !capPorId.has(a.capituloId));
          if (sueltos.length === 0) return null;
          return (
            <div className="mb-2">
              <p className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-wide text-warning">Sin capítulo o con el capítulo en la papelera</p>
              {sueltos.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/taller/escribe?acto=${a.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2",
                    a.id === seleccionado ? "border-accent bg-surface" : "border-transparent hover:bg-surface/60",
                  )}
                >
                  <PuntoEstado estado={a.estadoPublicacion} />
                  <span className="truncate text-sm text-fg">{a.nombre}</span>
                </Link>
              ))}
            </div>
          );
        })()}
        {filtrados.length === 0 && (
          <p className="px-3 py-6 text-center text-sm italic text-fg-muted">
            {indice.actos.length === 0 ? "Aún no hay actos." : "Ningún acto cumple los filtros."}
          </p>
        )}
      </div>
    </div>
  );
}

/** Alta de un acto: capítulo, nombre y fase (obligatoria si el capítulo tiene plantilla). */
function NuevoActo({
  indice,
  capitulos,
  pending,
  onCrear,
}: {
  indice: TallerIndice;
  capitulos: TallerIndice["capitulos"];
  pending: boolean;
  onCrear: (capituloId: number, nombre: string, faseId: number | null) => void;
}) {
  const [capituloId, setCapituloId] = useState<number | null>(capitulos[0]?.id ?? null);
  const [nombre, setNombre] = useState("");
  const [faseId, setFaseId] = useState<number | null>(null);
  const cap = capitulos.find((c) => c.id === capituloId);
  const plantilla = indice.plantillas.find((p) => p.id === cap?.plantillaId);

  if (capitulos.length === 0)
    return (
      <p className="border-b border-border-base px-4 py-3 text-xs text-fg-muted">
        Crea antes un capítulo en{" "}
        <Link href="/admin/taller/capitulos" className="text-accent hover:underline">
          Capítulos
        </Link>
        .
      </p>
    );

  return (
    <form
      className="space-y-2 border-b border-border-base bg-deep/60 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (capituloId != null && nombre.trim()) onCrear(capituloId, nombre.trim(), plantilla ? faseId : null);
      }}
    >
      <select
        value={capituloId ?? ""}
        onChange={(e) => {
          setCapituloId(Number(e.target.value));
          setFaseId(null);
        }}
        className={selCls}
      >
        {capitulos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.numero} — {c.titulo}
          </option>
        ))}
      </select>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del acto" autoFocus className={selCls} />
      {plantilla ? (
        <select value={faseId ?? ""} onChange={(e) => setFaseId(e.target.value ? Number(e.target.value) : null)} className={selCls} required>
          <option value="">Fase…</option>
          {plantilla.fases.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-[11px] text-warning">Este capítulo aún no tiene plantilla: el acto se crea sin fase.</p>
      )}
      <button type="submit" disabled={pending || !nombre.trim() || (!!plantilla && faseId == null)} className={botonCls}>
        Crear acto
      </button>
    </form>
  );
}
