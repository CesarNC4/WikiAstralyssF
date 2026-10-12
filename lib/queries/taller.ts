import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { Fecha } from "@/lib/fechas";
import { etiquetaActo } from "@/lib/narrativa/numeracion";
import { leerFecha, textosDeFechas } from "@/lib/queries/fechas";

/**
 * Lecturas del taller del autor. Todo es material de autor: incluye borradores
 * y ocultos, nunca la papelera. Las lecturas públicas van por `fichas.ts`.
 */

export interface FaseTaller {
  id: number;
  plantillaId: number;
  orden: number;
  nombre: string;
  abreviatura: string | null;
  color: string | null;
  guia: string | null;
}

export interface PlantillaTaller {
  id: number;
  nombre: string;
  descripcion: string | null;
  predeterminada: boolean;
  fases: FaseTaller[];
  /** Capítulos que la usan (fuera de la papelera). */
  usos: number;
}

export interface CapituloTaller {
  id: number;
  numero: string;
  titulo: string;
  libro: string | null;
  orden: number;
  tipo: string | null;
  plantillaId: number | null;
  estadoPublicacion: string;
}

export interface ActoTaller {
  id: number;
  capituloId: number | null;
  posicion: number;
  etiqueta: string;
  nombre: string;
  faseId: number | null;
  estado: string | null;
  estadoPublicacion: string;
  pov: { id: number; nombre: string }[];
  /** Ids de los personajes que aparecen (POV incluidos), para filtrar. */
  personajes: number[];
}

export interface TallerIndice {
  /** Libros en el orden del catálogo; "" agrupa los capítulos sin libro. */
  libros: string[];
  capitulos: CapituloTaller[];
  actos: ActoTaller[];
  plantillas: PlantillaTaller[];
  /** Personajes que aparecen en algún acto, para los filtros. */
  personajes: { id: number; nombre: string }[];
}

export async function getPlantillas(): Promise<PlantillaTaller[]> {
  const [plantillas, fases, usos] = await Promise.all([
    db.select().from(s.estructuraPlantilla).orderBy(asc(s.estructuraPlantilla.orden), asc(s.estructuraPlantilla.id)),
    db.select().from(s.estructuraFase).orderBy(asc(s.estructuraFase.orden), asc(s.estructuraFase.id)),
    db
      .select({ plantillaId: s.capitulos.plantillaId })
      .from(s.capitulos)
      .where(and(isNull(s.capitulos.eliminadoEn), isNotNull(s.capitulos.plantillaId))),
  ]);
  return plantillas.map((p) => ({
    ...p,
    fases: fases.filter((f) => f.plantillaId === p.id),
    usos: usos.filter((u) => u.plantillaId === p.id).length,
  }));
}

