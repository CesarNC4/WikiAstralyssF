"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore, type Track } from "@/hooks/usePlayerStore";
import { idYoutube } from "@/lib/media/fuentes";
import { cn } from "@/lib/utils";

/**
 * Un motor por fuente controlable (docs/fragmentos-y-musica.md §3.6). Cada uno
 * se monta con la canción que suena (con `key` por canción, así cambiar de tema
 * es desmontar y montar), obedece a `isPlaying` y `volumen` del estado, informa
 * del progreso, registra cómo saltar y pasa a la siguiente al terminar.
 *
 * Viven en el layout público, fuera de las páginas: por eso la música sigue al
 * navegar dentro de la wiki.
 */

/** Las acciones del estado no cambian nunca: se leen una vez. */
const acciones = () => usePlayerStore.getState();

/** Carga un script de terceros una sola vez por página. */
function cargarScript(src: string): Promise<void> {
  const previo = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (previo?.dataset.cargado) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = previo ?? document.createElement("script");
    s.addEventListener("load", () => {
      s.dataset.cargado = "1";
      resolve();
    });
    s.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)));
    if (!previo) {
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

// ── Audio propio ───────────────────────────────────────────────────────────

/** `<audio>`: control completo (progreso, salto, volumen). */
export function MotorAudio({ track }: { track: Track }) {
  const ref = useRef<HTMLAudioElement>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volumen = usePlayerStore((s) => s.volumen);

  useEffect(() => {
    acciones().registrarMotor({
      seek: (s) => {
        if (ref.current) ref.current.currentTime = s;
      },
    });
    return () => acciones().registrarMotor(null);
  }, []);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (isPlaying) a.play().catch(() => acciones().setPlaying(false));
    else a.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volumen;
  }, [volumen]);

  return (
    <audio
      ref={ref}
      src={track.url ?? undefined}
      preload="auto"
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        acciones().progreso(e.currentTarget.currentTime, Number.isFinite(d) ? d : null);
      }}
      onTimeUpdate={(e) => acciones().progreso(e.currentTarget.currentTime)}
      onPlay={() => acciones().setPlaying(true)}
      // Al terminar también llega un "pause": no es el lector quien pausa.
      onPause={(e) => !e.currentTarget.ended && acciones().setPlaying(false)}
      onEnded={() => acciones().next()}
      onError={() => {
        acciones().setAviso("No se pudo cargar el audio.");
        acciones().setPlaying(false);
      }}
    />
  );
}

// ── YouTube ────────────────────────────────────────────────────────────────

/** Lo poco que se usa de la IFrame API de YouTube. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, permitirBuffer: boolean): void;
  setVolume(v: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady: (e: { target: YTPlayer }) => void;
        onStateChange: (e: { data: number; target: YTPlayer }) => void;
        onError: () => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiYoutube: Promise<YTNamespace> | null = null;

function cargarYoutube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiYoutube ??= new Promise((resolve, reject) => {
    const previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previo?.();
      resolve(window.YT!);
    };
    cargarScript("https://www.youtube.com/iframe_api").catch((e) => {
      apiYoutube = null;
      reject(e);
    });
  });
  return apiYoutube;
}

/**
 * YouTube: play, pausa, salto y fin → siguiente. **YouTube exige que su
 * reproductor se vea y mida al menos 200×200**, así que mientras suena hay una
 * ventanita flotante con el vídeo: no se puede ocultar ni reducir más.
 */
