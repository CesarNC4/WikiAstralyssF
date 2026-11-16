"use client";

import { useRef, useState } from "react";
import type { IdsNuevos, SubfilasConocidas } from "@/lib/admin/complejas";

type ConId = { key: string; id?: number };
interface Listas<R extends ConId = ConId, F extends ConId = ConId, J extends ConId = ConId> {
  rangos: R[];
  facciones: F[];
  jerarquia: J[];
}

const idsDe = (filas: ConId[]) => filas.flatMap((f) => (f.id != null ? [f.id] : []));
const conocidasDe = (l: Listas): SubfilasConocidas => ({
  rangos: idsDe(l.rangos),
  facciones: idsDe(l.facciones),
  jerarquia: idsDe(l.jerarquia),
});

/**
 * Lo que el formulario de un grupo (organización, familia, gremio) sabe que hay en la
 * base. Al guardar solo se borra eso (`lib/admin/guardarGrupo.ts`), así que un miembro
 * añadido desde otra ficha con el formulario abierto no se pierde.
 *
 * `preparar` da las listas para el payload, con lo conocido y con el id de las filas que
 * ya se guardaron una vez; `alGuardar` recibe esos ids.
 */
export function useGrupoConocido(inicial: Listas) {
  const [alAbrir] = useState(() => conocidasDe(inicial));
  const conocidas = useRef<SubfilasConocidas | null>(null);
  const enviadas = useRef<SubfilasConocidas | null>(null);
  const guardadas = useRef<IdsNuevos>({ rangos: {}, facciones: {}, jerarquia: {} });
  return {
    preparar<R extends ConId, F extends ConId, J extends ConId>(l: Listas<R, F, J>) {
      const g = guardadas.current;
      const conId = <T extends ConId>(filas: T[], ids: Record<string, number>) =>
        filas.map((f) => (f.id == null && ids[f.key] != null ? { ...f, id: ids[f.key] } : f));
      const listas = {
        rangos: conId(l.rangos, g.rangos),
        facciones: conId(l.facciones, g.facciones),
        jerarquia: conId(l.jerarquia, g.jerarquia),
      };
      enviadas.current = conocidasDe(listas);
      return { ...listas, conocidos: conocidas.current ?? alAbrir };
    },
    alGuardar(nuevos: IdsNuevos) {
      const e = enviadas.current;
      if (!e) return;
      const g = guardadas.current;
      Object.assign(g.rangos, nuevos.rangos);
      Object.assign(g.facciones, nuevos.facciones);
      Object.assign(g.jerarquia, nuevos.jerarquia);
      conocidas.current = {
        rangos: [...e.rangos, ...Object.values(nuevos.rangos)],
        facciones: [...e.facciones, ...Object.values(nuevos.facciones)],
        jerarquia: [...e.jerarquia, ...Object.values(nuevos.jerarquia)],
      };
    },
  };
}