export async function getTallerIndice(): Promise<TallerIndice> {
  const [libroCat, capitulos, actosRaw, plantillas] = await Promise.all([
    db
      .select({ valor: s.catalogos.valor })
      .from(s.catalogos)
      .where(eq(s.catalogos.campo, "libro"))
      .orderBy(asc(s.catalogos.orden), asc(s.catalogos.valor)),
    db
      .select({
        id: s.capitulos.id,
        numero: s.capitulos.numero,
        titulo: s.capitulos.titulo,
        libro: s.capitulos.libro,
        orden: s.capitulos.orden,
        tipo: s.capitulos.tipo,
        plantillaId: s.capitulos.plantillaId,
        estadoPublicacion: s.capitulos.estadoPublicacion,
      })
      .from(s.capitulos)
      .where(isNull(s.capitulos.eliminadoEn))
      .orderBy(asc(s.capitulos.orden), asc(s.capitulos.id)),
    db
      .select({
        id: s.actos.id,
        capituloId: s.actos.capituloId,
        nombre: s.actos.nombre,
        faseId: s.actos.faseId,
        estado: s.actos.estado,
        estadoPublicacion: s.actos.estadoPublicacion,
      })
      .from(s.actos)
      .where(isNull(s.actos.eliminadoEn))
      .orderBy(asc(s.actos.numeroOrden), asc(s.actos.id)),
    getPlantillas(),
  ]);

  // Libros: los del catálogo en su orden, más los que use algún capítulo sin
  // estar en él, y al final el grupo sin libro si hace falta.
  const libros = libroCat.map((l) => l.valor);
  for (const c of capitulos) if (c.libro && !libros.includes(c.libro)) libros.push(c.libro);
  if (capitulos.some((c) => !c.libro)) libros.push("");

  const ids = actosRaw.map((a) => a.id);
  const vinculos = ids.length
    ? await db
        .select({ actoId: s.vinculo.origenId, relacion: s.vinculo.relacion, personajeId: s.vinculo.destinoId, nombre: s.personajes.nombre })
        .from(s.vinculo)
        .innerJoin(s.personajes, eq(s.vinculo.destinoId, s.personajes.id))
        .where(
          and(
            eq(s.vinculo.origenTipo, "actos"),
            inArray(s.vinculo.origenId, ids),
            inArray(s.vinculo.relacion, ["acto_pov", "acto_personaje"]),
            isNull(s.personajes.eliminadoEn),
          ),
        )
    : [];

  const posicion = new Map<number | null, number>();
  const actos: ActoTaller[] = actosRaw.map((a) => {
    const i = posicion.get(a.capituloId) ?? 0;
    posicion.set(a.capituloId, i + 1);
    const propios = vinculos.filter((v) => v.actoId === a.id);
    return {
      ...a,
      posicion: i,
      etiqueta: etiquetaActo(i),
      pov: propios.filter((v) => v.relacion === "acto_pov").map((v) => ({ id: v.personajeId, nombre: v.nombre })),
      personajes: [...new Set(propios.map((v) => v.personajeId))],
    };
  });

  const personajes = new Map<number, string>();
  for (const v of vinculos) personajes.set(v.personajeId, v.nombre);

  return {
    libros,
    capitulos,
    actos,
    plantillas,
    personajes: [...personajes].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}

// ── Editor del acto ────────────────────────────────────────────────────────

export interface ActoEditor {
  acto: typeof s.actos.$inferSelect;
  fecha: Fecha | null;
  importante: boolean;
  hojas: { id: number; titulo: string; estado: string | null }[];
  hilosAbre: { id: number; nombre: string }[];
  hilosCierra: { id: number; nombre: string }[];
  /** `fecha`: la del evento ya escrita en años absolutos, o null si no tiene. */
  eventos: { id: number; titulo: string; fecha: string | null }[];
  /** Para los selectores de "vincular": todos los hilos y eventos vivos. */
  todosHilos: { id: number; nombre: string }[];
  todosEventos: { id: number; titulo: string; fecha: string | null }[];
}

export async function getActoEditor(id: number): Promise<ActoEditor | null> {
  const [acto] = await db
    .select()
    .from(s.actos)
    .where(and(eq(s.actos.id, id), isNull(s.actos.eliminadoEn)));
  if (!acto) return null;

  const [fecha, hojas, hilos, eventos, todosHilos, todosEventos] = await Promise.all([
    leerFecha({ entidadTipo: "actos", entidadId: id, rol: "principal" }),
    db
      .select({ id: s.tramaHojas.id, titulo: s.tramaHojas.titulo, estado: s.tramaHojas.estado })
      .from(s.tramaHojas)
      .where(and(eq(s.tramaHojas.actoId, id), isNull(s.tramaHojas.eliminadoEn)))
      .orderBy(asc(s.tramaHojas.orden), asc(s.tramaHojas.id)),
    db
      .select({ id: s.hiloNarrativo.id, nombre: s.hiloNarrativo.nombre, abre: s.hiloNarrativo.actoAperturaId, cierra: s.hiloNarrativo.actoCierreId })
      .from(s.hiloNarrativo)
      .where(and(isNull(s.hiloNarrativo.eliminadoEn), or(eq(s.hiloNarrativo.actoAperturaId, id), eq(s.hiloNarrativo.actoCierreId, id)))),
    db
      .select({ id: s.timelineEventos.id, titulo: s.timelineEventos.titulo })
      .from(s.timelineEventos)
      .where(and(eq(s.timelineEventos.actoId, id), isNull(s.timelineEventos.eliminadoEn))),
    db
      .select({ id: s.hiloNarrativo.id, nombre: s.hiloNarrativo.nombre })
      .from(s.hiloNarrativo)
      .where(isNull(s.hiloNarrativo.eliminadoEn))
      .orderBy(asc(s.hiloNarrativo.orden), asc(s.hiloNarrativo.nombre)),
    db
      .select({ id: s.timelineEventos.id, titulo: s.timelineEventos.titulo })
      .from(s.timelineEventos)
      .where(isNull(s.timelineEventos.eliminadoEn))
      .orderBy(asc(s.timelineEventos.orden), asc(s.timelineEventos.id)),
  ]);

  const textos = await textosDeFechas("timeline", todosEventos.map((e) => e.id), { corto: true });
  const conFecha = (e: { id: number; titulo: string }) => ({ ...e, fecha: textos.get(e.id)?.absoluto ?? null });

  return {
    acto,
    fecha: fecha?.fecha ?? null,
    importante: fecha?.importante ?? false,
    hojas,
    hilosAbre: hilos.filter((h) => h.abre === id).map(({ id, nombre }) => ({ id, nombre })),
    hilosCierra: hilos.filter((h) => h.cierra === id).map(({ id, nombre }) => ({ id, nombre })),
    eventos: eventos.map(conFecha),
    todosHilos,
    todosEventos: todosEventos.map(conFecha),
  };
}

// ── Editor del capítulo ────────────────────────────────────────────────────

export async function getCapituloEditor(id: number) {
  const [capitulo] = await db
    .select()
    .from(s.capitulos)
    .where(and(eq(s.capitulos.id, id), isNull(s.capitulos.eliminadoEn)));
  return capitulo ?? null;
}

export type CapituloEditor = NonNullable<Awaited<ReturnType<typeof getCapituloEditor>>>;

/** Opciones de los desplegables del editor de capítulo. */
export async function getOpcionesCapitulo() {
  const [cats, personajes, capitulos] = await Promise.all([
    db
      .select({ campo: s.catalogos.campo, valor: s.catalogos.valor })
      .from(s.catalogos)
      .where(inArray(s.catalogos.campo, ["libro", "capitulo_tipo", "tipo_temporal", "narrador_tipo", "estado_narrativo"]))
      .orderBy(asc(s.catalogos.orden), asc(s.catalogos.valor)),
    db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre })
      .from(s.personajes)
      .where(isNull(s.personajes.eliminadoEn))
      .orderBy(asc(s.personajes.nombre)),
    db
      .select({ id: s.capitulos.id, numero: s.capitulos.numero, titulo: s.capitulos.titulo })
      .from(s.capitulos)
      .where(isNull(s.capitulos.eliminadoEn))
      .orderBy(asc(s.capitulos.libro), asc(s.capitulos.orden)),
  ]);
  const de = (campo: string) => cats.filter((c) => c.campo === campo).map((c) => c.valor);
  return {
    libros: de("libro"),
    tipos: de("capitulo_tipo"),
    tiposTemporales: de("tipo_temporal"),
    narradorTipos: de("narrador_tipo"),
    estadosNarrativos: de("estado_narrativo"),
    personajes,
    capitulos: capitulos.map((c) => ({ id: c.id, label: `${c.numero} — ${c.titulo}` })),
  };
}

