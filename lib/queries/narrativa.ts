import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { Extremo, Fecha } from "@/lib/fechas";
import { etiquetaActo, numerarCapitulos } from "@/lib/narrativa/numeracion";

/**
 * Lógica de servidor del modelo narrativo (spec del taller §3, §4 y §7):
 * numeración, orden de los actos y todo lo que un capítulo calcula a partir de
 * sus actos. Las escrituras van en `lib/actions/taller.ts`.
 */

/** Una transacción de Drizzle o el cliente, para poder llamar a esto desde ambos. */
export type Ejecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Valores de `capitulo_tipo` que no consumen número de capítulo. */
export async function tiposNoNumerados(ex: Ejecutor = db): Promise<Set<string>> {
  const filas = await ex
    .select({ valor: s.catalogos.valor })
    .from(s.catalogos)
    .where(and(eq(s.catalogos.campo, "capitulo_tipo"), sql`(${s.catalogos.meta}->>'numerado')::boolean = false`));
  return new Set(filas.map((f) => f.valor));
}

/**
 * Reescribe el rótulo de todos los capítulos vivos. Se llama tras cualquier
 * cambio que pueda moverlo: orden, tipo, libro, alta, baja o el catálogo de
 * tipos. Son pocas filas y solo escribe las que cambian.
 */
export async function renumerarCapitulos(ex: Ejecutor): Promise<void> {
  const [noNumerados, caps] = await Promise.all([
    tiposNoNumerados(ex),
    ex
      .select({ id: s.capitulos.id, libro: s.capitulos.libro, tipo: s.capitulos.tipo, orden: s.capitulos.orden, numero: s.capitulos.numero })
      .from(s.capitulos)
      .where(isNull(s.capitulos.eliminadoEn)),
  ]);
  const rotulos = numerarCapitulos(caps, noNumerados);
  for (const c of caps) {
    const nuevo = rotulos.get(c.id);
    if (nuevo && nuevo !== c.numero) await ex.update(s.capitulos).set({ numero: nuevo }).where(eq(s.capitulos.id, c.id));
  }
}

/** Deja el orden de los actos vivos de un capítulo como 0, 1, 2… sin huecos. */
export async function normalizarOrdenActos(ex: Ejecutor, capituloId: number): Promise<void> {
  const filas = await ex
    .select({ id: s.actos.id, orden: s.actos.numeroOrden })
    .from(s.actos)
    .where(and(eq(s.actos.capituloId, capituloId), isNull(s.actos.eliminadoEn)))
    .orderBy(asc(s.actos.numeroOrden), asc(s.actos.id));
  for (const [i, f] of filas.entries())
    if (f.orden !== i) await ex.update(s.actos).set({ numeroOrden: i }).where(eq(s.actos.id, f.id));
}

// ── Lo que el capítulo calcula de sus actos ────────────────────────────────

export interface ActoDelCapitulo {
  id: number;
  posicion: number;
  /** "Acto I", "Acto II"… */
  etiqueta: string;
  nombre: string;
  resumen: string | null;
  faseId: number | null;
  estadoPublicacion: string;
}

export interface PersonajeDelCapitulo {
  id: number;
  nombre: string;
  imagenUrl: string | null;
  /** Es POV en al menos uno de los actos. */
  pov: boolean;
}

export interface LugarDelCapitulo {
  tipo: "naciones" | "regiones" | "locaciones";
  id: number;
  nombre: string;
}

export interface CancionDelCapitulo {
  id: number;
  titulo: string;
  artista: string | null;
  /** Vinculada al capítulo entero, a alguno de sus actos, o a ambos. */
  desde: "capitulo" | "acto" | "ambos";
}

export interface CapituloDerivado {
  actos: ActoDelCapitulo[];
  personajes: PersonajeDelCapitulo[];
  lugares: LugarDelCapitulo[];
  canciones: CancionDelCapitulo[];
  /** Del inicio del primer acto con fecha al final del último (§3). */
  fecha: Fecha | null;
}

const LUGARES = { acto_nacion: "naciones", acto_region: "regiones", acto_locacion: "locaciones" } as const;

