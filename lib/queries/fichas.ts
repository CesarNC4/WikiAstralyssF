import "server-only";
import { and, eq, asc, desc, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { etiquetaInversa } from "@/lib/catalogos";
import { aplicarVisibilidad, camposOcultos, filaOculta, ocultarCampos, ocultarEnLista, ocultarFilas, ocultarPorReferencia } from "@/lib/queries/visibilidad";
import { getRelacion, terminoInverso } from "@/lib/relaciones/registro";
import { MARCA_OCULTO, censurar } from "@/lib/visibilidad";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

const COLS_RELACIONADO = { id: true, nombre: true, surname: true, imagenUrl: true, titulo: true, estadoPublicacion: true, eliminadoEn: true } as const;
const COLS_LUGAR = { id: true, nombre: true, subtitulo: true, imagenUrl: true, estadoPublicacion: true, eliminadoEn: true } as const;

/**
 * La bandeja y el mapa de relaciones guardan también la fila de vuelta; el formulario
 * del personaje, no. La fila de vuelta de una relación que ya es propia no se repite:
 * si no, la ficha enseñaría la relación dos veces. Va aquí, antes de enmascarar, porque
 * después una relación oculta ya no dice con quién es.
 */
function sinReflejos<I extends { personajeId: number | null; tipoRelacion: string | null }>(
  propias: { personajeRelacionadoId: number | null; tipoRelacion: string | null }[],
  inversas: I[],
): I[] {
  const rel = getRelacion("relaciones")!;
  return inversas.filter(
    (i) =>
      !propias.some(
        (p) =>
          p.personajeRelacionadoId === i.personajeId &&
          (etiquetaInversa(i.tipoRelacion) === p.tipoRelacion || terminoInverso(rel, i.tipoRelacion) === p.tipoRelacion),
      ),
  );
}

async function leerPersonaje(id: number, soloPublicado: boolean) {
  const fila = await db.query.personajes.findFirst({
    where: (p, { eq, and, isNull }) =>
      and(eq(p.id, id), isNull(p.eliminadoEn), soloPublicado ? eq(p.estadoPublicacion, "publicado") : undefined),
    with: {
      estadisticas: true,
      habilidades: { with: { fundamento: { columns: { id: true, nombre: true, estadoPublicacion: true } } } },
      eventos: {
        with: { evento: { columns: { id: true, titulo: true, descripcion: true, estadoPublicacion: true, eliminadoEn: true } } },
      },
      objetos: {
        with: { objeto: { columns: { id: true, nombre: true, tipo: true, descripcion: true, estadoPublicacion: true, eliminadoEn: true } } },
      },
      relaciones: { with: { relacionado: { columns: COLS_RELACIONADO } } },
      // Relaciones donde este PJ es el destino: se muestran con etiqueta inversa.
      relacionesInversas: { with: { personaje: { columns: COLS_RELACIONADO } } },
      naciones: { with: { nacion: { columns: COLS_LUGAR } } },
      razas: { with: { raza: { columns: COLS_LUGAR } } },
      organizaciones: { with: { organizacion: { columns: COLS_LUGAR } } },
    },
  });
  return fila && { ...fila, relacionesInversas: sinReflejos(fila.relaciones, fila.relacionesInversas) };
}

type FilaPersonaje = NonNullable<Awaited<ReturnType<typeof leerPersonaje>>>;

const esPublica = (x: { estadoPublicacion: string | null; eliminadoEn?: Date | null } | null | undefined) =>
  !!x && x.estadoPublicacion === "publicado" && !x.eliminadoEn;

/** Los campos ocultos de las fichas anidadas en una fila: el apellido de quien sale en sus relaciones, su imagen… */
async function ocultarAnidado<T extends object>(entidad: string, filas: T[], clave: keyof T): Promise<T[]> {
  const anidados = filas.map((f) => f[clave]).filter(Boolean) as unknown as { id: number }[];
  const porId = new Map((await ocultarEnLista(entidad, anidados)).map((x) => [x.id, x]));
  return filas.map((f) => {
    const a = f[clave] as unknown as { id: number } | null;
    return a ? { ...f, [clave]: porId.get(a.id) ?? a } : f;
  });
}

/**
 * La ficha de un personaje tal y como la ve el público (docs/area-ia.md, Fase 4):
 * campos ocultos, bloque de estadísticas, habilidades y conexiones que salen como
 * marca, y las fichas no públicas fuera.
 */
async function enmascararPersonaje(fila: FilaPersonaje): Promise<FilaPersonaje> {
  const ocultos = await camposOcultos("personajes", fila.id);
  const p = ocultarCampos("personajes", fila, ocultos);

  const [relaciones, relacionesInversas, naciones, razas, organizaciones, objetos, eventos] = await Promise.all([
    ocultarAnidado("personajes", p.relaciones.filter((r) => r.oculto || !r.relacionado || esPublica(r.relacionado)), "relacionado"),
    ocultarAnidado("personajes", p.relacionesInversas.filter((r) => r.oculto || esPublica(r.personaje)), "personaje"),
    ocultarAnidado("naciones", p.naciones.filter((n) => n.oculto || esPublica(n.nacion)), "nacion"),
    ocultarAnidado("razas", p.razas.filter((r) => r.oculto || esPublica(r.raza)), "raza"),
    ocultarAnidado("organizaciones", p.organizaciones.filter((o) => o.oculto || esPublica(o.organizacion)), "organizacion"),
    // Un objeto en borrador sale sin enlace, como siempre; uno oculto, no.
    ocultarAnidado("artefactos", p.objetos.filter((o) => o.oculto || (o.objeto && o.objeto.estadoPublicacion !== "oculto" && !o.objeto.eliminadoEn)), "objeto"),
    ocultarAnidado("timeline", p.eventos.filter((e) => e.oculto || esPublica(e.evento)), "evento"),
  ]);

  const marcaLugar = { id: 0, nombre: MARCA_OCULTO, subtitulo: null, imagenUrl: null, estadoPublicacion: "publicado" as const, eliminadoEn: null };
  return {
    ...p,
    estadisticas: ocultos.has("estadisticas") ? [] : p.estadisticas,
    habilidades: p.habilidades.map((h) =>
      h.oculto ? { ...h, categoria: MARCA_OCULTO, nombre: MARCA_OCULTO, descripcion: null, tipo: null, magiaFundamentoId: null, fundamento: null } : h,
    ),
    relaciones: relaciones.map((r) =>
      r.oculto
        ? { ...r, relacionado: null, personajeRelacionadoId: null, nombreExterno: MARCA_OCULTO, tipoRelacion: null, subtipoRelacion: null, afecto: null, afectoReciproco: null, descripcion: null }
        : r,
    ),
    relacionesInversas: relacionesInversas.map((r) =>
      r.oculto ? { ...r, personaje: null, personajeId: null, tipoRelacion: null, subtipoRelacion: null, afecto: null, afectoReciproco: null, descripcion: null } : r,
    ),
    naciones: naciones.map((n) => (n.oculto ? { ...n, nacionId: 0, tipo: null, descripcion: null, nacion: marcaLugar } : n)),
    razas: razas.map((r) => (r.oculto ? { ...r, razaId: 0, esMixta: false, nota: null, raza: marcaLugar } : r)),
    organizaciones: organizaciones.map((o) =>
      o.oculto ? { ...o, organizacionId: 0, rol: null, tipo: null, descripcion: null, rangoId: null, faccionId: null, tituloApodo: null, organizacion: marcaLugar } : o,
    ),
    objetos: objetos.map((o) =>
      o.oculto
        ? { ...o, armaArtefactoId: 0, nota: null, objeto: { id: 0, nombre: MARCA_OCULTO, tipo: null, descripcion: null, estadoPublicacion: "oculto" as const, eliminadoEn: null } }
        : o,
    ),
    eventos: eventos.map((e) =>
      e.oculto
        ? { ...e, timelineEventoId: 0, nota: null, evento: { id: 0, titulo: MARCA_OCULTO, descripcion: null, estadoPublicacion: "publicado" as const, eliminadoEn: null } }
        : e,
    ),
  };
}

/** Ficha completa de personaje con todas sus relaciones (§5.2). */
export async function getPersonajeFicha(id: number) {
  const p = await leerPersonaje(id, true);
  return p ? enmascararPersonaje(p) : p;
}

/**
 * Igual que getPersonajeFicha pero SIN filtro de publicación (para preview del
 * admin). Lo oculto se enmascara igual: la vista previa enseña lo que verá el lector.
 */
export async function getPersonajePreview(id: number) {
  const p = await leerPersonaje(id, false);
  return p ? enmascararPersonaje(p) : p;
}

export type PersonajeFicha = NonNullable<Awaited<ReturnType<typeof getPersonajeFicha>>>;

/** Familias (publicadas) a las que pertenece el PJ — derivado de familia_jerarquia. */
export async function getFamiliasDePersonaje(personajeId: number): Promise<{ id: number; nombre: string }[]> {
  const rows = await db
    .selectDistinct({ id: s.familias.id, nombre: s.familias.nombre, oculto: s.familiaJerarquia.oculto })
    .from(s.familiaJerarquia)
    .innerJoin(s.familias, eq(s.familiaJerarquia.familiaId, s.familias.id))
    .where(
      and(
        eq(s.familiaJerarquia.personajeId, personajeId),
        or(eq(s.familiaJerarquia.oculto, true), and(eq(s.familias.estadoPublicacion, "publicado"), isNull(s.familias.eliminadoEn))),
      ),
    )
    .orderBy(asc(s.familias.nombre));
  return ocultarFilas(rows).filter((r) => r.nombre);
}

/** Personajes asociados a una nación (para la ficha de nación). */
export async function getPersonajesDeNacion(nacionId: number) {
  const filas = await db
    .select({
      id: s.personajes.id,
      nombre: s.personajes.nombre,
      imagenUrl: s.personajes.imagenUrl,
      titulo: s.personajes.titulo,
      tipo: s.personajeNacion.tipo,
      oculto: s.personajeNacion.oculto,
    })
    .from(s.personajeNacion)
    .innerJoin(s.personajes, eq(s.personajeNacion.personajeId, s.personajes.id))
    .where(
      and(
        eq(s.personajeNacion.nacionId, nacionId),
        or(eq(s.personajeNacion.oculto, true), and(eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn))),
      ),
    )
    .limit(24);
  return ocultarEnLista("personajes", ocultarFilas(filas));
}

