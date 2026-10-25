"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { esControlable, usePlayerStore, type Track } from "@/hooks/usePlayerStore";
import { embedDe, formatoDuracion, fuenteDe, NOMBRE_FUENTE, type Fuente } from "@/lib/media/fuentes";
import { MotorAudio, MotorSoundCloud, MotorYouTube } from "./motores";

/**
 * Reproductor global (docs/fragmentos-y-musica.md §3.6). La cola y el estado
 * viven en `usePlayerStore`; aquí se monta el motor de la fuente que suena, la
 * barra y el panel desplegable con la letra y, para las fuentes sin control
 * (Suno, Spotify), su reproductor embebido. Va en el layout público, así que
 * sigue sonando al navegar.
 */
export function MusicPlayer() {
  const current = usePlayerStore((s) => s.current);
  const fuente = current ? fuenteDe(current.tipoFuente, current.url) : null;

  useMediaSession(current);

  if (!current) return null;
  return (
    <>
      {fuente === "audio" && current.url && <MotorAudio key={current.id} track={current} />}
      {fuente === "youtube" && <MotorYouTube key={current.id} track={current} />}
      {fuente === "soundcloud" && <MotorSoundCloud key={current.id} track={current} />}
      <Barra track={current} fuente={fuente} />
      <Panel track={current} fuente={fuente} />
    </>
  );
}

