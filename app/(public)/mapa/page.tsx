import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { getNacionesMapa } from "@/lib/queries/extra";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Mapa",
  description: "El mundo de Astralys, región a región.",
};

export default async function MapaPage() {
  const naciones = await getNacionesMapa().catch(() => []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
          <Icon name="Map" className="text-accent" size={22} />
        </span>
        <div>
          <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Mapa de Astralys</h1>
          <p className="text-sm text-fg-muted">Explora las naciones del mundo.</p>
        </div>
      </header>

      {/* Lienzo cósmico con las regiones. Leaflet (CRS.Simple) es la mejora prevista (§10.1). */}
      <div className="relative overflow-hidden rounded-3xl border border-border-glow bg-gradient-to-br from-deep via-surface to-void p-6 md:p-10">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,rgba(123,92,255,.4),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(45,212,191,.3),transparent_40%)]" />
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {naciones.map((n) => (
            <Link
              key={n.id}
              href={`/naciones/${n.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-border-base bg-void/50 p-4 backdrop-blur transition-all hover:-translate-y-1 hover:border-accent"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <EntityImage src={n.imagenUrl} alt={n.nombre} name={n.nombre} sizes="56px" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-lg text-fg group-hover:text-accent">{n.nombre}</p>
                {n.elemento && <p className="text-xs text-secondary">{n.elemento}</p>}
                {n.subtitulo && <p className="truncate text-xs text-fg-muted">{n.subtitulo}</p>}
              </div>
            </Link>
          ))}
        </div>
        {naciones.length === 0 && (
          <p className="relative text-center text-fg-muted">El mapa aún no tiene regiones registradas.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-fg-muted">
        * Mapa interactivo con Leaflet (imagen custom + regiones poligonales) previsto en la arquitectura (§10.1).
      </p>
    </div>
  );
}