/** Personajes nacidos en una nación (vía lugar de nacimiento). */
export async function getPersonajesNacidosEnNacion(nacionId: number) {
  const filas = await db
    .select({
      id: s.personajes.id,
      nombre: s.personajes.nombre,
      imagenUrl: s.personajes.imagenUrl,
      titulo: s.personajes.titulo,
    })
    .from(s.personajes)
    .where(
      and(
        eq(s.personajes.lugarNacimientoNacionId, nacionId),
        eq(s.personajes.estadoPublicacion, "publicado"),
        isNull(s.personajes.eliminadoEn),
      ),
    )
    .orderBy(asc(s.personajes.nombre))
    .limit(24);
  return ocultarEnLista("personajes", await ocultarPorReferencia("personajes", filas, ["lugarNacimientoNacionId"]));
}

/** Misiones encargadas por un personaje (reverso de misiones.personajeId). */
export async function getMisionesDePersonaje(personajeId: number) {
  const filas = await db
    .select({ id: s.misiones.id, nombre: s.misiones.nombre, tipo: s.misiones.tipo, estado: s.misiones.estado, imagenUrl: s.misiones.imagenUrl })
    .from(s.misiones)
    .where(and(eq(s.misiones.personajeId, personajeId), eq(s.misiones.estadoPublicacion, "publicado"), isNull(s.misiones.eliminadoEn)))
    .orderBy(asc(s.misiones.nombre));
  return ocultarEnLista("misiones", await ocultarPorReferencia("misiones", filas, ["personajeId"]));
}

