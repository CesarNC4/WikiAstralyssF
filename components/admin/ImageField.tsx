"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { registrarAsset } from "@/lib/actions/media";
import { useToast } from "@/components/admin/Toast";

// Carga diferida: el bundle de next-cloudinary solo se descarga al usar el editor.
const CldUploadWidget = dynamic(
  () => import("next-cloudinary").then((m) => m.CldUploadWidget),
  { ssr: false },
);

const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export interface ImageValue {
  assetId: number | null;
  url: string | null;
}

/** Subida de imagen a Cloudinary + registro en media_assets. */
export function ImageField({
  label,
  value,
  onChange,
  alt,
  aspect = "aspect-square",
}: {
  label: string;
  value: ImageValue;
  onChange: (v: ImageValue) => void;
  alt?: string | null;
  aspect?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</span>
      <div className="flex items-start gap-3">
        <div className={`relative w-28 overflow-hidden rounded-xl border border-border-base bg-deep ${aspect}`}>
          {value.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt={alt ?? label} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl text-border-glow">✦</div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {!PRESET ? (
            <p className="text-xs text-error">Falta NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET en .env.local.</p>
          ) : (
            <CldUploadWidget
              uploadPreset={PRESET}
              options={{ sources: ["local", "url"], multiple: false, maxFiles: 1 }}
              onSuccess={async (result) => {
                const info = result?.info;
                if (!info || typeof info === "string") return;
                setBusy(true);
                try {
                  const reg = await registrarAsset({
                    publicId: info.public_id,
                    url: info.secure_url,
                    width: info.width,
                    height: info.height,
                    bytes: info.bytes,
                    format: info.format,
                    alt: alt ?? null,
                  });
                  onChange({ assetId: reg.id, url: reg.url });
                  toast("Imagen subida.", "success");
                } catch {
                  toast("No se pudo registrar la imagen.", "error");
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
                  {busy ? "Procesando…" : value.url ? "Cambiar imagen" : "Subir imagen"}
                </button>
              )}
            </CldUploadWidget>
          )}
          {value.url && (
            <button
              type="button"
              onClick={() => onChange({ assetId: null, url: null })}
              className="text-left text-xs text-fg-muted hover:text-error"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
