"use client";

import { useEffect, useMemo, useState } from "react";
import { listarImagenesSubidas, type ImagenSubida } from "@/lib/actions/media";

/** Más ancha que alta de verdad: lo que sirve de banner. */
const esApaisada = (i: ImagenSubida) => (i.ancho && i.alto ? i.ancho / i.alto >= 1.4 : false);

/** Miniatura ligera de Cloudinary: la ventana no descarga los originales. */
function miniatura(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (/\/upload\/(f_|q_|c_|w_|h_)/.test(url)) return url;
  return url.replace("/upload/", "/upload/c_limit,w_360,f_auto,q_auto/");
}

/**
 * Ventana para elegir una imagen ya subida en vez de subir otra copia (el mismo
 * banner en varios personajes, por ejemplo). La ficha pasa a usar el mismo
 * archivo de Cloudinary; la purga no lo borra mientras alguna lo use.
 */
export function ElegirImagen({
  actual,
  banner,
  onElegir,
  onCerrar,
}: {
  /** La que tiene ahora el campo, para marcarla. */
  actual: number | null;
  /** Si el campo es un banner, empieza mostrando solo las apaisadas. */
  banner: boolean;
  onElegir: (img: ImagenSubida) => void;
  onCerrar: () => void;
}) {
  const [imagenes, setImagenes] = useState<ImagenSubida[] | null>(null);
  const [error, setError] = useState(false);
  const [soloApaisadas, setSoloApaisadas] = useState(banner);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let activo = true;
    listarImagenesSubidas()
      .then((r) => activo && setImagenes(r))
      .catch(() => activo && setError(true));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const vistas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (imagenes ?? []).filter(
      (i) => (!soloApaisadas || esApaisada(i)) && (!q || i.usos.some((u) => u.toLowerCase().includes(q))),
    );
  }, [imagenes, soloApaisadas, busca]);

  const filtro = (activo: boolean) =>
    `rounded-lg px-3 py-1 text-xs ${activo ? "bg-primary/20 text-fg" : "text-fg-muted hover:text-fg"}`;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-void/60 p-4 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir una imagen ya subida"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-glow bg-deep"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-border-base p-4">
          <h2 className="mr-auto font-display text-lg text-fg">Elegir una imagen ya subida</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-fg-muted hover:text-fg">
            ✕
          </button>
          <div className="flex w-full flex-wrap items-center gap-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por ficha…"
              className="min-w-0 flex-1 rounded-lg border border-border-base bg-surface px-3 py-1.5 text-sm text-fg outline-none focus:border-border-glow"
            />
            <div className="flex rounded-lg border border-border-base p-0.5">
              <button type="button" className={filtro(soloApaisadas)} onClick={() => setSoloApaisadas(true)}>
                Apaisadas
              </button>
              <button type="button" className={filtro(!soloApaisadas)} onClick={() => setSoloApaisadas(false)}>
                Todas
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          {error ? (
            <p className="text-sm text-error">No se pudieron cargar las imágenes.</p>
          ) : imagenes === null ? (
            <p className="text-sm text-fg-muted">Cargando…</p>
          ) : vistas.length === 0 ? (
            <p className="text-sm text-fg-muted">
              {imagenes.length === 0 ? "Aún no hay imágenes subidas." : "Ninguna con ese filtro."}
            </p>
          ) : (
            <ul className={`grid gap-3 ${soloApaisadas ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
              {vistas.map((img) => {
                const esActual = img.id === actual;
                return (
                  <li key={img.id}>
                    <button
                      type="button"
                      onClick={() => onElegir(img)}
                      className={`group block w-full overflow-hidden rounded-xl border text-left transition-colors ${
                        esActual ? "border-primary" : "border-border-base hover:border-border-glow"
                      }`}
                    >
                      <div className={`bg-void ${soloApaisadas ? "aspect-video" : "aspect-square"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={miniatura(img.url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-0.5 p-2 text-xs">
                        {esActual && <p className="font-medium text-primary">La que tiene ahora</p>}
                        <p className="line-clamp-2 text-fg-secondary group-hover:text-fg" title={img.usos.join(" · ")}>
                          {img.usos.join(" · ")}
                        </p>
                        {img.ancho && img.alto && (
                          <p className="text-fg-muted">
                            {img.ancho}×{img.alto}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