/**
 * Capítulos en los que aparece un personaje. Ya no se vincula a mano: sale de
 * los actos donde es POV o aparece (spec del taller §3). Solo cuentan los actos
 * publicados de capítulos publicados, que son los que el público puede ver.
 */
export async function getCapitulosDePersonaje(personajeId: number) {
  const filas = await db
    .select({
      id: s.capitulos.id,
      numero: s.capitulos.numero,
      titulo: s.capitulos.titulo,
      libro: s.capitulos.libro,
      orden: s.capitulos.orden,
      relacion: s.vinculo.relacion,
      oculto: s.vinculo.oculto,
    })
    .from(s.vinculo)
    .innerJoin(s.actos, eq(s.vinculo.origenId, s.actos.id))
    .innerJoin(s.capitulos, eq(s.actos.capituloId, s.capitulos.id))
    .where(
      and(
        eq(s.vinculo.origenTipo, "actos"),
        inArray(s.vinculo.relacion, ["acto_pov", "acto_personaje"]),
        eq(s.vinculo.destinoTipo, "personajes"),
        eq(s.vinculo.destinoId, personajeId),
        eq(s.actos.estadoPublicacion, "publicado"),
        isNull(s.actos.eliminadoEn),
        eq(s.capitulos.estadoPublicacion, "publicado"),
        isNull(s.capitulos.eliminadoEn),
      ),
    );

  // Una fila por capítulo; si en algún acto es POV, se dice.
  const porId = new Map<number, { id: number; numero: string; titulo: string; libro: string | null; orden: number; rol: string | null }>();
  for (const f of filas) {
    if (f.oculto) {
      porId.set(0, { id: 0, numero: MARCA_OCULTO, titulo: MARCA_OCULTO, libro: null, orden: Number.MAX_SAFE_INTEGER, rol: null });
      continue;
    }
    const ya = porId.get(f.id);
    const pov = f.relacion === "acto_pov";
    if (!ya) porId.set(f.id, { id: f.id, numero: f.numero, titulo: f.titulo, libro: f.libro, orden: f.orden, rol: pov ? "POV" : null });
    else if (pov) ya.rol = "POV";
  }
  return [...porId.values()].sort(
    (a, b) => (a.libro ?? "").localeCompare(b.libro ?? "") || a.orden - b.orden || a.id - b.id,
  );
}

