"use client";

import { BloqueVinculos } from "@/components/admin/vinculos/BloqueVinculos";
import { bloqueDe } from "@/lib/relaciones/registro";

/** Canciones del capítulo entero (un opening, por ejemplo); las de sus actos se suman solas (§3). */
export function CancionesManuales({ capituloId }: { capituloId: number }) {
  const b = bloqueDe("capitulos", "capitulo_cancion", "a");
  return b ? <BloqueVinculos bloque={b} ownerId={capituloId} abiertoInicial /> : null;
}
