"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { usePlayerStore, type Track } from "@/hooks/usePlayerStore";
import type { EntityMeta } from "@/lib/entities";
import { formatoDuracion, fuenteDe, NOMBRE_FUENTE } from "@/lib/media/fuentes";
import type { CancionMusica, IndiceMusica as Datos } from "@/lib/queries/canciones";
import { cn } from "@/lib/utils";

type Vista = "uso" | "historia";

interface Grupo {
  clave: string;
  titulo: string;
  /** Rótulo encima del grupo (el libro, en la vista por historia). */
  seccion?: string;
  canciones: CancionMusica[];
}

const selCls =
  "rounded-xl border border-border-base bg-surface/60 px-3 py-2 text-sm text-fg outline-none focus:border-border-glow";

/**
 * Índice de la sección Música (docs/fragmentos-y-musica.md §3.7): la banda
 * sonora como un álbum. Se agrupa por uso (catálogo `cancion_uso`) o por
 * historia (libro › capítulo donde suena: directo, por sus actos o por sus
 * fragmentos; una canción puede repetirse). "Reproducir" carga la cola entera
 * del grupo, o de todo lo filtrado.
 */
export function IndiceMusica({ meta, datos }: { meta: EntityMeta; datos: Datos }) {
  const loadQueue = usePlayerStore((s) => s.loadQueue);
  const [vista, setVista] = useState<Vista>("uso");
  const [q, setQ] = useState("");
  const [libro, setLibro] = useState("");
  const [personaje, setPersonaje] = useState("");
  const [uso, setUso] = useState("");

  const capPorId = useMemo(() => new Map(datos.capitulos.map((c) => [c.id, c])), [datos.capitulos]);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return datos.canciones.filter((c) => {
      if (t && !`${c.titulo} ${c.artista ?? ""}`.toLowerCase().includes(t)) return false;
      if (uso && (c.uso ?? "") !== uso) return false;
      if (personaje && !c.personajes.includes(Number(personaje))) return false;
      if (libro && !c.capitulos.some((id) => (capPorId.get(id)?.libro ?? "") === libro)) return false;
      return true;
    });
  }, [datos.canciones, q, uso, personaje, libro, capPorId]);

  const grupos = useMemo<Grupo[]>(() => {
    if (vista === "uso") {
      const orden = [...datos.usos];
      for (const c of filtradas) if (c.uso && !orden.includes(c.uso)) orden.push(c.uso);
      const out: Grupo[] = orden.map((u) => ({ clave: u, titulo: u, canciones: filtradas.filter((c) => c.uso === u) }));
      out.push({ clave: "", titulo: "Sin uso", canciones: filtradas.filter((c) => !c.uso) });
      return out.filter((g) => g.canciones.length > 0);
    }
    const out: Grupo[] = datos.capitulos
      .filter((cap) => !libro || (cap.libro ?? "") === libro)
      .map((cap) => ({
        clave: String(cap.id),
        titulo: `${cap.numero} — ${cap.titulo}`,
        seccion: cap.libro ?? "Sin libro",
        canciones: filtradas.filter((c) => c.capitulos.includes(cap.id)),
      }));
    if (!libro) out.push({ clave: "sin", titulo: "Aún no suenan en ningún capítulo", canciones: filtradas.filter((c) => c.capitulos.length === 0) });
    return out.filter((g) => g.canciones.length > 0);
  }, [vista, filtradas, datos.usos, datos.capitulos, libro]);

  const hayFiltros = q || libro || personaje || uso;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12">
      <header className="mb-8 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
            <Icon name={meta.icon} className={meta.accent} size={22} />
          </span>
          <div>
            <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">{meta.plural}</h1>
            <p className="text-sm text-fg-muted">{meta.tagline}</p>
          </div>
        </div>
        {filtradas.length > 0 && (
          <button
            type="button"
            onClick={() => loadQueue(grupos.flatMap((g) => g.canciones).filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i))}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-void transition-transform hover:scale-[1.02]"
          >
            <Icon name="Play" size={16} /> Reproducir todo
          </button>
        )}
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Agrupar" className="inline-flex overflow-hidden rounded-full border border-border-base text-xs">
          {(
            [
              ["uso", "Por uso"],
              ["historia", "Por historia"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => setVista(v)}
              className={cn("px-4 py-1.5 transition-colors", vista === v ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar música…"
            className="w-full rounded-xl border border-border-base bg-surface/60 py-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-border-glow"
          />
        </div>
        {datos.libros.length > 0 && (
          <select value={libro} onChange={(e) => setLibro(e.target.value)} className={selCls} aria-label="Libro">
            <option value="">Todos los libros</option>
            {datos.libros.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        {datos.personajes.length > 0 && (
          <select value={personaje} onChange={(e) => setPersonaje(e.target.value)} className={selCls} aria-label="Personaje">
            <option value="">Cualquier personaje</option>
            {datos.personajes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        )}
        {datos.usos.length > 0 && (
          <select value={uso} onChange={(e) => setUso(e.target.value)} className={selCls} aria-label="Uso">
            <option value="">Cualquier uso</option>
            {datos.usos.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setLibro("");
              setPersonaje("");
              setUso("");
            }}
            className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
          >
            <Icon name="X" size={12} /> Limpiar
          </button>
        )}
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-base py-20 text-center text-fg-muted">
          {datos.canciones.length === 0 ? "Aún no hay música publicada." : "No hay canciones que coincidan."}
        </div>
      ) : (
        <div className="space-y-10">
          {grupos.map((g, i) => (
            <section key={`${vista}-${g.clave}`}>
              {g.seccion && g.seccion !== grupos[i - 1]?.seccion && (
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-fg-muted">{g.seccion}</p>
              )}
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-display text-xl text-accent">{g.titulo}</h2>
                <span className="text-xs text-fg-muted">
                  {g.canciones.length} {g.canciones.length === 1 ? "tema" : "temas"}
                </span>
                <button
                  type="button"
                  onClick={() => loadQueue(g.canciones)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border-glow px-3 py-1 text-xs text-fg-secondary hover:text-fg"
                >
                  <Icon name="Play" size={12} /> Reproducir
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {g.canciones.map((c, j) => (
                  <Disco key={c.id} cancion={c} onPlay={() => loadQueue(g.canciones, j)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Una canción como carátula de disco: se reproduce al pulsar la portada y se abre su ficha desde el título. */
function Disco({ cancion: c, onPlay }: { cancion: Track; onPlay: () => void }) {
  const actual = usePlayerStore((s) => s.current?.id === c.id);
  const sonando = usePlayerStore((s) => s.current?.id === c.id && s.isPlaying);
  const fuente = fuenteDe(c.tipoFuente, c.url);
  return (
    <li>
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "group relative block aspect-square w-full overflow-hidden rounded-2xl border bg-deep",
          actual ? "border-primary shadow-[var(--shadow-glow-primary)]" : "border-border-base hover:border-border-glow",
        )}
        aria-label={`Reproducir ${c.titulo}`}
      >
        <EntityImage src={c.imagenUrl} alt={c.titulo} name={c.titulo} sizes="(min-width: 1024px) 20vw, 45vw" />
        <span
          className={cn(
            "absolute inset-0 grid place-items-center bg-void/40 transition-opacity",
            actual ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-void">
            <Icon name={sonando ? "Pause" : "Play"} size={20} />
          </span>
        </span>
      </button>
      <Link href={`/canciones/${c.id}`} className="mt-2 block truncate text-sm text-fg hover:text-accent">
        {c.titulo}
      </Link>
      <p className="flex items-center gap-2 truncate text-xs text-fg-muted">
        <span className="truncate">{c.artista ?? "Astralys OST"}</span>
        {formatoDuracion(c.duracion) && <span className="font-mono">{formatoDuracion(c.duracion)}</span>}
        {fuente && fuente !== "audio" && <span className="shrink-0 text-[10px] uppercase">{NOMBRE_FUENTE[fuente]}</span>}
      </p>
    </li>
  );
}