export type OpcionesCapitulo = Awaited<ReturnType<typeof getOpcionesCapitulo>>;

// ── Trama (§8) ─────────────────────────────────────────────────────────────

/** Listados de la pantalla Trama: arcos, hojas e hilos, con su contexto. */
export async function getTramaIndice() {
  const [arcos, hojas, hilos] = await Promise.all([
    db
      .select({
        id: s.tramaArcos.id,
        nombre: s.tramaArcos.nombre,
        color: s.tramaArcos.color,
        libro: s.tramaArcos.libro,
        tipo: s.tramaArcos.tipo,
        estadoPublicacion: s.tramaArcos.estadoPublicacion,
      })
      .from(s.tramaArcos)
      .where(isNull(s.tramaArcos.eliminadoEn))
      .orderBy(asc(s.tramaArcos.orden), asc(s.tramaArcos.nombre)),
    db
      .select({
        id: s.tramaHojas.id,
        titulo: s.tramaHojas.titulo,
        estado: s.tramaHojas.estado,
        arcoId: s.tramaHojas.arcoId,
        capitulo: s.capitulos.numero,
        acto: s.actos.nombre,
      })
      .from(s.tramaHojas)
      .leftJoin(s.capitulos, eq(s.tramaHojas.capituloId, s.capitulos.id))
      .leftJoin(s.actos, eq(s.tramaHojas.actoId, s.actos.id))
      .where(isNull(s.tramaHojas.eliminadoEn))
      .orderBy(asc(s.tramaHojas.orden), asc(s.tramaHojas.id)),
    db
      .select({
        id: s.hiloNarrativo.id,
        nombre: s.hiloNarrativo.nombre,
        estado: s.hiloNarrativo.estado,
        arcoId: s.hiloNarrativo.arcoId,
        abiertoCap: s.hiloNarrativo.capituloAperturaId,
        abiertoActo: s.hiloNarrativo.actoAperturaId,
        cerradoCap: s.hiloNarrativo.capituloCierreId,
        cerradoActo: s.hiloNarrativo.actoCierreId,
      })
      .from(s.hiloNarrativo)
      .where(isNull(s.hiloNarrativo.eliminadoEn))
      .orderBy(asc(s.hiloNarrativo.orden), asc(s.hiloNarrativo.nombre)),
  ]);
  return {
    arcos,
    hojas,
    hilos: hilos.map((h) => ({
      id: h.id,
      nombre: h.nombre,
      estado: h.estado,
      arcoId: h.arcoId,
      abierto: h.abiertoCap != null || h.abiertoActo != null,
      cerrado: h.cerradoCap != null || h.cerradoActo != null,
    })),
  };
}

