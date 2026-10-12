"use client";

import type { Suceso } from "@/lib/cronologia";
import type { Calendario } from "@/lib/fechas";
import { CalendarioAnual } from "./CalendarioAnual";
import { BarraFiltros, useFiltros } from "./Filtros";

/** Calendario por año de la cronología pública, con los mismos filtros que la línea temporal. */
export function CalendarioPublico({ sucesos, cal }: { sucesos: Suceso[]; cal: Calendario }) {
  const { f, setF, filtrados, ocultos } = useFiltros(sucesos);
  return (
    <div>
      <BarraFiltros sucesos={sucesos} f={f} setF={setF} mostrados={filtrados.length} ocultos={ocultos} />
      <CalendarioAnual sucesos={filtrados} cal={cal} />
    </div>
  );
}
