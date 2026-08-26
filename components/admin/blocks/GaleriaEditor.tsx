"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { registrarAsset } from "@/lib/actions/media";
import { listarGaleria, anadirGaleriaImagen, quitarGaleriaImagen, reordenarGaleria } from "@/lib/actions/galeria";
import type { GaleriaItem } from "@/lib/queries/galeria";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { cldOptimize } from "@/lib/utils";
import { carpetaDe, RUTA_FIRMA } from "@/lib/media/carpetas";

const CldUploadWidget = dynamic(() => import("next-cloudinary").then((m) => m.CldUploadWidget), { ssr: false });
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * Bloque de galería para los formularios del admin. Gestiona entidad_media de
 * una entidad concreta: subir (Cloudinary→media_assets), ordenar y borrar.
 * Se guarda al momento vía Server Actions (independiente del submit del form).
 */
export function GaleriaEditor({
  entidadTipo,
  entidadId,
  revalidar,
  alt,
}: {
  entidadTipo: string;
  entidadId: number;
  revalidar?: string;
  alt?: string | null;
}) {
  const toast = useToast();
  const [items, setItems] = useState<GaleriaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let activo = true;
    listarGaleria(entidadTipo, entidadId)
      .then((r) => activo && setItems(r))
      .catch(() => {});
    return () => { activo = false; };
  }, [entidadTipo, entidadId]);

  const reordenar = (ids: number[]) =>
    startTransition(async () => {
      try {
        setItems(await reordenarGaleria({ ids, entidadTipo, entidadId, revalidar }));
      } catch {
        toast("No se pudo reordenar.", "error");
      }
    });

  const mover = (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next); // optimista
    reordenar(next.map((i) => i.id));
  };

  const eliminar = (id: number) =>
    startTransition(async () => {
      try {
        setItems(await quitarGaleriaImagen({ id, entidadTipo, entidadId, revalidar }));
        toast("Imagen quitada de la galería.", "success");
      } catch {
        toast("No se pudo quitar la imagen.", "error");
      }
    });

  return (
    <AccordionSection title={`Galería${items.length ? ` (${items.length})` : ""}`}>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((img, i) => (
          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border-base bg-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cldOptimize(img.url) ?? img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-void/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex gap-1">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="grid h-6 w-6 place-items-center rounded bg-deep/80 text-xs text-fg disabled:opacity-30">←</button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === items.length - 1} className="grid h-6 w-6 place-items-center rounded bg-deep/80 text-xs text-fg disabled:opacity-30">→</button>
              </div>
              <button type="button" onClick={() => eliminar(img.id)} className="grid h-6 w-6 place-items-center rounded bg-deep/80 text-xs text-fg hover:text-error" aria-label="Quitar">✕</button>
            </div>
          </div>
        ))}

        {/* Botón de subida */}
        {PRESET ? (
          <CldUploadWidget
            uploadPreset={PRESET}
            signatureEndpoint={RUTA_FIRMA}
            options={{ folder: carpetaDe(entidadTipo, "galeria"), sources: ["local", "url"], multiple: true }}
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
                setItems(await anadirGaleriaImagen({ entidadTipo, entidadId, assetId: reg.id, revalidar }));
                toast("Imagen añadida a la galería.", "success");
              } catch {
                toast("No se pudo añadir la imagen.", "error");
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
                className="grid aspect-square place-items-center rounded-xl border border-dashed border-border-glow text-2xl text-fg-muted hover:text-fg disabled:opacity-50"
              >
                {busy ? "…" : "+"}
              </button>
            )}
          </CldUploadWidget>
        ) : (
          <p className="col-span-full text-xs text-error">Falta NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.</p>
        )}
      </div>
      <p className="mt-2 text-xs text-fg-muted">La galería se guarda al instante (no depende del botón Guardar).</p>
    </AccordionSection>
  );
}