/**
 * Todo lo que un capítulo agrega de sus actos. Con `publico`, solo cuentan los
 * actos publicados y las fichas publicadas: lo que el lector puede ver. Sin él
 * (el taller), entra todo lo que no está en la papelera.
 */
export async function getCapituloDerivado(capituloId: number, { publico }: { publico: boolean }): Promise<CapituloDerivado> {
  const filasActos = await db
    .select({
      id: s.actos.id,
      nombre: s.actos.nombre,
      resumen: s.actos.descripcion,
      faseId: s.actos.faseId,
      estadoPublicacion: s.actos.estadoPublicacion,
    })
    .from(s.actos)
    .where(and(eq(s.actos.capituloId, capituloId), isNull(s.actos.eliminadoEn)))
    .orderBy(asc(s.actos.numeroOrden), asc(s.actos.id));

  // La posición (y con ella "Acto II") es la del capítulo completo: un acto en
  // borrador no hace que el siguiente cambie de número en la web.
  const todos: ActoDelCapitulo[] = filasActos.map((a, posicion) => ({ ...a, posicion, etiqueta: etiquetaActo(posicion) }));
  const actos = publico ? todos.filter((a) => a.estadoPublicacion === "publicado") : todos;
  const ids = actos.map((a) => a.id);

  const vacio: CapituloDerivado = { actos, personajes: [], lugares: [], canciones: [], fecha: null };
  const cancionesManual = await cancionesDelCapitulo(capituloId, publico);
  if (ids.length === 0) return { ...vacio, canciones: cancionesManual };

  const vinculos = await db
    .select({ origenId: s.vinculo.origenId, relacion: s.vinculo.relacion, destinoId: s.vinculo.destinoId })
    .from(s.vinculo)
    .where(and(eq(s.vinculo.origenTipo, "actos"), inArray(s.vinculo.origenId, ids)));

  const [personajes, lugares, canciones, fecha] = await Promise.all([
    personajesDe(vinculos, publico),
    lugaresDe(vinculos, publico),
    cancionesDe(vinculos, cancionesManual, publico),
    fechaDe(actos),
  ]);
  return { actos, personajes, lugares, canciones, fecha };
}

type FilaVinculo = { origenId: number; relacion: string | null; destinoId: number };

async function personajesDe(vinculos: FilaVinculo[], publico: boolean): Promise<PersonajeDelCapitulo[]> {
  const pov = new Set(vinculos.filter((v) => v.relacion === "acto_pov").map((v) => v.destinoId));
  const ids = [...new Set(vinculos.filter((v) => v.relacion === "acto_pov" || v.relacion === "acto_personaje").map((v) => v.destinoId))];
  if (ids.length === 0) return [];
  const filas = await db
    .select({ id: s.personajes.id, nombre: s.personajes.nombre, imagenUrl: s.personajes.imagenUrl, estado: s.personajes.estadoPublicacion })
    .from(s.personajes)
    .where(and(inArray(s.personajes.id, ids), isNull(s.personajes.eliminadoEn)));
  return filas
    .filter((p) => !publico || p.estado === "publicado")
    .map((p) => ({ id: p.id, nombre: p.nombre, imagenUrl: p.imagenUrl, pov: pov.has(p.id) }))
    // Los POV primero: son quienes cuentan el capítulo.
    .sort((a, b) => Number(b.pov) - Number(a.pov) || a.nombre.localeCompare(b.nombre));
}

async function lugaresDe(vinculos: FilaVinculo[], publico: boolean): Promise<LugarDelCapitulo[]> {
  const out: LugarDelCapitulo[] = [];
  const tablas = { naciones: s.naciones, regiones: s.regiones, locaciones: s.locaciones } as const;
  for (const [relacion, tipo] of Object.entries(LUGARES) as [keyof typeof LUGARES, LugarDelCapitulo["tipo"]][]) {
    const ids = [...new Set(vinculos.filter((v) => v.relacion === relacion).map((v) => v.destinoId))];
    if (ids.length === 0) continue;
    const t = tablas[tipo];
    const filas = await db
      .select({ id: t.id, nombre: t.nombre, estado: t.estadoPublicacion })
      .from(t)
      .where(and(inArray(t.id, ids), isNull(t.eliminadoEn)));
    for (const f of filas) if (!publico || f.estado === "publicado") out.push({ tipo, id: f.id, nombre: f.nombre });
  }
  return out;
}

