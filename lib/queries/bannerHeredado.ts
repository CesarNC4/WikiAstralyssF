import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { camposOcultos } from "@/lib/queries/visibilidad";

/** El grupo que presta su banner a un personaje. */
export type GrupoDelBanner = "organización" | "familia" | "gremio" | "nación";

export interface BannerHeredado {
  url: string;
  /** El nombre del grupo: «FRACTISIUS». */
  de: string;
  tipo: GrupoDelBanner;
}

const ENTIDAD: Record<GrupoDelBanner, string> = {
  organización: "organizaciones",
  familia: "familias",
  gremio: "gremio",
  nación: "naciones",
};

/** La nación de nacimiento: es la única que sale de un campo del personaje y no de una conexión. */
const NACIMIENTO = 6;

interface Candidato {
  prioridad: number;
  tipo: GrupoDelBanner;
  id: number;
  nombre: string;
  banner: string;
}

/**
 * El banner que toma un personaje que no tiene uno propio (decisión del autor, 2026-11-14): el de
 * su organización; si no, el de su familia; si no, el del gremio; y si no, el de su nación, primero
 * la del bloque «Naciones» y luego la de nacimiento. Entre dos del mismo tipo, la primera conexión
 * que se le puso. Sin ninguno, la ficha usa su imagen de perfil de fondo, como siempre.
 *
 * No se copia en el personaje: se busca al enseñar la ficha, así que cambiar el banner de un grupo
 * lo cambia en todos sus miembros. Se aplican siempre las reglas del público, también en el panel:
 * una pertenencia oculta no presta el banner (lo delataría), ni un grupo sin publicar, ni uno con el
 * banner oculto, ni la nación de nacimiento si ese dato está oculto.
 */
export async function bannerHeredado(personajeId: number): Promise<BannerHeredado | null> {
  const { organizaciones: o, orgJerarquia: oj, familias: f, familiaJerarquia: fj, familiaArbol: fa } = s;
  const { gremio: g, gremioJerarquia: gj, naciones: n, personajeNacion: pn, personajes: p } = s;
  const res = await db.execute(sql`
    select prioridad, tipo, id, nombre, banner from (
      select 1 as prioridad, ${oj.id} as orden, 'organización' as tipo, ${o.id} as id, ${o.nombre} as nombre, ${o.bannerUrl} as banner
        from ${oj} join ${o} on ${o.id} = ${oj.organizacionId}
       where ${oj.personajeId} = ${personajeId} and not ${oj.oculto}
         and ${o.estadoPublicacion} = 'publicado' and ${o.eliminadoEn} is null and btrim(${o.bannerUrl}) <> ''
      union all
      select 2, ${fj.id}, 'familia', ${f.id}, ${f.nombre}, ${f.bannerUrl}
        from ${fj} join ${f} on ${f.id} = ${fj.familiaId}
       where ${fj.personajeId} = ${personajeId} and not ${fj.oculto}
         and ${f.estadoPublicacion} = 'publicado' and ${f.eliminadoEn} is null and btrim(${f.bannerUrl}) <> ''
      union all
      select 3, ${fa.id}, 'familia', ${f.id}, ${f.nombre}, ${f.bannerUrl}
        from ${fa} join ${f} on ${f.id} = ${fa.familiaId}
       where ${fa.personajeId} = ${personajeId} and not ${fa.oculto}
         and ${f.estadoPublicacion} = 'publicado' and ${f.eliminadoEn} is null and btrim(${f.bannerUrl}) <> ''
      union all
      select 4, ${gj.id}, 'gremio', ${g.id}, ${g.nombre}, ${g.bannerUrl}
        from ${gj} join ${g} on ${g.id} = ${gj.gremioId}
       where ${gj.personajeId} = ${personajeId} and not ${gj.oculto} and btrim(${g.bannerUrl}) <> ''
      union all
      select 5, ${pn.id}, 'nación', ${n.id}, ${n.nombre}, ${n.bannerUrl}
        from ${pn} join ${n} on ${n.id} = ${pn.nacionId}
       where ${pn.personajeId} = ${personajeId} and not ${pn.oculto}
         and ${n.estadoPublicacion} = 'publicado' and ${n.eliminadoEn} is null and btrim(${n.bannerUrl}) <> ''
      union all
      select ${sql.raw(String(NACIMIENTO))}, 0, 'nación', ${n.id}, ${n.nombre}, ${n.bannerUrl}
        from ${p} join ${n} on ${n.id} = ${p.lugarNacimientoNacionId}
       where ${p.id} = ${personajeId}
         and ${n.estadoPublicacion} = 'publicado' and ${n.eliminadoEn} is null and btrim(${n.bannerUrl}) <> ''
    ) as candidatos
    order by prioridad, orden
  `);
  // postgres-js devuelve el array de filas directamente; otros drivers, `{ rows }`.
  const candidatos = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Candidato[];

  for (const c of candidatos) {
    if (Number(c.prioridad) === NACIMIENTO && (await camposOcultos("personajes", personajeId)).has("lugarNacimientoNacionId")) continue;
    if ((await camposOcultos(ENTIDAD[c.tipo], Number(c.id))).has("bannerUrl")) continue;
    return { url: c.banner, de: c.nombre, tipo: c.tipo };
  }
  return null;
}
