import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/**
 * Candidatos del comparador de alturas (spec §12): personajes, bestias y lords
 * demonio publicados con alguna medida. Lo que la ficha oculta al público
 * (`campo_visibilidad`) no entra: una altura oculta es como no tenerla.
 */

export interface FiguraComparador {
  /** "personajes:4" */
  id: string;
  tipo: "personajes" | "bestias" | "demonios";
  nombre: string;
  href: string;
  altura: number | null;
  longitud: number | null;
  /** Id de `lib/alturas/siluetas.ts`; la humana en los personajes. */
  silueta: string;
  razas: number[];
  naciones: number[];
  organizaciones: number[];
}

/** Campos ocultos al público, por "tipo:id", para varias fichas de una vez. */
async function ocultos(tipo: string, ids: number[]): Promise<Map<number, Set<string>>> {
  const m = new Map<number, Set<string>>();
  if (ids.length === 0) return m;
  const filas = await db
    .select({ id: s.campoVisibilidad.entidadId, campo: s.campoVisibilidad.campo })
    .from(s.campoVisibilidad)
    .where(
      and(
        eq(s.campoVisibilidad.entidadTipo, tipo),
        inArray(s.campoVisibilidad.entidadId, ids),
        inArray(s.campoVisibilidad.campo, ["altura", "longitud"]),
        eq(s.campoVisibilidad.visible, false),
      ),
    );
  for (const f of filas) (m.get(f.id) ?? m.set(f.id, new Set()).get(f.id)!).add(f.campo);
  return m;
}

const medida = (v: number | null, oculto: boolean) => (oculto || v == null || !(v > 0) ? null : v);

export async function getComparador() {
  const publicado = (t: { estadoPublicacion: PgColumn; eliminadoEn: PgColumn }) => and(eq(t.estadoPublicacion, "publicado"), isNull(t.eliminadoEn));

  const [pjs, bestias, demonios, razas, naciones, orgs] = await Promise.all([
    db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre, surname: s.personajes.surname, altura: s.personajes.altura })
      .from(s.personajes)
      .where(publicado(s.personajes)),
    db
      .select({ id: s.bestias.id, nombre: s.bestias.nombre, altura: s.bestias.altura, longitud: s.bestias.longitud, silueta: s.bestias.silueta })
      .from(s.bestias)
      .where(publicado(s.bestias)),
    db
      .select({ id: s.lordDemonio.id, nombre: s.lordDemonio.nombre, altura: s.lordDemonio.altura, longitud: s.lordDemonio.longitud, silueta: s.lordDemonio.silueta })
      .from(s.lordDemonio)
      .where(publicado(s.lordDemonio)),
    db.select({ id: s.razas.id, nombre: s.razas.nombre }).from(s.razas).where(publicado(s.razas)).orderBy(asc(s.razas.nombre)),
    db.select({ id: s.naciones.id, nombre: s.naciones.nombre }).from(s.naciones).where(publicado(s.naciones)).orderBy(asc(s.naciones.nombre)),
    db
      .select({ id: s.organizaciones.id, nombre: s.organizaciones.nombre })
      .from(s.organizaciones)
      .where(publicado(s.organizaciones))
      .orderBy(asc(s.organizaciones.nombre)),
  ]);

  const conMedida = <T extends { altura: number | null; longitud?: number | null }>(xs: T[]) =>
    xs.filter((x) => (x.altura ?? 0) > 0 || (x.longitud ?? 0) > 0);
  const p = pjs.filter((x) => (x.altura ?? 0) > 0);
  const b = conMedida(bestias);
  const d = conMedida(demonios);

  const [ocP, ocB, ocD, pr, pn, po, bn] = await Promise.all([
    ocultos("personajes", p.map((x) => x.id)),
    ocultos("bestias", b.map((x) => x.id)),
    ocultos("demonios", d.map((x) => x.id)),
    p.length ? db.select({ a: s.personajeRaza.personajeId, x: s.personajeRaza.razaId }).from(s.personajeRaza).where(inArray(s.personajeRaza.personajeId, p.map((x) => x.id))) : [],
    p.length ? db.select({ a: s.personajeNacion.personajeId, x: s.personajeNacion.nacionId }).from(s.personajeNacion).where(inArray(s.personajeNacion.personajeId, p.map((x) => x.id))) : [],
    p.length ? db.select({ a: s.orgJerarquia.personajeId, x: s.orgJerarquia.organizacionId }).from(s.orgJerarquia).where(inArray(s.orgJerarquia.personajeId, p.map((x) => x.id))) : [],
    b.length ? db.select({ a: s.bestiaNacion.bestiaId, x: s.bestiaNacion.nacionId }).from(s.bestiaNacion).where(inArray(s.bestiaNacion.bestiaId, b.map((x) => x.id))) : [],
  ]);
  const agrupar = (filas: { a: number | null; x: number }[]) => {
    const m = new Map<number, number[]>();
    for (const f of filas) if (f.a != null) (m.get(f.a) ?? m.set(f.a, []).get(f.a)!).push(f.x);
    return m;
  };
  const [mr, mn, mo, mbn] = [agrupar(pr), agrupar(pn), agrupar(po), agrupar(bn)];

  const figuras: FiguraComparador[] = [
    ...p.map((x) => ({
      id: `personajes:${x.id}`,
      tipo: "personajes" as const,
      nombre: [x.nombre, x.surname].filter(Boolean).join(" "),
      href: `/personajes/${x.id}`,
      altura: medida(x.altura, ocP.get(x.id)?.has("altura") ?? false),
      longitud: null,
      silueta: "humana",
      razas: mr.get(x.id) ?? [],
      naciones: mn.get(x.id) ?? [],
      organizaciones: [...new Set(mo.get(x.id) ?? [])],
    })),
    ...b.map((x) => ({
      id: `bestias:${x.id}`,
      tipo: "bestias" as const,
      nombre: x.nombre,
      href: `/bestias/${x.id}`,
      altura: medida(x.altura, ocB.get(x.id)?.has("altura") ?? false),
      longitud: medida(x.longitud, ocB.get(x.id)?.has("longitud") ?? false),
      silueta: x.silueta ?? "cuadrupedo",
      razas: [],
      naciones: mbn.get(x.id) ?? [],
      organizaciones: [],
    })),
    ...d.map((x) => ({
      id: `demonios:${x.id}`,
      tipo: "demonios" as const,
      nombre: x.nombre,
      href: `/demonios/${x.id}`,
      altura: medida(x.altura, ocD.get(x.id)?.has("altura") ?? false),
      longitud: medida(x.longitud, ocD.get(x.id)?.has("longitud") ?? false),
      silueta: x.silueta ?? "humanoide",
      razas: [],
      naciones: [],
      organizaciones: [],
    })),
  ]
    .filter((f) => f.altura != null || f.longitud != null)
    .sort((x, y) => x.nombre.localeCompare(y.nombre));

  return { figuras, razas, naciones, organizaciones: orgs };
}
