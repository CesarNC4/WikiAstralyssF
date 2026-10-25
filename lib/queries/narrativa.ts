import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { saltoTemporal, textosFecha, type Extremo, type Fecha, type TextosFecha } from "@/lib/fechas";
import { etiquetaActo, numerarCapitulos } from "@/lib/narrativa/numeracion";
import { escribirFecha, fechasDeEntidades, getCalendario } from "@/lib/queries/fechas";

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
  url: string | null;
  tipoFuente: string | null;
  imagenUrl: string | null;
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

const CANCION = {
  id: s.canciones.id,
  titulo: s.canciones.titulo,
  artista: s.canciones.artista,
  url: s.canciones.url,
  tipoFuente: s.canciones.tipoFuente,
  imagenUrl: s.canciones.imagenUrl,
  estado: s.canciones.estadoPublicacion,
};

/** Fila de `CANCION` → canción del capítulo, sin el estado (que solo sirve para filtrar). */
function aCancion(
  c: { id: number; titulo: string; artista: string | null; url: string | null; tipoFuente: string | null; imagenUrl: string | null },
  desde: CancionDelCapitulo["desde"],
): CancionDelCapitulo {
  return { id: c.id, titulo: c.titulo, artista: c.artista, url: c.url, tipoFuente: c.tipoFuente, imagenUrl: c.imagenUrl, desde };
}

async function cancionesDelCapitulo(capituloId: number, publico: boolean): Promise<CancionDelCapitulo[]> {
  const filas = await db
    .select(CANCION)
    .from(s.capituloCancion)
    .innerJoin(s.canciones, eq(s.capituloCancion.cancionId, s.canciones.id))
    .where(and(eq(s.capituloCancion.capituloId, capituloId), isNull(s.canciones.eliminadoEn)));
  return filas
    .filter((c) => !publico || c.estado === "publicado")
    .map((c) => aCancion(c, "capitulo"));
}

