import "server-only";
import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { rutaEnTaller } from "@/lib/admin/taller";
import type { RefSuceso, Suceso } from "@/lib/cronologia";
import {
  eraDeAnio,
  rolDe,
  rolesDe,
  textosFecha,
  tituloSuceso,
  type Calendario,
  type Extremo,
  type Fecha,
} from "@/lib/fechas";
import { infoDe } from "@/lib/relaciones/tablas";
import { aFechaGuardada, getCalendario, type FechaGuardada } from "./fechas";

/**
 * La cronología derivada (spec §14): los eventos creados a mano y todo lo que
 * tiene fecha en las fichas, en una sola lista ordenada por día absoluto.
 *
 * Sale de una consulta sobre `fecha_lore` y de una lectura por tipo de ficha
 * para los nombres y la visibilidad; los capítulos se añaden con el rango de
 * sus actos. Con `publico` solo entra lo publicado (y los actos de capítulos
 * publicados); sin él, todo lo que no está en la papelera, con enlaces al
 * editor en lugar de a la ficha.
 */

type Cols = Record<string, PgColumn>;

interface Ficha {
  nombre: string;
  /** La columna secundaria del registro: el rótulo del capítulo, el slug del lore. */
  detalle: string | null;
  href: string | null;
  imagenUrl: string | null;
  /** Columnas propias que usan los eventos y los actos. */
  extra: Record<string, unknown>;
}

function hrefAdmin(tipo: string, id: number): string {
  const enTaller = rutaEnTaller(tipo, { id });
  if (enTaller) return enTaller;
  if (tipo === "timeline") return `/admin/timeline/${id}/editar`;
  if (tipo === "gremio") return "/admin/gremio";
  return `/admin/${tipo}/${id}/editar`;
}

/** Columnas extra que hacen falta de cada tipo, además del nombre. */
const EXTRA: Record<string, string[]> = {
  timeline: ["descripcion", "categoria", "importancia", "capituloId", "actoId"],
  actos: ["descripcion", "capituloId"],
};

/** Nombre, enlace y visibilidad de varias fichas de un tipo, de una vez. */
async function cargarFichas(tipo: string, ids: number[], publico: boolean): Promise<Map<number, Ficha>> {
  const out = new Map<number, Ficha>();
  const info = infoDe(tipo);
  if (!info || ids.length === 0) return out;
  const c = getTableColumns(info.tabla) as unknown as Cols;
  const sel: Record<string, PgColumn | SQL> = { id: c.id, nombre: c[info.label] };
  if (info.detalle) sel.detalle = c[info.detalle];
  if (info.imagen) sel.imagen = c[info.imagen];
  if (info.rutaAnidada) sel.anidada = c[info.rutaAnidada.col];
  for (const col of EXTRA[tipo] ?? []) sel[col] = c[col];

  const filtros: SQL[] = [inArray(c.id, [...new Set(ids)])];
  if (info.papelera) filtros.push(isNull(c.eliminadoEn));
  if (publico && info.estado) filtros.push(info.estadoSql ? sql`${info.estadoSql} = 'publicado'` : eq(c.estadoPublicacion, "publicado"));

  const filas = (await db
    .select(sel as Record<string, PgColumn>)
    .from(info.tabla)
    .where(and(...filtros))) as unknown as Record<string, unknown>[];

  for (const f of filas) {
    const id = f.id as number;
    let href: string | null;
    if (!publico) href = hrefAdmin(tipo, id);
    else if (tipo === "lore") href = f.detalle ? `/lore/${f.detalle}` : null;
    else if (tipo === "gremio") href = "/gremio";
    else if (tipo === "timeline") href = null;
    else if (info.rutaAnidada) href = info.rutaAnidada.hacer(id, f.anidada);
    else href = info.ruta ? `${info.ruta}/${id}` : null;
    const extra: Record<string, unknown> = {};
    for (const col of EXTRA[tipo] ?? []) extra[col] = f[col];
    out.set(id, { nombre: (f.nombre as string) || `#${id}`, detalle: (f.detalle as string) ?? null, href, imagenUrl: (f.imagen as string) ?? null, extra });
  }
  return out;
}

