"use client";

import { Icon } from "@/components/Icon";
import { usePlayerStore, type Track } from "@/hooks/usePlayerStore";

/** Lista de canciones de una ficha que alimenta el reproductor global (§9.4). */
export function SongList({ tracks }: { tracks: Track[] }) {
  const { loadQueue, current, isPlaying } = usePlayerStore();
  if (tracks.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-accent">
        <Icon name="Music" size={18} /> Banda sonora
      </h2>
      <ul className="divide-y divide-border-base overflow-hidden rounded-2xl border border-border-base">
        {tracks.map((t, i) => {
          const isCurrent = current?.id === t.id;
          return (
            <li key={t.id}>
              <button
                onClick={() => loadQueue(tracks, i)}
                className="flex w-full items-center gap-3 bg-surface/40 px-4 py-3 text-left transition-colors hover:bg-surface"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full border border-border-base bg-deep">
                  <Icon
                    name={isCurrent && isPlaying ? "Pause" : "Play"}
                    size={15}
                    className={isCurrent ? "text-primary" : "text-fg-muted"}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{t.titulo}</span>
                  <span className="block truncate text-xs text-fg-muted">
                    {t.artista ?? t.contexto ?? (t.tipoFuente ?? "").toLowerCase()}
                  </span>
                </span>
                {t.tipoFuente && t.tipoFuente.toUpperCase() !== "LOCAL" && (
                  <span className="text-[10px] uppercase text-fg-muted">{t.tipoFuente}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