/** Organizaciones y razas vinculadas a una nación (§ punto 3). */
export async function getNacionFacciones(nacionId: number) {
  const [organizaciones, razas] = await Promise.all([
    db
      .select({ id: s.organizaciones.id, nombre: s.organizaciones.nombre, imagenUrl: s.organizaciones.imagenUrl, tipo: s.nacionOrganizacion.tipo, oculto: s.nacionOrganizacion.oculto })
      .from(s.nacionOrganizacion)
      .innerJoin(s.organizaciones, eq(s.nacionOrganizacion.organizacionId, s.organizaciones.id))
      .where(and(eq(s.nacionOrganizacion.nacionId, nacionId), or(eq(s.nacionOrganizacion.oculto, true), eq(s.organizaciones.estadoPublicacion, "publicado")))),
    db
      .select({ id: s.razas.id, nombre: s.razas.nombre, imagenUrl: s.razas.imagenUrl, tipo: s.nacionRaza.tipo, oculto: s.nacionRaza.oculto })
      .from(s.nacionRaza)
      .innerJoin(s.razas, eq(s.nacionRaza.razaId, s.razas.id))
      .where(and(eq(s.nacionRaza.nacionId, nacionId), or(eq(s.nacionRaza.oculto, true), and(eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn))))),
  ]);
  return {
    organizaciones: await ocultarEnLista("organizaciones", ocultarFilas(organizaciones)),
    razas: await ocultarEnLista("razas", ocultarFilas(razas)),
  };
}

// ── Getters simples por id (prosa) ───────────────────────
async function firstVisible<T extends { id: unknown }>(
  rows: Promise<T[]>,
  /**
   * Entidad de la fila. Al indicarla se aplican los campos que el autor haya
   * marcado como ocultos, que es el único punto por el que pasan todas las
   * fichas simples antes de llegar al público.
   */
  entidadTipo?: string,
): Promise<T | undefined> {
  const fila = (await rows)[0];
  if (!fila || !entidadTipo) return fila;
  return aplicarVisibilidad(entidadTipo, fila as unknown as Record<string, unknown>) as Promise<T | undefined>;
}

export async function getNacion(id: number) {
  return firstVisible(
    db.select().from(s.naciones).where(and(eq(s.naciones.id, id), eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn))).limit(1),
    "naciones",
  );
}
export async function getRaza(id: number) {
  return firstVisible(
    db.select().from(s.razas).where(and(eq(s.razas.id, id), eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn))).limit(1),
    "razas",
  );
}
export async function getBestia(id: number) {
  return firstVisible(
    db.select().from(s.bestias).where(and(eq(s.bestias.id, id), eq(s.bestias.estadoPublicacion, "publicado"), isNull(s.bestias.eliminadoEn))).limit(1),
    "bestias",
  );
}
export async function getMineral(id: number) {
  return firstVisible(
    db.select().from(s.minerales).where(and(eq(s.minerales.id, id), eq(s.minerales.estadoPublicacion, "publicado"), isNull(s.minerales.eliminadoEn))).limit(1),
    "minerales",
  );
}
export async function getConcepto(id: number) {
  return firstVisible(
    db.select().from(s.conceptos).where(and(eq(s.conceptos.id, id), eq(s.conceptos.estadoPublicacion, "publicado"), isNull(s.conceptos.eliminadoEn))).limit(1),
    "conceptos",
  );
}
export async function getMision(id: number) {
  const mision = await firstVisible(
    db.select().from(s.misiones).where(and(eq(s.misiones.id, id), eq(s.misiones.estadoPublicacion, "publicado"), isNull(s.misiones.eliminadoEn))).limit(1),
    "misiones",
  );
  if (!mision) return null;
  // Encargante: ficha de personaje si la tiene; si no, nombre libre.
  let encargante: { id: number; nombre: string } | null = null;
  if (mision.personajeId) {
    const [p] = await db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre })
      .from(s.personajes)
      .where(and(eq(s.personajes.id, mision.personajeId), eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn)))
      .limit(1);
    encargante = p ?? null;
  }
  return { ...mision, encargante };
}
export async function getLordDemonio(id: number) {
  return firstVisible(
    db.select().from(s.lordDemonio).where(and(eq(s.lordDemonio.id, id), eq(s.lordDemonio.estadoPublicacion, "publicado"), isNull(s.lordDemonio.eliminadoEn))).limit(1),
    "demonios",
  );
}

