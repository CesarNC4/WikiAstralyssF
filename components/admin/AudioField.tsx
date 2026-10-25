"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { registrarAsset } from "@/lib/actions/media";
import { carpetaDe, faltaConfigSubida, RUTA_FIRMA } from "@/lib/media/carpetas";
import { deducirFuente, NOMBRE_FUENTE } from "@/lib/media/fuentes";
import { useToast } from "@/components/admin/Toast";
import { cn } from "@/lib/utils";

// Carga diferida, como en ImageField: el bundle del widget solo llega al usarlo.
const CldUploadWidget = dynamic(
  () => import("next-cloudinary").then((m) => m.CldUploadWidget),
  { ssr: false },
);

const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/** Formatos que admite el widget. Cloudinary guarda el audio como recurso `video`. */
const FORMATOS = ["mp3", "wav", "ogg", "m4a"];

export interface AudioValue {
  /** El archivo propio en media_assets. Con él, `url` es la suya en Cloudinary. */
  assetId: number | null;
  url: string | null;
  /** Segundos; solo con audio propio. */
  duracion: number | null;
}

export function formatoDuracion(s: number | null | undefined): string | null {
  if (!s || s <= 0) return null;
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

/** Id de un vídeo de YouTube a partir de cualquiera de sus formas de enlace. */
export function idYoutube(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1] ?? null;
}

/**
 * De dónde suena una canción (docs/fragmentos-y-musica.md §3.5): **subir audio**
 * propio a Cloudinary o **pegar un enlace** (YouTube, Suno, SoundCloud,
 * Bandcamp…), uno de los dos. La fuente no se elige: el servidor la deduce al
 * guardar, y aquí solo se enseña lo que se ha reconocido. Debajo, una
 * reproducción de prueba.
 */
export function AudioField({ value, onChange }: { value: AudioValue; onChange: (v: AudioValue) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<"subir" | "enlace">(value.assetId != null || !value.url ? "subir" : "enlace");
  const falta = faltaConfigSubida();
  const fuente = value.assetId != null ? "audio" : deducirFuente(value.url);

  const cambiarModo = (m: "subir" | "enlace") => {
    if (m === modo) return;
    // Uno de los dos: cambiar de modo suelta lo del otro (el archivo huérfano
    // lo borra la purga al guardar).
    if (value.assetId != null || value.url) {
      if (!confirm(m === "enlace" ? "¿Quitar el audio subido y usar un enlace?" : "¿Quitar el enlace y subir un audio?")) return;
      onChange({ assetId: null, url: null, duracion: null });
    }
    setModo(m);
  };

  return (
    <div className="space-y-3">
      <div className="flex overflow-hidden rounded-lg border border-border-base text-xs" role="group" aria-label="Origen del audio">
        {(
          [
            ["subir", "Subir audio"],
            ["enlace", "Pegar enlace"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() => cambiarModo(m)}
            className={cn("px-3 py-1.5", modo === m ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
          >
            {label}
          </button>
        ))}
      </div>

      {modo === "subir" ? (
        <div className="flex flex-wrap items-center gap-3">
          {falta ? (
            <p className="text-xs text-error">Falta {falta} en .env.local.</p>
          ) : (
            <CldUploadWidget
              uploadPreset={PRESET}
              signatureEndpoint={RUTA_FIRMA}
              options={{
                folder: carpetaDe("canciones", "audio"),
                resourceType: "video",
                clientAllowedFormats: FORMATOS,
                sources: ["local", "url"],
                multiple: false,
                maxFiles: 1,
              }}
              onSuccess={async (result) => {
                const info = result?.info;
                if (!info || typeof info === "string") return;
                setBusy(true);
                try {
                  const reg = await registrarAsset({
                    publicId: info.public_id,
                    url: info.secure_url,
                    bytes: info.bytes,
                    format: info.format,
                    tipo: "audio",
                  });
                  const duracion = (info as { duration?: number }).duration;
                  onChange({ assetId: reg.id, url: reg.url, duracion: duracion ? Math.round(duracion) : null });
                  toast("Audio subido. Guarda la canción para conservarlo.", "success");
                } catch {
                  toast("No se pudo registrar el audio.", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {({ open }) => (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => open()}
                  className="rounded-lg border border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg disabled:opacity-50"
                >
                  {busy ? "Procesando…" : value.assetId != null ? "Cambiar audio" : "Subir audio"}
                </button>
              )}
            </CldUploadWidget>
          )}
          <span className="text-xs text-fg-muted">{FORMATOS.join(", ")}. Unos 3–8 MB por tema.</span>
          {value.assetId != null && (
            <button type="button" onClick={() => onChange({ assetId: null, url: null, duracion: null })} className="text-xs text-fg-muted hover:text-error">
              Quitar audio
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <input
            value={value.url ?? ""}
            onChange={(e) => onChange({ assetId: null, url: e.target.value || null, duracion: null })}
            placeholder="https://www.youtube.com/watch?v=… · https://suno.com/song/… · https://soundcloud.com/…"
            className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-border-glow"
          />
          {fuente && <p className="text-xs text-fg-muted">Se reconoce: {NOMBRE_FUENTE[fuente]}.</p>}
        </div>
      )}

      <Prueba value={value} fuente={fuente} />
    </div>
  );
}

/** Reproducción de prueba, con lo que cada fuente permite sin el reproductor global. */
function Prueba({ value, fuente }: { value: AudioValue; fuente: ReturnType<typeof deducirFuente> | "audio" }) {
  if (!value.url || !fuente) return null;
  if (fuente === "audio") {
    return (
      <div className="flex items-center gap-3">
        <audio controls preload="metadata" src={value.url} className="h-9 w-full max-w-md" />
        {formatoDuracion(value.duracion) && <span className="font-mono text-xs text-fg-muted">{formatoDuracion(value.duracion)}</span>}
      </div>
    );
  }
  if (fuente === "youtube") {
    const id = idYoutube(value.url);
    if (id)
      return (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title="Prueba de YouTube"
          allow="encrypted-media; picture-in-picture"
          className="aspect-video w-full max-w-sm rounded-lg border border-border-base"
        />
      );
  }
  return (
    <a href={value.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
      Abrir el enlace para probarlo →
    </a>
  );
}
