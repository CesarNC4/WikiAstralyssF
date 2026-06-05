"use client";

import { create } from "zustand";

export interface Track {
  id: number;
  titulo: string;
  artista: string | null;
  url: string | null;
  tipoFuente: string | null; // 'LOCAL' | 'YOUTUBE' | 'SPOTIFY' | 'SOUNDCLOUD'
  imagenUrl: string | null;
  contexto?: string | null;
}

interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  expanded: boolean;
  loadQueue: (tracks: Track[], startIndex?: number) => void;
  play: (track: Track) => void;
  toggle: () => void;
  setPlaying: (v: boolean) => void;
  next: () => void;
  prev: () => void;
  setExpanded: (v: boolean) => void;
  close: () => void;
}

/** Estado global del reproductor (§9.2) — persiste entre navegaciones. */
export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  current: null,
  isPlaying: false,
  expanded: false,

  loadQueue: (tracks, startIndex = 0) =>
    set({
      queue: tracks,
      index: startIndex,
      current: tracks[startIndex] ?? null,
      isPlaying: Boolean(tracks[startIndex]),
    }),

  play: (track) => {
    const { queue } = get();
    const idx = queue.findIndex((t) => t.id === track.id);
    set({
      current: track,
      index: idx,
      isPlaying: true,
      queue: idx === -1 ? [track] : queue,
      ...(idx === -1 ? { index: 0 } : {}),
    });
  },

  toggle: () => set((st) => ({ isPlaying: st.current ? !st.isPlaying : false })),
  setPlaying: (v) => set({ isPlaying: v }),

  next: () => {
    const { queue, index } = get();
    const ni = index + 1;
    if (ni < queue.length) set({ index: ni, current: queue[ni], isPlaying: true });
    else set({ isPlaying: false });
  },

  prev: () => {
    const { queue, index } = get();
    const pi = index - 1;
    if (pi >= 0) set({ index: pi, current: queue[pi], isPlaying: true });
  },

  setExpanded: (v) => set({ expanded: v }),
  close: () => set({ current: null, isPlaying: false, queue: [], index: -1, expanded: false }),
}));