export async function getArtefacto(id: number) {
  const artefacto = await firstVisible(
    db.select().from(s.armasArtefactos).where(and(eq(s.armasArtefactos.id, id), eq(s.armasArtefactos.estadoPublicacion, "publicado"), isNull(s.armasArtefactos.eliminadoEn))).limit(1),
    "artefactos",
  );
  if (!artefacto) return null;
  // Propietario con ficha si lo tiene; si no, el nombre libre.
  let propietario: { id: number; nombre: string; imagenUrl: string | null } | null = null;
  if (artefacto.propietarioId) {
    const [p] = await db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre, imagenUrl: s.personajes.imagenUrl })
      .from(s.personajes)
      .where(and(eq(s.personajes.id, artefacto.propietarioId), eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn)))
      .limit(1);
    propietario = p ? (await ocultarEnLista("personajes", [p]))[0] : null;
  }
  return { ...artefacto, propietario };
}

/** Todas las monedas publicadas (la economía se muestra en una sola página). */
export async function getSistemaMonetario() {
  const filas = await db
    .select()
    .from(s.sistemaMonetario)
    .where(and(eq(s.sistemaMonetario.estadoPublicacion, "publicado"), isNull(s.sistemaMonetario.eliminadoEn)))
    .orderBy(asc(s.sistemaMonetario.nombre));
  const ocultos = await Promise.all(filas.map((f) => aplicarVisibilidad("economia", f as unknown as Record<string, unknown>)));
  return ocultos as unknown as typeof filas;
}

export async function getPaginaLore(slug: string) {
  return firstVisible(
    db.select().from(s.paginasLore).where(and(eq(s.paginasLore.slug, slug), eq(s.paginasLore.estadoPublicacion, "publicado"))).limit(1),
    "lore",
  );
}

/** Página de lore con sus secciones ordenadas (§1, problema 2). */
export async function getPaginaLoreConSecciones(slug: string) {
  const pagina = await getPaginaLore(slug);
  if (!pagina) return null;
  const secciones = await db
    .select({
      id: s.paginaSecciones.id,
      orden: s.paginaSecciones.orden,
      titulo: s.paginaSecciones.titulo,
      contenido: s.paginaSecciones.contenido,
      tipo: s.paginaSecciones.tipo,
    })
    .from(s.paginaSecciones)
    .where(and(eq(s.paginaSecciones.paginaId, pagina.id), eq(s.paginaSecciones.estadoPublicacion, "publicado")))
    .orderBy(asc(s.paginaSecciones.orden));
  return { pagina, secciones: censurar(secciones) };
}

/** Un miembro cuya pertenencia está oculta: la casilla sale, sin nada que lo identifique. */
function miembroOculto(id: number): FichaJerarquia {
  return { id, nombre: MARCA_OCULTO, tituloApodo: null, tituloNobiliario: null, tituloFamilia: null, rango: null, rangoPeso: null, personajeId: null, personajeImg: null };
}

/** Una fila del historial: si está oculta, la marca y su id (la lista lo usa de clave). */
function historialVisible<T extends { id: number; oculto: boolean }>(h: T): T {
  return h.oculto ? { ...filaOculta(h), id: h.id } : h;
}