/** Manuales del capítulo + las de sus actos, sin repetir (§3). */
async function cancionesDe(vinculos: FilaVinculo[], manual: CancionDelCapitulo[], publico: boolean): Promise<CancionDelCapitulo[]> {
  const porId = new Map(manual.map((c) => [c.id, { ...c }]));
  const ids = [...new Set(vinculos.filter((v) => v.relacion === "acto_cancion").map((v) => v.destinoId))];
  if (ids.length) {
    const filas = await db
      .select(CANCION)
      .from(s.canciones)
      .where(and(inArray(s.canciones.id, ids), isNull(s.canciones.eliminadoEn)));
    for (const c of filas) {
      if (publico && c.estado !== "publicado") continue;
      const ya = porId.get(c.id);
      if (ya) ya.desde = "ambos";
      else porId.set(c.id, aCancion(c, "acto"));
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
  const primero = enOrden[0];
  const ultimo = enOrden[enOrden.length - 1];
  if (ultimo.claveFin < primero.claveIni) return tramoQueCubre(filas);
  return fechaEntre(primero, ultimo, filas.some((f) => f.aproximada));
}

type FilaFecha = typeof s.fechaLore.$inferSelect;

/** Del inicio de `primero` al final de `ultimo`; un punto si coinciden. */
function fechaEntre(primero: FilaFecha, ultimo: FilaFecha, aproximada: boolean): Fecha {
  const ini: Extremo = { anio: primero.iniAnio, segmentoId: primero.iniSegmentoId, dia: primero.iniDia };
  const fin: Extremo =
    ultimo.finAnio != null
      ? { anio: ultimo.finAnio, segmentoId: ultimo.finSegmentoId, dia: ultimo.finDia }
      : { anio: ultimo.iniAnio, segmentoId: ultimo.iniSegmentoId, dia: ultimo.iniDia };
  const mismo = ini.anio === fin.anio && ini.segmentoId === fin.segmentoId && ini.dia === fin.dia;
  return { ini, fin: mismo ? null : fin, aproximada };
}

/** El tramo que cubre a todas: del inicio más temprano al final más tardío. */
function tramoQueCubre(filas: FilaFecha[]): Fecha {
  const primero = filas.reduce((m, f) => (f.claveIni < m.claveIni ? f : m));
  const ultimo = filas.reduce((m, f) => (f.claveFin > m.claveFin ? f : m));
  return fechaEntre(primero, ultimo, filas.some((f) => f.aproximada));
}

// ── Fragmentos del acto (docs/fragmentos-y-musica.md §2) ───────────────────

/** Fechas de los fragmentos de un acto. */
async function fechasDeFragmentos(ex: Ejecutor, actoId: number): Promise<FilaFecha[]> {
  return ex
    .select()
    .from(s.fechaLore)
    .where(
      and(
        eq(s.fechaLore.entidadTipo, "fragmentos"),
        eq(s.fechaLore.rol, "principal"),
        inArray(s.fechaLore.entidadId, ex.select({ id: s.actoFragmento.id }).from(s.actoFragmento).where(eq(s.actoFragmento.actoId, actoId))),
      ),
    );
}

/** Cuántos fragmentos del acto tienen fecha. Con alguno, la fecha del acto es calculada. */
export async function contarFragmentosConFecha(ex: Ejecutor, actoId: number): Promise<number> {
  return (await fechasDeFragmentos(ex, actoId)).length;
}

/**
 * Recalcula la fecha del acto a partir de sus fragmentos: del inicio del más
 * temprano al final del más tardío. Conserva el `importante` que ya tuviera. Si
 * ningún fragmento tiene fecha no toca nada: la fecha del acto vuelve a ser
 * manual, con el último valor que tuviera. Devuelve el error de `escribirFecha`.
 *
 * Al quedar guardada como fecha del acto, el rango del capítulo, la cronología y
 * las edades siguen funcionando sin cambios, y el recálculo de claves al cambiar
 * el calendario la alcanza como a cualquier otra.
 */
export async function recalcularFechaActo(ex: Ejecutor, actoId: number): Promise<string | null> {
  const filas = await fechasDeFragmentos(ex, actoId);
  if (filas.length === 0) return null;
  const destino = { entidadTipo: "actos", entidadId: actoId, rol: "principal" };
  const [actual] = await ex
    .select({ importante: s.fechaLore.importante })
    .from(s.fechaLore)
    .where(and(eq(s.fechaLore.entidadTipo, destino.entidadTipo), eq(s.fechaLore.entidadId, actoId), eq(s.fechaLore.rol, destino.rol)));
  return escribirFecha(ex, destino, tramoQueCubre(filas), actual?.importante ?? false);
}

export interface FragmentoPublico {
  id: number;
  /** Posición en orden de lectura, desde 1. */
  numero: number;
  /** Solo si su ficha está publicada. */
  pov: { id: number; nombre: string; imagenUrl: string | null } | null;
  titulo: string | null;
  enlace: string | null;
  fecha: TextosFecha | null;
  /** Para ordenar por fecha del mundo. */
  clave: number | null;
  /** Respecto al anterior con fecha, en orden de lectura y por fecha. */
  saltoLectura: string | null;
  saltoFecha: string | null;
}

/**
 * Fragmentos de un acto para su ficha pública. No filtran por estado: el
 * fragmento no tiene uno propio y la ficha solo existe si el acto es visible.
 */
export async function getFragmentosPublicos(actoId: number): Promise<FragmentoPublico[]> {
  const filas = await db
    .select({
      id: s.actoFragmento.id,
      titulo: s.actoFragmento.titulo,
      enlace: s.actoFragmento.enlace,
      personajeId: s.actoFragmento.personajeId,
      nombre: s.personajes.nombre,
      imagenUrl: s.personajes.imagenUrl,
      estado: s.personajes.estadoPublicacion,
      eliminado: s.personajes.eliminadoEn,
    })
    .from(s.actoFragmento)
    .leftJoin(s.personajes, eq(s.actoFragmento.personajeId, s.personajes.id))
    .where(eq(s.actoFragmento.actoId, actoId))
    .orderBy(asc(s.actoFragmento.orden), asc(s.actoFragmento.id));
  if (filas.length === 0) return [];

  const [cal, fechas] = await Promise.all([getCalendario(), fechasDeEntidades("fragmentos", filas.map((f) => f.id))]);

  const out: FragmentoPublico[] = filas.map((f, i) => {
    const g = fechas.get(f.id);
    const povVisible = f.personajeId != null && f.nombre != null && f.estado === "publicado" && !f.eliminado;
    return {
      id: f.id,
      numero: i + 1,
      pov: povVisible ? { id: f.personajeId!, nombre: f.nombre!, imagenUrl: f.imagenUrl } : null,
      titulo: f.titulo,
      enlace: f.enlace,
      fecha: g ? textosFecha(cal, g.fecha, true) : null,
      clave: g?.claveIni ?? null,
      saltoLectura: null,
      saltoFecha: null,
    };
  });

  // Cada salto se mide desde el último fragmento con fecha que lo precede.
  const saltos = (orden: FragmentoPublico[], campo: "saltoLectura" | "saltoFecha") => {
    let previa: Fecha | null = null;
    for (const f of orden) {
      const g = fechas.get(f.id);
      if (!g) continue;
      if (previa) f[campo] = saltoTemporal(cal, previa, g.fecha);
      previa = g.fecha;
    }
  };
  saltos(out, "saltoLectura");
  saltos(ordenPorFecha(out), "saltoFecha");
  return out;
}

/** Por fecha del mundo; los que no tienen fecha, al final y en orden de lectura. */
function ordenPorFecha<T extends { clave: number | null; numero: number }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => (a.clave ?? Infinity) - (b.clave ?? Infinity) || a.numero - b.numero);
}

/**
 * Canciones de un acto (las suyas, no las del capítulo), para su ficha pública.
 */
export async function getCancionesDeActo(actoId: number): Promise<CancionDelCapitulo[]> {
  const filas = await db
    .select(CANCION)
    .from(s.vinculo)
    .innerJoin(s.canciones, eq(s.vinculo.destinoId, s.canciones.id))
    .where(
      and(
        eq(s.vinculo.origenTipo, "actos"),
        eq(s.vinculo.origenId, actoId),
        eq(s.vinculo.relacion, "acto_cancion"),
        eq(s.canciones.estadoPublicacion, "publicado"),
        isNull(s.canciones.eliminadoEn),
      ),
    );
  return filas.map((c) => aCancion(c, "acto"));
}