export type TramaIndice = Awaited<ReturnType<typeof getTramaIndice>>;

// ── Papelera (§9) ──────────────────────────────────────────────────────────

export interface EnPapelera {
  tipo: "capitulos" | "actos" | "arcos" | "hojas" | "hilos";
  id: number;
  nombre: string;
  detalle: string | null;
  eliminadoEn: Date;
}

/** Todo lo narrativo que está en la papelera, lo más reciente primero. */
export async function getPapeleraTaller(): Promise<EnPapelera[]> {
  const [caps, actos, arcos, hojas, hilos] = await Promise.all([
    db
      .select({ id: s.capitulos.id, nombre: s.capitulos.titulo, detalle: s.capitulos.numero, eliminadoEn: s.capitulos.eliminadoEn })
      .from(s.capitulos)
      .where(isNotNull(s.capitulos.eliminadoEn)),
    db
      .select({ id: s.actos.id, nombre: s.actos.nombre, detalle: s.capitulos.titulo, eliminadoEn: s.actos.eliminadoEn })
      .from(s.actos)
      .leftJoin(s.capitulos, eq(s.actos.capituloId, s.capitulos.id))
      .where(isNotNull(s.actos.eliminadoEn)),
    db
      .select({ id: s.tramaArcos.id, nombre: s.tramaArcos.nombre, eliminadoEn: s.tramaArcos.eliminadoEn })
      .from(s.tramaArcos)
      .where(isNotNull(s.tramaArcos.eliminadoEn)),
    db
      .select({ id: s.tramaHojas.id, nombre: s.tramaHojas.titulo, eliminadoEn: s.tramaHojas.eliminadoEn })
      .from(s.tramaHojas)
      .where(isNotNull(s.tramaHojas.eliminadoEn)),
    db
      .select({ id: s.hiloNarrativo.id, nombre: s.hiloNarrativo.nombre, eliminadoEn: s.hiloNarrativo.eliminadoEn })
      .from(s.hiloNarrativo)
      .where(isNotNull(s.hiloNarrativo.eliminadoEn)),
  ]);
  const out: EnPapelera[] = [
    ...caps.map((x) => ({ tipo: "capitulos" as const, ...x, eliminadoEn: x.eliminadoEn! })),
    ...actos.map((x) => ({ tipo: "actos" as const, ...x, eliminadoEn: x.eliminadoEn! })),
    ...arcos.map((x) => ({ tipo: "arcos" as const, ...x, detalle: null, eliminadoEn: x.eliminadoEn! })),
    ...hojas.map((x) => ({ tipo: "hojas" as const, ...x, detalle: null, eliminadoEn: x.eliminadoEn! })),
    ...hilos.map((x) => ({ tipo: "hilos" as const, ...x, detalle: null, eliminadoEn: x.eliminadoEn! })),
  ];
  return out.sort((a, b) => b.eliminadoEn.getTime() - a.eliminadoEn.getTime());
}

// ── Estadísticas (§9) ──────────────────────────────────────────────────────

/** Cuántos actos (vivos) usan cada nación, región o locación. */
export async function getLugaresUsados(actoIds: number[]): Promise<{ tipo: string; id: number; nombre: string; actos: number }[]> {
  if (actoIds.length === 0) return [];
  const filas = await db
    .select({ relacion: s.vinculo.relacion, destinoId: s.vinculo.destinoId, actoId: s.vinculo.origenId })
    .from(s.vinculo)
    .where(
      and(
        eq(s.vinculo.origenTipo, "actos"),
        inArray(s.vinculo.origenId, actoIds),
        inArray(s.vinculo.relacion, ["acto_nacion", "acto_region", "acto_locacion"]),
      ),
    );
  const tablas = { acto_nacion: s.naciones, acto_region: s.regiones, acto_locacion: s.locaciones } as const;
  const out: { tipo: string; id: number; nombre: string; actos: number }[] = [];
  for (const [rel, t] of Object.entries(tablas)) {
    const propias = filas.filter((f) => f.relacion === rel);
    const ids = [...new Set(propias.map((f) => f.destinoId))];
    if (!ids.length) continue;
    const nombres = await db.select({ id: t.id, nombre: t.nombre }).from(t).where(inArray(t.id, ids));
    for (const n of nombres)
      out.push({
        tipo: rel.replace("acto_", ""),
        id: n.id,
        nombre: n.nombre,
        actos: new Set(propias.filter((f) => f.destinoId === n.id).map((f) => f.actoId)).size,
      });
  }
  return out.sort((a, b) => b.actos - a.actos || a.nombre.localeCompare(b.nombre));
}