// ── Organización (con jerarquía y facciones) ─────────────
export async function getOrganizacionFicha(id: number) {
  const org = await firstVisible(
    db.select().from(s.organizaciones).where(and(eq(s.organizaciones.id, id), eq(s.organizaciones.estadoPublicacion, "publicado"))).limit(1),
    "organizaciones",
  );
  if (!org) return null;

  const [jerRaw, facciones, historial] = await Promise.all([
    db
      .select({
        id: s.orgJerarquia.id,
        nombreLibre: s.orgJerarquia.nombre,
        tituloApodo: s.orgJerarquia.tituloApodo,
        rol: s.orgJerarquia.rol,
        orden: s.orgJerarquia.orden,
        personajeId: s.personajes.id,
        personajeNombre: s.personajes.nombre,
        personajeImg: s.personajes.imagenUrl,
        rango: s.orgRangos.nombre,
        rangoPeso: s.orgRangos.peso,
        oculto: s.orgJerarquia.oculto,
      })
      .from(s.orgJerarquia)
      // La condición va en el ON, no en el WHERE: así el miembro sin ficha
      // publicada deja de enlazar pero la fila del organigrama sobrevive, igual
      // que los miembros escritos a mano en `nombre`.
      .leftJoin(
        s.personajes,
        and(
          eq(s.orgJerarquia.personajeId, s.personajes.id),
          eq(s.personajes.estadoPublicacion, "publicado"),
          isNull(s.personajes.eliminadoEn),
        ),
      )
      .leftJoin(s.orgRangos, eq(s.orgJerarquia.rangoId, s.orgRangos.id))
      .where(eq(s.orgJerarquia.organizacionId, id))
      .orderBy(asc(s.orgJerarquia.orden)),
    db.select().from(s.orgFacciones).where(eq(s.orgFacciones.organizacionId, id)),
    db.select().from(s.orgHistorial).where(eq(s.orgHistorial.organizacionId, id)).orderBy(asc(s.orgHistorial.orden)),
  ]);

  // Una fila sin ficha publicada y sin nombre escrito a mano no tiene nada que
  // mostrar: era un enlace a un personaje que el público no puede ver.
  const jerarquia: FichaJerarquia[] = (await ocultarEnLista("personajes", jerRaw, { idDe: "personajeId", alias: { personajeImg: "imagenUrl" } }))
    .filter((j) => j.oculto || (j.personajeNombre ?? j.nombreLibre))
    .map((j) =>
      j.oculto
        ? miembroOculto(j.id)
        : {
            id: j.id,
            nombre: j.personajeNombre ?? j.nombreLibre ?? null,
            tituloApodo: j.tituloApodo ?? j.rol,
            tituloNobiliario: null,
            tituloFamilia: null,
            rango: j.rango,
            rangoPeso: j.rangoPeso,
            personajeId: j.personajeId,
            personajeImg: j.personajeImg,
          },
    );

  return censurar({ org, jerarquia, facciones, historial: historial.map(historialVisible) });
}

// ── Familia (con árbol y jerarquía) ──────────────────────
export async function getFamiliaFicha(id: number) {
  const familia = await firstVisible(
    db.select().from(s.familias).where(and(eq(s.familias.id, id), eq(s.familias.estadoPublicacion, "publicado"))).limit(1),
    "familias",
  );
  if (!familia) return null;

  const [arbol, jerarquia, facciones] = await Promise.all([
    db
      .select({
        id: s.familiaArbol.id,
        nombre: s.familiaArbol.nombre,
        generacion: s.familiaArbol.generacion,
        padreId: s.familiaArbol.padreId,
        madreId: s.familiaArbol.madreId,
        estado: s.familiaArbol.estado,
        destacado: s.familiaArbol.destacado,
        // Del join filtrado, no de la FK: si el personaje no está publicado queda
        // null y el nodo del árbol deja de enlazar a una ficha que daría 404.
        personajeId: s.personajes.id,
        oculto: s.familiaArbol.oculto,
      })
      .from(s.familiaArbol)
      .leftJoin(
        s.personajes,
        and(eq(s.familiaArbol.personajeId, s.personajes.id), eq(s.personajes.estadoPublicacion, "publicado")),
      )
      .where(eq(s.familiaArbol.familiaId, id))
      .orderBy(asc(s.familiaArbol.generacion)),
    db
      .select({
        id: s.familiaJerarquia.id,
        nombreLibre: s.familiaJerarquia.nombre,
        tituloNobiliario: s.familiaJerarquia.tituloNobiliario,
        tituloFamilia: s.familiaJerarquia.tituloFamilia,
        orden: s.familiaJerarquia.orden,
        personajeId: s.personajes.id,
        personajeNombre: s.personajes.nombre,
        personajeImg: s.personajes.imagenUrl,
        rango: s.familiaRangos.nombre,
        rangoPeso: s.familiaRangos.peso,
        oculto: s.familiaJerarquia.oculto,
      })
      .from(s.familiaJerarquia)
      .leftJoin(
        s.personajes,
        and(eq(s.familiaJerarquia.personajeId, s.personajes.id), eq(s.personajes.estadoPublicacion, "publicado")),
      )
      .leftJoin(s.familiaRangos, eq(s.familiaJerarquia.rangoId, s.familiaRangos.id))
      .where(eq(s.familiaJerarquia.familiaId, id))
      .orderBy(asc(s.familiaJerarquia.orden)),
    db.select().from(s.familiaFacciones).where(eq(s.familiaFacciones.familiaId, id)),
  ]);

  const jerarquiaFicha: FichaJerarquia[] = (await ocultarEnLista("personajes", jerarquia, { idDe: "personajeId", alias: { personajeImg: "imagenUrl" } })).map((j) =>
    j.oculto
      ? miembroOculto(j.id)
      : {
          id: j.id,
          nombre: j.personajeNombre ?? j.nombreLibre ?? null,
          tituloApodo: null,
          tituloNobiliario: j.tituloNobiliario,
          tituloFamilia: j.tituloFamilia,
          rango: j.rango,
          rangoPeso: j.rangoPeso,
          personajeId: j.personajeId,
          personajeImg: j.personajeImg,
        },
  );
  // Un nodo oculto sale como "???" y conserva sus líneas: se ve que hay alguien.
  const arbolVisible = arbol.map((n) => (n.oculto ? { ...n, nombre: MARCA_OCULTO, personajeId: null, estado: null, destacado: false } : n));

  return censurar({ familia, arbol: arbolVisible, jerarquia: jerarquiaFicha, facciones });
}

