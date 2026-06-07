import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { MapaMundiClient } from "@/components/viz/MapaMundiClient";
import { getMapaPublico } from "@/lib/queries/mapa";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Mapa",
  description: "El mundo de Astralys: naciones, regiones y locaciones.",
};

export default async function MapaPage() {
  const data = await getMapaPublico().catch(() => ({ naciones: [], regiones: [], locaciones: [] }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-border-glow bg-surface">
          <Icon name="Map" className="text-accent" size={22} />
        </span>
        <div>
          <h1 className="font-display text-3xl text-gradient-cosmic md:text-4xl">Mapa de Astralys</h1>
          <p className="text-sm text-fg-muted">Explora naciones, regiones y locaciones. Pulsa cualquier punto para abrir su ficha.</p>
        </div>
      </header>

      <MapaMundiClient data={data} />
    </div>
  );
}