async function cancionesDelCapitulo(capituloId: number, publico: boolean): Promise<CancionDelCapitulo[]> {
  const filas = await db
    .select({ id: s.canciones.id, titulo: s.canciones.titulo, artista: s.canciones.artista, estado: s.canciones.estadoPublicacion })
    .from(s.capituloCancion)
    .innerJoin(s.canciones, eq(s.capituloCancion.cancionId, s.canciones.id))
    .where(and(eq(s.capituloCancion.capituloId, capituloId), isNull(s.canciones.eliminadoEn)));
  return filas
    .filter((c) => !publico || c.estado === "publicado")
    .map((c) => ({ id: c.id, titulo: c.titulo, artista: c.artista, desde: "capitulo" as const }));
}

/** Manuales del capítulo + las de sus actos, sin repetir (§3). */
async function cancionesDe(vinculos: FilaVinculo[], manual: CancionDelCapitulo[], publico: boolean): Promise<CancionDelCapitulo[]> {
  const porId = new Map(manual.map((c) => [c.id, { ...c }]));
  const ids = [...new Set(vinculos.filter((v) => v.relacion === "acto_cancion").map((v) => v.destinoId))];
  if (ids.length) {
    const filas = await db
      .select({ id: s.canciones.id, titulo: s.canciones.titulo, artista: s.canciones.artista, estado: s.canciones.estadoPublicacion })
      .from(s.canciones)
      .where(and(inArray(s.canciones.id, ids), isNull(s.canciones.eliminadoEn)));
    for (const c of filas) {
      if (publico && c.estado !== "publicado") continue;
      const ya = porId.get(c.id);
      if (ya) ya.desde = "ambos";
      else porId.set(c.id, { id: c.id, titulo: c.titulo, artista: c.artista, desde: "acto" });
    }
  }
  return [...porId.values()];
}

/**
 * Rango de fechas del capítulo: del inicio del primer acto con fecha al final
 * del último (§3). Si los actos no van en orden cronológico (un flashback al
 * final) y eso diera un rango al revés, se usa el tramo que los cubre a todos.
 */
async function fechaDe(actos: ActoDelCapitulo[]): Promise<Fecha | null> {
  const filas = await db
    .select()
    .from(s.fechaLore)
    .where(and(eq(s.fechaLore.entidadTipo, "actos"), eq(s.fechaLore.rol, "principal"), inArray(s.fechaLore.entidadId, actos.map((a) => a.id))));
  if (filas.length === 0) return null;

  const pos = new Map(actos.map((a) => [a.id, a.posicion]));
  const enOrden = [...filas].sort((a, b) => pos.get(a.entidadId)! - pos.get(b.entidadId)!);
  let primero = enOrden[0];
  let ultimo = enOrden[enOrden.length - 1];
  if (ultimo.claveFin < primero.claveIni) {
    primero = filas.reduce((m, f) => (f.claveIni < m.claveIni ? f : m));
    ultimo = filas.reduce((m, f) => (f.claveFin > m.claveFin ? f : m));
  }

  const ini: Extremo = { anio: primero.iniAnio, segmentoId: primero.iniSegmentoId, dia: primero.iniDia };
  const fin: Extremo =
    ultimo.finAnio != null
      ? { anio: ultimo.finAnio, segmentoId: ultimo.finSegmentoId, dia: ultimo.finDia }
      : { anio: ultimo.iniAnio, segmentoId: ultimo.iniSegmentoId, dia: ultimo.iniDia };
  const mismo = ini.anio === fin.anio && ini.segmentoId === fin.segmentoId && ini.dia === fin.dia;
  return { ini, fin: mismo ? null : fin, aproximada: filas.some((f) => f.aproximada) };
}