// ── Gremio (singleton, sin estado_publicacion) ───────────
export async function getGremioFicha() {
  const [fila] = await db.select().from(s.gremio).limit(1);
  if (!fila) return null;
  const gid = fila.id;
  const gremio = ocultarCampos("gremio", fila, await camposOcultos("gremio", gid));
  const [rangos, facciones, jerRaw, historial] = await Promise.all([
    db.select().from(s.gremioRangos).where(eq(s.gremioRangos.gremioId, gid)).orderBy(desc(s.gremioRangos.peso)),
    db.select().from(s.gremioFacciones).where(eq(s.gremioFacciones.gremioId, gid)),
    db
      .select({
        id: s.gremioJerarquia.id,
        nombreLibre: s.gremioJerarquia.nombre,
        tituloApodo: s.gremioJerarquia.tituloApodo,
        orden: s.gremioJerarquia.orden,
        personajeId: s.personajes.id,
        personajeNombre: s.personajes.nombre,
        personajeImg: s.personajes.imagenUrl,
        rango: s.gremioRangos.nombre,
        rangoPeso: s.gremioRangos.peso,
        oculto: s.gremioJerarquia.oculto,
      })
      .from(s.gremioJerarquia)
      .leftJoin(
        s.personajes,
        and(eq(s.gremioJerarquia.personajeId, s.personajes.id), eq(s.personajes.estadoPublicacion, "publicado")),
      )
      .leftJoin(s.gremioRangos, eq(s.gremioJerarquia.rangoId, s.gremioRangos.id))
      .where(eq(s.gremioJerarquia.gremioId, gid))
      .orderBy(asc(s.gremioJerarquia.orden)),
    db.select().from(s.gremioHistorial).where(eq(s.gremioHistorial.gremioId, gid)).orderBy(asc(s.gremioHistorial.orden)),
  ]);
  const jerarquia: FichaJerarquia[] = (await ocultarEnLista("personajes", jerRaw, { idDe: "personajeId", alias: { personajeImg: "imagenUrl" } })).map((j) =>
    j.oculto
      ? miembroOculto(j.id)
      : {
          id: j.id,
          nombre: j.personajeNombre ?? j.nombreLibre ?? null,
          tituloApodo: j.tituloApodo,
          tituloNobiliario: null,
          tituloFamilia: null,
          rango: j.rango,
          rangoPeso: j.rangoPeso,
          personajeId: j.personajeId,
          personajeImg: j.personajeImg,
        },
  );
  return censurar({ gremio, rangos, facciones, jerarquia, historial: historial.map(historialVisible) });
}

// ── generateStaticParams helpers (ids visibles) ──────────
// ── Narrativa ────────────────────────────────────────────
export async function getCapitulo(id: number) {
  return firstVisible(
    db
      .select()
      .from(s.capitulos)
      .where(and(eq(s.capitulos.id, id), eq(s.capitulos.estadoPublicacion, "publicado"), isNull(s.capitulos.eliminadoEn)))
      .limit(1),
    "capitulos",
  );
}