function Barra({ track, fuente }: { track: Track; fuente: Fuente | null }) {
  const { isPlaying, toggle, next, prev, expanded, setExpanded, close, posicion, duracion, seek, volumen, setVolumen, aviso, queue, index } =
    usePlayerStore();
  const controlable = esControlable(track);

  return (
    // Anclada sobre el bottom nav en móvil.
    <div className="fixed inset-x-0 bottom-[57px] z-40 md:bottom-0">
      <div className="mx-auto max-w-7xl px-2 pb-2 md:px-4 md:pb-3">
        <div className="rounded-2xl border border-border-glow bg-deep/95 px-3 py-2 shadow-[var(--shadow-glow-primary)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setExpanded(!expanded)} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg" aria-label="Abrir el panel del reproductor">
              <EntityImage src={track.imagenUrl} alt={track.titulo} name={track.titulo} sizes="44px" />
            </button>
            <button onClick={() => setExpanded(!expanded)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm text-fg">{track.titulo}</p>
              <p className="truncate text-xs text-fg-muted">
                {aviso ? (
                  <span className="text-warning">{aviso}</span>
                ) : !controlable && fuente ? (
                  `Suena en el reproductor de ${NOMBRE_FUENTE[fuente]}`
                ) : (
                  (track.artista ?? track.contexto ?? "Astralys OST")
                )}
              </p>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={prev} disabled={index <= 0 && posicion <= 3} className="hidden p-2 text-fg-muted hover:text-fg disabled:opacity-30 sm:block" aria-label="Anterior">
                <Icon name="SkipBack" size={18} />
              </button>
              <button
                onClick={controlable ? toggle : () => setExpanded(true)}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary text-void disabled:opacity-40"
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                disabled={Boolean(aviso) && !track.url}
              >
                <Icon name={isPlaying ? "Pause" : "Play"} size={18} />
              </button>
              <button onClick={next} disabled={index >= queue.length - 1} className="p-2 text-fg-muted hover:text-fg disabled:opacity-30" aria-label="Siguiente">
                <Icon name="SkipForward" size={18} />
              </button>
              {controlable && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volumen}
                  onChange={(e) => setVolumen(Number(e.target.value))}
                  aria-label="Volumen"
                  className="hidden w-20 accent-[var(--color-primary)] md:block"
                />
              )}
              <button onClick={() => setExpanded(!expanded)} className="hidden p-2 text-fg-muted hover:text-fg sm:block" aria-label={expanded ? "Cerrar el panel" : "Abrir el panel"}>
                <Icon name={expanded ? "ChevronDown" : "ChevronUp"} size={16} />
              </button>
              <button onClick={close} className="p-2 text-fg-muted hover:text-error" aria-label="Cerrar el reproductor">
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>

          {/* Progreso: solo si el motor sabe la duración (YouTube la da al reproducir). */}
          {controlable && duracion != null && duracion > 0 && (
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-fg-muted">
              <span className="w-9 text-right">{formatoDuracion(posicion)}</span>
              <input
                type="range"
                min={0}
                max={duracion}
                step={0.5}
                value={Math.min(posicion, duracion)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Progreso"
                className="h-1 flex-1 accent-[var(--color-primary)]"
              />
              <span className="w-9">{formatoDuracion(duracion)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ track, fuente }: { track: Track; fuente: Fuente | null }) {
  const { expanded, setExpanded, aviso } = usePlayerStore();
  const embed = embedDe(fuente, track.url);
  const controlable = esControlable(track);

  return (
    <AnimatePresence>
      {expanded && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={() => setExpanded(false)} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.28 }}
            className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl border border-border-glow bg-deep p-5"
          >
            <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-border-base" />
            <div className="flex shrink-0 gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
                <EntityImage src={track.imagenUrl} alt={track.titulo} name={track.titulo} sizes="96px" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xl text-fg">{track.titulo}</h3>
                <p className="text-sm text-fg-muted">{track.artista ?? "Astralys OST"}</p>
                {track.contexto && <p className="mt-1 text-xs text-fg-secondary">{track.contexto}</p>}
                {fuente && <p className="mt-1 text-[11px] uppercase tracking-wide text-fg-muted">{NOMBRE_FUENTE[fuente]}</p>}
              </div>
            </div>

            {/* Fuentes sin control: su propio reproductor. Al cerrar el panel deja de sonar. */}
            {!controlable && embed && (
              <div className="mt-4 shrink-0 overflow-hidden rounded-xl border border-border-base">
                <iframe
                  src={embed}
                  title={`${track.titulo} en ${fuente ? NOMBRE_FUENTE[fuente] : "su web"}`}
                  className="h-[152px] w-full"
                  allow="autoplay; encrypted-media; clipboard-write"
                />
              </div>
            )}
            {!controlable && embed && (
              <p className="mt-2 text-xs text-fg-muted">
                Este reproductor no se controla desde la barra: la cola se detiene aquí y deja de sonar al cerrar el panel.
                {fuente === "spotify" && " Sin sesión de Spotify solo se oyen 30 segundos."}
              </p>
            )}
            {fuente === "youtube" && (
              <p className="mt-3 text-xs text-fg-muted">
                YouTube obliga a que su vídeo se vea mientras suena: es la ventanita de la esquina. En el móvil se corta al bloquear la pantalla o
                cambiar de app.
              </p>
            )}

            {(aviso || (!controlable && !embed)) && track.url && (
              <p className="mt-4 text-sm text-warning">
                {aviso ?? "No se puede reproducir aquí."}{" "}
                <a href={track.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                  Abrir en {fuente ? NOMBRE_FUENTE[fuente] : "su web"}
                </a>
              </p>
            )}

            {track.letra && (
              <div className="mt-4 min-h-0 overflow-y-auto rounded-xl border border-border-base bg-surface/40 p-4">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-fg-muted">Letra</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-fg-secondary">{track.letra}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Media Session: título, artista y portada en la pantalla de bloqueo y en los
 * controles multimedia del sistema, con play, pausa, anterior, siguiente y
 * salto. Donde el navegador no la tiene, no hace nada.
 */
function useMediaSession(track: Track | null) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const posicion = usePlayerStore((s) => s.posicion);
  const duracion = usePlayerStore((s) => s.duracion);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!track) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: track.titulo,
      artist: track.artista ?? "Astralys",
      album: "Astralys",
      artwork: track.imagenUrl ? [{ src: track.imagenUrl, sizes: "512x512" }] : [],
    });
    const st = usePlayerStore.getState;
    const manejadores: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => st().setPlaying(true)],
      ["pause", () => st().setPlaying(false)],
      ["previoustrack", () => st().prev()],
      ["nexttrack", () => st().next()],
      ["seekto", (d) => d.seekTime != null && st().seek(d.seekTime)],
    ];
    for (const [accion, fn] of manejadores) {
      try {
        ms.setActionHandler(accion, fn);
      } catch {
        // Acción no soportada por este navegador.
      }
    }
    return () => {
      for (const [accion] of manejadores) {
        try {
          ms.setActionHandler(accion, null);
        } catch {}
      }
    };
  }, [track]);

  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = track ? (isPlaying ? "playing" : "paused") : "none";
  }, [isPlaying, track]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !duracion || duracion <= 0) return;
    try {
      navigator.mediaSession.setPositionState({ duration: duracion, position: Math.min(posicion, duracion), playbackRate: 1 });
    } catch {}
  }, [posicion, duracion]);
}
