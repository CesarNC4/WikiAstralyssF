"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { usePlayerStore } from "@/hooks/usePlayerStore";
import { EntityImage } from "@/components/media/EntityImage";

function embedUrl(track: { tipoFuente: string | null; url: string | null }): string | null {
  if (!track.url) return null;
  const u = track.url;
  const f = (track.tipoFuente ?? "").toUpperCase();
  if (f === "YOUTUBE" || /youtu/.test(u)) {
    const m = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  if (f === "SPOTIFY" || /spotify/.test(u)) {
    return u.replace("open.spotify.com/", "open.spotify.com/embed/");
  }
  if (f === "SOUNDCLOUD" || /soundcloud/.test(u)) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}`;
  }
  return null;
}

/** Barra de reproductor global persistente (§9). LOCAL via <audio>, externo via embed. */
export function MusicPlayerBar() {
  const { current, isPlaying, toggle, next, prev, expanded, setExpanded, close, setPlaying } =
    usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);

  const isLocal = (current?.tipoFuente ?? "LOCAL").toUpperCase() === "LOCAL";

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !isLocal) return;
    if (isPlaying) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [isPlaying, current, isLocal, setPlaying]);

  if (!current) return null;
  const embed = !isLocal ? embedUrl(current) : null;

  return (
    <>
      {/* Mini-barra: anclada sobre el bottom nav en móvil */}
      <div className="fixed inset-x-0 bottom-[57px] z-40 md:bottom-0">
        <div className="mx-auto max-w-7xl px-2 pb-2 md:px-4 md:pb-3">
          <div className="flex items-center gap-3 rounded-2xl border border-border-glow bg-deep/95 px-3 py-2 shadow-[var(--shadow-glow-primary)] backdrop-blur-xl">
            <button onClick={() => setExpanded(!expanded)} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
              <EntityImage src={current.imagenUrl} alt={current.titulo} name={current.titulo} sizes="44px" />
            </button>
            <div className="min-w-0 flex-1" onClick={() => setExpanded(!expanded)}>
              <p className="truncate text-sm text-fg">{current.titulo}</p>
              <p className="truncate text-xs text-fg-muted">{current.artista ?? current.contexto ?? "Astralys OST"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={prev} className="hidden p-2 text-fg-muted hover:text-fg sm:block" aria-label="Anterior">
                <Icon name="SkipBack" size={18} />
              </button>
              <button
                onClick={toggle}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary text-void"
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
              >
                <Icon name={isPlaying ? "Pause" : "Play"} size={18} />
              </button>
              <button onClick={next} className="p-2 text-fg-muted hover:text-fg" aria-label="Siguiente">
                <Icon name="SkipForward" size={18} />
              </button>
              <button onClick={close} className="p-2 text-fg-muted hover:text-error" aria-label="Cerrar">
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audio nativo (solo LOCAL). preload=none para no descargar al navegar (§9.5). */}
      {isLocal && current.url && (
        <audio
          ref={audioRef}
          src={current.url}
          preload="none"
          onEnded={next}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      )}

      {/* Panel expandido: embed externo bajo demanda (§9.5) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={() => setExpanded(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.28 }}
              className="relative w-full max-w-lg rounded-t-3xl border border-border-glow bg-deep p-5"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-base" />
              <div className="flex gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
                  <EntityImage src={current.imagenUrl} alt={current.titulo} name={current.titulo} sizes="96px" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl text-fg">{current.titulo}</h3>
                  <p className="text-sm text-fg-muted">{current.artista ?? "Astralys OST"}</p>
                  {current.contexto && <p className="mt-1 text-xs text-fg-secondary">{current.contexto}</p>}
                </div>
              </div>
              {embed && (
                <div className="mt-4 overflow-hidden rounded-xl border border-border-base">
                  <iframe
                    src={embed}
                    title={current.titulo}
                    className="aspect-video w-full"
                    allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