export function MotorYouTube({ track }: { track: Track }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volumen = usePlayerStore((s) => s.volumen);
  const expanded = usePlayerStore((s) => s.expanded);
  const id = idYoutube(track.url ?? "");

  useEffect(() => {
    if (!id) {
      acciones().setAviso("No se reconoce el vídeo de este enlace de YouTube.");
      acciones().setPlaying(false);
      return;
    }
    let vivo = true;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    cargarYoutube()
      .then((YT) => {
        if (!vivo || !contenedor.current) return;
        // YouTube sustituye este nodo por su iframe: se crea fuera de React.
        const nodo = document.createElement("div");
        contenedor.current.appendChild(nodo);
        player.current = new YT.Player(nodo, {
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: ({ target }) => {
              const st = acciones();
              target.setVolume(Math.round(st.volumen * 100));
              if (st.isPlaying) target.playVideo();
              st.progreso(0, target.getDuration() || null);
              st.registrarMotor({ seek: (s) => target.seekTo(s, true) });
            },
            onStateChange: ({ data, target }) => {
              if (data === YT.PlayerState.PLAYING) {
                acciones().setPlaying(true);
                acciones().progreso(target.getCurrentTime(), target.getDuration() || null);
              } else if (data === YT.PlayerState.PAUSED) acciones().setPlaying(false);
              else if (data === YT.PlayerState.ENDED) acciones().next();
            },
            onError: () => {
              acciones().setAviso("YouTube no deja reproducir este vídeo fuera de su web.");
              acciones().setPlaying(false);
            },
          },
        });
        intervalo = setInterval(() => {
          const p = player.current;
          if (p && p.getPlayerState?.() === YT.PlayerState.PLAYING) acciones().progreso(p.getCurrentTime(), p.getDuration() || null);
        }, 500);
      })
      .catch(() => {
        if (!vivo) return;
        acciones().setAviso("No se pudo cargar YouTube.");
        acciones().setPlaying(false);
      });
    return () => {
      vivo = false;
      clearInterval(intervalo);
      acciones().registrarMotor(null);
      player.current?.destroy();
      player.current = null;
    };
  }, [id]);

  useEffect(() => {
    const p = player.current;
    if (!p?.playVideo) return;
    if (isPlaying) p.playVideo();
    else p.pauseVideo();
  }, [isPlaying]);

  useEffect(() => {
    player.current?.setVolume?.(Math.round(volumen * 100));
  }, [volumen]);

  if (!id) return null;
  return (
    <div
      className={cn(
        "fixed right-3 h-[200px] w-[260px] overflow-hidden rounded-xl border border-border-glow bg-black shadow-[var(--shadow-glow-primary)]",
        // Con el panel abierto su fondo la taparía: sube arriba y por encima.
        expanded ? "top-3 z-[75]" : "bottom-[140px] z-[45] md:bottom-24",
      )}
      aria-label="Vídeo de YouTube que está sonando"
    >
      <div ref={contenedor} className="h-full w-full" />
    </div>
  );
}

// ── SoundCloud ─────────────────────────────────────────────────────────────

interface SCWidget {
  bind(evento: string, fn: (e?: { currentPosition: number }) => void): void;
  play(): void;
  pause(): void;
  seekTo(ms: number): void;
  setVolume(v: number): void;
  getDuration(fn: (ms: number) => void): void;
}
interface SCNamespace {
  Widget: ((iframe: HTMLIFrameElement) => SCWidget) & {
    Events: Record<"READY" | "PLAY" | "PAUSE" | "FINISH" | "PLAY_PROGRESS" | "ERROR", string>;
  };
}
declare global {
  interface Window {
    SC?: SCNamespace;
  }
}

/** SoundCloud: como YouTube, pero sin obligación de verse. */
export function MotorSoundCloud({ track }: { track: Track }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const widget = useRef<SCWidget | null>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volumen = usePlayerStore((s) => s.volumen);
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.url ?? "")}&auto_play=true&visual=false&show_comments=false`;

  useEffect(() => {
    let vivo = true;
    cargarScript("https://w.soundcloud.com/player/api.js")
      .then(() => {
        const SC = window.SC;
        if (!vivo || !iframe.current || !SC) return;
        const w = SC.Widget(iframe.current);
        const E = SC.Widget.Events;
        w.bind(E.READY, () => {
          widget.current = w;
          const st = acciones();
          w.setVolume(Math.round(st.volumen * 100));
          w.getDuration((ms) => acciones().progreso(0, ms ? ms / 1000 : null));
          if (st.isPlaying) w.play();
          st.registrarMotor({ seek: (s) => w.seekTo(s * 1000) });
        });
        w.bind(E.PLAY, () => acciones().setPlaying(true));
        w.bind(E.PAUSE, () => acciones().setPlaying(false));
        w.bind(E.FINISH, () => acciones().next());
        w.bind(E.PLAY_PROGRESS, (e) => e && acciones().progreso(e.currentPosition / 1000));
        w.bind(E.ERROR, () => {
          acciones().setAviso("SoundCloud no deja reproducir esta pista aquí.");
          acciones().setPlaying(false);
        });
      })
      .catch(() => {
        if (!vivo) return;
        acciones().setAviso("No se pudo cargar SoundCloud.");
        acciones().setPlaying(false);
      });
    return () => {
      vivo = false;
      widget.current = null;
      acciones().registrarMotor(null);
    };
  }, [src]);

  useEffect(() => {
    const w = widget.current;
    if (!w) return;
    if (isPlaying) w.play();
    else w.pause();
  }, [isPlaying]);

  useEffect(() => {
    widget.current?.setVolume(Math.round(volumen * 100));
  }, [volumen]);

  // Fuera de la pantalla pero montado: un iframe con display:none no suena en todos los navegadores.
  return (
    <iframe
      ref={iframe}
      src={src}
      title={`SoundCloud: ${track.titulo}`}
      allow="autoplay"
      aria-hidden
      tabIndex={-1}
      className="pointer-events-none fixed -left-[9999px] top-0 h-[166px] w-[300px]"
    />
  );
}
