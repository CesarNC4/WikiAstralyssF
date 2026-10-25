"use client";

import { create } from "zustand";
import { embedDe, fuenteDe } from "@/lib/media/fuentes";

export interface Track {
  id: number;
  titulo: string;
  artista: string | null;
  /** Lo que se reproduce: el enlace o, con audio propio, la URL de Cloudinary. */
  url: string | null;
  /** audio | youtube | soundcloud | suno | bandcamp | spotify | externo (`lib/media/fuentes.ts`). */
  tipoFuente: string | null;
  imagenUrl: string | null;
  contexto?: string | null;
  letra?: string | null;
  /** Segundos, si se conocen antes de reproducir (audio propio). */
  duracion?: number | null;
}

/**
 * Lo que sabe hacer el motor de la fuente que suena (§3.6). Cada motor
 * (`<audio>`, YouTube, SoundCloud) se registra al montarse; la barra y los
 * controles del sistema (Media Session) hablan con él a través del estado, sin
 * saber de qué fuente se trata.
 */
export interface Motor {
  seek: (segundos: number) => void;
}

interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  expanded: boolean;
  /** Segundos. `duracion` null mientras el motor no la sabe (o si no puede saberla). */
  posicion: number;
  duracion: number | null;
  /** 0–1, compartido por todos los motores. */
  volumen: number;
  /** Qué ha impedido reproducir, para decirlo en lugar de fallar en silencio. */
  aviso: string | null;
  motor: Motor | null;
  loadQueue: (tracks: Track[], startIndex?: number) => void;
  play: (track: Track) => void;
  toggle: () => void;
  setPlaying: (v: boolean) => void;
  next: () => void;
  prev: () => void;
  setExpanded: (v: boolean) => void;
  close: () => void;
  seek: (segundos: number) => void;
  setVolumen: (v: number) => void;
  progreso: (posicion: number, duracion?: number | null) => void;
  setAviso: (aviso: string | null) => void;
  registrarMotor: (motor: Motor | null) => void;
}

/** Las fuentes que la barra controla de verdad. El resto suena (si puede) en su propio reproductor. */
export function esControlable(t: Track | null): boolean {
  const f = t ? fuenteDe(t.tipoFuente, t.url) : null;
  return f === "audio" || f === "youtube" || f === "soundcloud";
}

/**
 * Estado al cambiar de canción: nada de lo de la anterior sirve. Con una fuente
 * sin control (Suno, Spotify, Bandcamp…) la cola se detiene ahí: se abre el
 * panel con su reproductor embebido o, si no lo tiene, se dice que no se puede
 * reproducir aquí (§3.6: nada de fallar sin avisar).
 */
function alCambiar(t: Track | null) {
  const base = { posicion: 0, duracion: t?.duracion ?? null, aviso: null as string | null };
  if (!t || esControlable(t)) return { ...base, isPlaying: Boolean(t) };
  const embebible = embedDe(fuenteDe(t.tipoFuente, t.url), t.url) != null;
  return {
    ...base,
    isPlaying: false,
    expanded: embebible,
    aviso: embebible ? null : t.url ? "No se puede reproducir aquí." : "Esta canción aún no tiene audio.",
  };
}

/** Estado global del reproductor (§9.2) — persiste entre navegaciones. */
export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  current: null,
  isPlaying: false,
  expanded: false,
  posicion: 0,
  duracion: null,
  volumen: 1,
  aviso: null,
  motor: null,

  loadQueue: (tracks, startIndex = 0) => {
    const t = tracks[startIndex] ?? null;
    set({ queue: tracks, index: startIndex, current: t, ...alCambiar(t) });
  },

  play: (track) => {
    const { queue } = get();
    const idx = queue.findIndex((t) => t.id === track.id);
    set({
      current: track,
      index: idx === -1 ? 0 : idx,
      queue: idx === -1 ? [track] : queue,
      ...alCambiar(track),
    });
  },

  // Una fuente sin control no "suena" en la barra: su reproductor está en el panel.
  toggle: () => set((st) => ({ isPlaying: st.current && esControlable(st.current) ? !st.isPlaying : false })),
  setPlaying: (v) => set({ isPlaying: v }),

  next: () => {
    const { queue, index } = get();
    const ni = index + 1;
    if (ni < queue.length) set({ index: ni, current: queue[ni], ...alCambiar(queue[ni]) });
    else set({ isPlaying: false });
  },

  prev: () => {
    const { queue, index, posicion, motor } = get();
    // Como en cualquier reproductor: pasados unos segundos, "anterior" vuelve al principio.
    if (posicion > 3 && motor) return motor.seek(0);
    const pi = index - 1;
    if (pi >= 0) set({ index: pi, current: queue[pi], ...alCambiar(queue[pi]) });
  },

  setExpanded: (v) => set({ expanded: v }),
  close: () => set({ current: null, queue: [], index: -1, expanded: false, ...alCambiar(null) }),

  seek: (s) => get().motor?.seek(s),
  setVolumen: (v) => set({ volumen: Math.min(1, Math.max(0, v)) }),
  progreso: (posicion, duracion) => set(duracion === undefined ? { posicion } : { posicion, duracion }),
  setAviso: (aviso) => set({ aviso }),
  registrarMotor: (motor) => set({ motor }),
}));
