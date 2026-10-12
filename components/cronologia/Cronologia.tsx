"use client";

import { TimelineEspiral } from "@/components/viz/TimelineEspiral";
import type { Suceso } from "@/lib/cronologia";
import { BarraFiltros, useFiltros } from "./Filtros";

/** Línea temporal pública: filtros (§14) sobre el túnel del tiempo. */
export function Cronologia({ sucesos }: { sucesos: Suceso[] }) {
  const { f, setF, filtrados, ocultos, firma } = useFiltros(sucesos);
  return (
    <div>
      <BarraFiltros sucesos={sucesos} f={f} setF={setF} mostrados={filtrados.length} ocultos={ocultos} />
      {filtrados.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-muted">Ningún suceso coincide con estos filtros.</p>
      ) : (
        // El túnel guarda su propia cámara y su foco: se remonta al cambiar el filtro.
        <TimelineEspiral key={firma} eventos={filtrados} />
      )}
    </div>
  );
}
