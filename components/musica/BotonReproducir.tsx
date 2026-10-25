"use client";

import { Icon } from "@/components/Icon";
import { usePlayerStore, type Track } from "@/hooks/usePlayerStore";

/** Reproduce una canción desde su ficha; si ya está sonando, la pausa. */
export function BotonReproducir({ track }: { track: Track }) {
  const actual = usePlayerStore((s) => s.current?.id === track.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const { loadQueue, toggle } = usePlayerStore.getState();
  const sonando = actual && isPlaying;
  return (
    <button
      type="button"
      onClick={() => (actual ? toggle() : loadQueue([track]))}
      className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-void transition-transform hover:scale-[1.02]"
    >
      <Icon name={sonando ? "Pause" : "Play"} size={16} /> {sonando ? "Pausar" : "Reproducir"}
    </button>
  );
}