const ref = (tipo: string, id: number, f: Ficha | undefined): RefSuceso | null =>
  f ? { tipo, id, nombre: f.nombre, href: f.href, imagenUrl: f.imagenUrl } : null;

function base(cal: Calendario, fecha: Fecha, claveIni: number, claveFin: number) {
  const era = eraDeAnio(cal, fecha.ini.anio);
  return {
    fecha,
    textos: textosFecha(cal, fecha),
    cortos: textosFecha(cal, fecha, true),
    claveIni,
    claveFin,
    era: era ? { id: era.id, nombre: era.nombre } : null,
  };
}

export async function getSucesos({ publico }: { publico: boolean }): Promise<{ sucesos: Suceso[]; cal: Calendario }> {
  const [cal, filas] = await Promise.all([getCalendario(), db.select().from(s.fechaLore)]);
  const fechas = filas.map((f) => ({ tipo: f.entidadTipo, ...aFechaGuardada(f) }));

  // Ids por tipo de ficha, más los capítulos de los actos y de los eventos.
  const ids = new Map<string, number[]>();
  for (const f of fechas) (ids.get(f.tipo) ?? ids.set(f.tipo, []).get(f.tipo)!).push(f.entidadId);
  // Secuencial a propósito: el pool es pequeño (ver db/client.ts) y son pocas consultas.
  const fichas = new Map<string, Map<number, Ficha>>();
  for (const [tipo, lista] of ids) {
    if (rolesDe(tipo).length === 0) continue;
    fichas.set(tipo, await cargarFichas(tipo, lista, publico));
  }

  const eventos = fichas.get("timeline") ?? new Map<number, Ficha>();
  const actos = fichas.get("actos") ?? new Map<number, Ficha>();
  const evIds = [...eventos.keys()];

  const capIds = new Set<number>();
  for (const a of actos.values()) if (a.extra.capituloId != null) capIds.add(a.extra.capituloId as number);
  for (const e of eventos.values()) if (e.extra.capituloId != null) capIds.add(e.extra.capituloId as number);
  const actoIdsDeEventos = [...eventos.values()].map((e) => e.extra.actoId).filter((x): x is number => x != null && !actos.has(x as number));

  const capitulos = await cargarFichas("capitulos", [...capIds], publico);
  const actosExtra = await cargarFichas("actos", actoIdsDeEventos, publico);
  const actoDe = (id: number) => actos.get(id) ?? actosExtra.get(id);

  // Protagonistas y lugar de cada evento.
  const pjs = evIds.length
    ? await db
        .select({ eventoId: s.personajeEvento.timelineEventoId, personajeId: s.personajeEvento.personajeId })
        .from(s.personajeEvento)
        .where(inArray(s.personajeEvento.timelineEventoId, evIds))
        .orderBy(asc(s.personajeEvento.orden))
    : [];
  const personajes = await cargarFichas("personajes", [...new Set(pjs.map((p) => p.personajeId).filter((x): x is number => x != null))], publico);
  const locs = evIds.length
    ? await db
        .select({ id: s.locaciones.id, eventoId: s.locaciones.eventoId })
        .from(s.locaciones)
        .where(inArray(s.locaciones.eventoId, evIds))
    : [];
  const locaciones = await cargarFichas("locaciones", locs.map((l) => l.id), publico);

  const pjsDe = new Map<number, RefSuceso[]>();
  for (const p of pjs) {
    const r = p.personajeId != null ? ref("personajes", p.personajeId, personajes.get(p.personajeId)) : null;
    if (r && p.eventoId != null) (pjsDe.get(p.eventoId) ?? pjsDe.set(p.eventoId, []).get(p.eventoId)!).push(r);
  }
  const locDe = new Map<number, RefSuceso>();
  for (const l of locs) {
    const r = ref("locaciones", l.id, locaciones.get(l.id));
    if (r && l.eventoId != null && !locDe.has(l.eventoId)) locDe.set(l.eventoId, r);
  }
  const capRef = (id: unknown) => (id == null ? null : ref("capitulos", id as number, capitulos.get(id as number)));
  const actoRef = (id: unknown) => (id == null ? null : ref("actos", id as number, actoDe(id as number)));

  const sucesos: Suceso[] = [];
  const actosPorCapitulo = new Map<number, (FechaGuardada & { tipo: string })[]>();

  for (const f of fechas) {
    const def = rolDe(f.tipo, f.rol);
    const ficha = fichas.get(f.tipo)?.get(f.entidadId);
    if (!def || !ficha) continue;
    const comun = base(cal, f.fecha, f.claveIni, f.claveFin);

    if (f.tipo === "timeline") {
      const x = ficha.extra;
      sucesos.push({
        clave: `timeline:${f.entidadId}:${f.rol}`,
        tipo: "evento",
        rol: f.rol,
        titulo: ficha.nombre,
        descripcion: (x.descripcion as string) ?? null,
        ...comun,
        importante: f.importante,
        categoria: (x.categoria as string) ?? null,
        importancia: (x.importancia as string) ?? null,
        entidad: publico ? null : ref("timeline", f.entidadId, ficha),
        capitulo: capRef(x.capituloId),
        acto: actoRef(x.actoId),
        locacion: locDe.get(f.entidadId) ?? null,
        personajes: pjsDe.get(f.entidadId) ?? [],
      });
      continue;
    }

    // Un acto solo cuenta si su capítulo también se ve.
    const capitulo = f.tipo === "actos" ? capRef(ficha.extra.capituloId) : null;
    if (f.tipo === "actos") {
      if (!capitulo) continue;
      const cid = ficha.extra.capituloId as number;
      (actosPorCapitulo.get(cid) ?? actosPorCapitulo.set(cid, []).get(cid)!).push(f);
    }

    sucesos.push({
      clave: `${f.tipo}:${f.entidadId}:${f.rol}`,
      tipo: def.tipo,
      rol: f.rol,
      titulo: tituloSuceso(def, ficha.nombre),
      descripcion: f.tipo === "actos" ? ((ficha.extra.descripcion as string) ?? null) : null,
      ...comun,
      importante: f.importante,
      categoria: null,
      importancia: null,
      entidad: ref(f.tipo, f.entidadId, ficha),
      capitulo,
      acto: null,
      locacion: null,
      personajes: [],
    });
  }

  // Capítulos: del primer día de su primer acto al último de su último acto (§3).
  for (const [cid, lista] of actosPorCapitulo) {
    const cap = capitulos.get(cid);
    if (!cap) continue;
    const primero = lista.reduce((a, b) => (b.claveIni < a.claveIni ? b : a));
    const ultimo = lista.reduce((a, b) => (b.claveFin > a.claveFin ? b : a));
    const fin: Extremo = ultimo.fecha.fin ?? ultimo.fecha.ini;
    const fecha: Fecha = {
      ini: primero.fecha.ini,
      fin: primero === ultimo && !ultimo.fecha.fin ? null : fin,
      aproximada: lista.some((a) => a.fecha.aproximada),
    };
    sucesos.push({
      clave: `capitulos:${cid}`,
      tipo: "narrativa",
      rol: "principal",
      titulo: cap.detalle ? `${cap.detalle} — ${cap.nombre}` : cap.nombre,
      descripcion: null,
      ...base(cal, fecha, primero.claveIni, ultimo.claveFin),
      importante: lista.some((a) => a.importante),
      categoria: null,
      importancia: null,
      entidad: ref("capitulos", cid, cap),
      capitulo: null,
      acto: null,
      locacion: null,
      personajes: [],
    });
  }

  // Mismo día: primero lo que dura más (un capítulo antes que sus actos).
  sucesos.sort((a, b) => a.claveIni - b.claveIni || b.claveFin - a.claveFin || a.titulo.localeCompare(b.titulo));
  return { sucesos, cal };
}