/**
 * Un acto público: publicado, fuera de la papelera y dentro de un capítulo que
 * también lo está (spec del taller §4). El capítulo de la URL tiene que ser el
 * suyo, para que no haya dos direcciones para el mismo acto.
 */
export async function getActoPublico(capituloId: number, actoId: number) {
  const [fila] = await db
    .select({ acto: s.actos, capitulo: s.capitulos })
    .from(s.actos)
    .innerJoin(s.capitulos, eq(s.actos.capituloId, s.capitulos.id))
    .where(
      and(
        eq(s.actos.id, actoId),
        eq(s.actos.capituloId, capituloId),
        eq(s.actos.estadoPublicacion, "publicado"),
        isNull(s.actos.eliminadoEn),
        eq(s.capitulos.estadoPublicacion, "publicado"),
        isNull(s.capitulos.eliminadoEn),
      ),
    )
    .limit(1);
  if (!fila) return null;
  // Las notas privadas del acto no salen nunca de aquí.
  const { notasPrivadas: _n, ...acto } = fila.acto;
  void _n;
  return {
    acto: ocultarCampos("actos", acto, await camposOcultos("actos", acto.id)),
    capitulo: ocultarCampos("capitulos", fila.capitulo, await camposOcultos("capitulos", fila.capitulo.id)),
  };
}

/** Pares capítulo/acto visibles al público, para el prerender. */
export async function getActosVisibles(): Promise<{ capituloId: number; actoId: number }[]> {
  const filas = await db
    .select({ capituloId: s.actos.capituloId, actoId: s.actos.id })
    .from(s.actos)
    .innerJoin(s.capitulos, eq(s.actos.capituloId, s.capitulos.id))
    .where(
      and(
        eq(s.actos.estadoPublicacion, "publicado"),
        isNull(s.actos.eliminadoEn),
        eq(s.capitulos.estadoPublicacion, "publicado"),
        isNull(s.capitulos.eliminadoEn),
      ),
    );
  return filas.map((f) => ({ capituloId: f.capituloId!, actoId: f.actoId }));
}

export async function getArco(id: number) {
  return firstVisible(
    db
      .select()
      .from(s.tramaArcos)
      .where(and(eq(s.tramaArcos.id, id), eq(s.tramaArcos.estadoPublicacion, "publicado"), isNull(s.tramaArcos.eliminadoEn)))
      .limit(1),
    "arcos",
  );
}

/**
 * Capítulos que toca un arco, a través de sus hojas de trama. Las hojas en sí no
 * se publican —guardan giros y secretos— pero sí sirven para decir en qué
 * capítulos transcurre el arco.
 */
export async function getCapitulosDeArco(arcoId: number) {
  return db
    .selectDistinct({
      id: s.capitulos.id,
      numero: s.capitulos.numero,
      titulo: s.capitulos.titulo,
      libro: s.capitulos.libro,
      // En la selección porque SELECT DISTINCT exige que lo que ordena esté en ella.
      orden: s.capitulos.orden,
    })
    .from(s.tramaHojas)
    .innerJoin(s.capitulos, eq(s.tramaHojas.capituloId, s.capitulos.id))
    .where(
      and(
        eq(s.tramaHojas.arcoId, arcoId),
        eq(s.capitulos.estadoPublicacion, "publicado"),
        isNull(s.capitulos.eliminadoEn),
      ),
    )
    .orderBy(asc(s.capitulos.libro), asc(s.capitulos.orden), asc(s.capitulos.id));
}

export async function getVisibleIds(
  key: "personajes" | "naciones" | "organizaciones" | "familias" | "razas" | "bestias" | "minerales" | "conceptos" | "magia" | "misiones" | "demonios" | "artefactos" | "capitulos" | "arcos" | "canciones",
): Promise<number[]> {
  const table = {
    personajes: s.personajes,
    naciones: s.naciones,
    organizaciones: s.organizaciones,
    familias: s.familias,
    razas: s.razas,
    bestias: s.bestias,
    minerales: s.minerales,
    conceptos: s.conceptos,
    magia: s.magiaFundamentos,
    misiones: s.misiones,
    demonios: s.lordDemonio,
    artefactos: s.armasArtefactos,
    capitulos: s.capitulos,
    arcos: s.tramaArcos,
    canciones: s.canciones,
  }[key];
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.estadoPublicacion, "publicado"), isNull(table.eliminadoEn)));
  return rows.map((r) => r.id);
}

export async function getLoreSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: s.paginasLore.slug })
    .from(s.paginasLore)
    .where(eq(s.paginasLore.estadoPublicacion, "publicado"));
  return rows.map((r) => r.slug);
}
