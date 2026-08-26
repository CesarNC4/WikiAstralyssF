import "server-only";
import { and, eq, asc, desc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

/** Ficha completa de personaje con todas sus relaciones (§5.2). */
export async function getPersonajeFicha(id: number) {
  return db.query.personajes.findFirst({
    where: (p, { eq, and, isNull }) =>
      and(eq(p.id, id), eq(p.estadoPublicacion, "publicado"), isNull(p.eliminadoEn)),
    with: {
      estadisticas: true,
      habilidades: { with: { fundamento: { columns: { id: true, nombre: true, estadoPublicacion: true } } } },
      eventos: {
        with: { evento: { columns: { id: true, fechaLore: true, titulo: true, descripcion: true } } },
      },
      narrativa: true,
      objetos: {
        with: { objeto: { columns: { id: true, nombre: true, tipo: true, descripcion: true, estadoPublicacion: true } } },
      },
      relaciones: {
        with: {
          relacionado: {
            columns: { id: true, nombre: true, surname: true, imagenUrl: true, titulo: true },
          },
        },
      },
      // Relaciones donde este PJ es el destino: se muestran con etiqueta inversa.
      relacionesInversas: {
        with: {
          personaje: {
            columns: { id: true, nombre: true, surname: true, imagenUrl: true, titulo: true },
          },
        },
      },
      canciones: { with: { cancion: true } },
      naciones: {
        with: { nacion: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
      razas: {
        with: { raza: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
      organizaciones: {
        with: { organizacion: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
    },
  });
}

export type PersonajeFicha = NonNullable<Awaited<ReturnType<typeof getPersonajeFicha>>>;

/** Igual que getPersonajeFicha pero SIN filtro de publicación (para preview del admin). */
export async function getPersonajePreview(id: number) {
  return db.query.personajes.findFirst({
    where: (p, { eq, and, isNull }) => and(eq(p.id, id), isNull(p.eliminadoEn)),
    with: {
      estadisticas: true,
      habilidades: { with: { fundamento: { columns: { id: true, nombre: true, estadoPublicacion: true } } } },
      eventos: {
        with: { evento: { columns: { id: true, fechaLore: true, titulo: true, descripcion: true } } },
      },
      narrativa: true,
      objetos: {
        with: { objeto: { columns: { id: true, nombre: true, tipo: true, descripcion: true, estadoPublicacion: true } } },
      },
      relaciones: {
        with: {
          relacionado: {
            columns: { id: true, nombre: true, surname: true, imagenUrl: true, titulo: true },
          },
        },
      },
      // Relaciones donde este PJ es el destino: se muestran con etiqueta inversa.
      relacionesInversas: {
        with: {
          personaje: {
            columns: { id: true, nombre: true, surname: true, imagenUrl: true, titulo: true },
          },
        },
      },
      canciones: { with: { cancion: true } },
      naciones: {
        with: { nacion: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
      razas: {
        with: { raza: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
      organizaciones: {
        with: { organizacion: { columns: { id: true, nombre: true, subtitulo: true, imagenUrl: true } } },
      },
    },
  });
}

/** Familias (publicadas) a las que pertenece el PJ — derivado de familia_jerarquia. */
export async function getFamiliasDePersonaje(personajeId: number): Promise<{ id: number; nombre: string }[]> {
  const rows = await db
    .selectDistinct({ id: s.familias.id, nombre: s.familias.nombre })
    .from(s.familiaJerarquia)
    .innerJoin(s.familias, eq(s.familiaJerarquia.familiaId, s.familias.id))
    .where(
      and(
        eq(s.familiaJerarquia.personajeId, personajeId),
        eq(s.familias.estadoPublicacion, "publicado"),
        isNull(s.familias.eliminadoEn),
      ),
    )
    .orderBy(asc(s.familias.nombre));
  return rows.filter((r) => r.nombre);
}

/** Personajes asociados a una nación (para la ficha de nación). */
export async function getPersonajesDeNacion(nacionId: number) {
  return db
    .select({
      id: s.personajes.id,
      nombre: s.personajes.nombre,
      imagenUrl: s.personajes.imagenUrl,
      titulo: s.personajes.titulo,
      tipo: s.personajeNacion.tipo,
    })
    .from(s.personajeNacion)
    .innerJoin(s.personajes, eq(s.personajeNacion.personajeId, s.personajes.id))
    .where(
      and(
        eq(s.personajeNacion.nacionId, nacionId),
        eq(s.personajes.estadoPublicacion, "publicado"),
        isNull(s.personajes.eliminadoEn),
      ),
    )
    .limit(24);
}

/** Personajes nacidos en una nación (vía lugar de nacimiento). */
export async function getPersonajesNacidosEnNacion(nacionId: number) {
  return db
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
}

/** Misiones encargadas por un personaje (reverso de misiones.personajeId). */
export async function getMisionesDePersonaje(personajeId: number) {
  return db
    .select({ id: s.misiones.id, nombre: s.misiones.nombre, tipo: s.misiones.tipo, estado: s.misiones.estado, imagenUrl: s.misiones.imagenUrl })
    .from(s.misiones)
    .where(and(eq(s.misiones.personajeId, personajeId), eq(s.misiones.estadoPublicacion, "publicado"), isNull(s.misiones.eliminadoEn)))
    .orderBy(asc(s.misiones.nombre));
}

/** Capítulos en los que aparece un personaje (reverso de capitulo_personaje). */
export async function getCapitulosDePersonaje(personajeId: number) {
  return db
    .select({ id: s.capitulos.id, numero: s.capitulos.numero, titulo: s.capitulos.titulo, rol: s.capituloPersonaje.rolEnCapitulo })
    .from(s.capituloPersonaje)
    .innerJoin(s.capitulos, eq(s.capituloPersonaje.capituloId, s.capitulos.id))
    .where(and(eq(s.capituloPersonaje.personajeId, personajeId), eq(s.capitulos.estadoPublicacion, "publicado")))
    .orderBy(asc(s.capitulos.numero));
}

/** Organizaciones y razas vinculadas a una nación (§ punto 3). */
export async function getNacionFacciones(nacionId: number) {
  const [organizaciones, razas] = await Promise.all([
    db
      .select({ id: s.organizaciones.id, nombre: s.organizaciones.nombre, imagenUrl: s.organizaciones.imagenUrl, tipo: s.nacionOrganizacion.tipo })
      .from(s.nacionOrganizacion)
      .innerJoin(s.organizaciones, eq(s.nacionOrganizacion.organizacionId, s.organizaciones.id))
      .where(and(eq(s.nacionOrganizacion.nacionId, nacionId), eq(s.organizaciones.estadoPublicacion, "publicado"))),
    db
      .select({ id: s.razas.id, nombre: s.razas.nombre, imagenUrl: s.razas.imagenUrl, tipo: s.nacionRaza.tipo })
      .from(s.nacionRaza)
      .innerJoin(s.razas, eq(s.nacionRaza.razaId, s.razas.id))
      .where(and(eq(s.nacionRaza.nacionId, nacionId), eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn))),
  ]);
  return { organizaciones, razas };
}

// ── Getters simples por id (prosa) ───────────────────────
async function firstVisible<T extends { id: unknown }>(
  rows: Promise<T[]>,
): Promise<T | undefined> {
  return (await rows)[0];
}

export async function getNacion(id: number) {
  return firstVisible(
    db.select().from(s.naciones).where(and(eq(s.naciones.id, id), eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn))).limit(1),
  );
}
export async function getRaza(id: number) {
  return firstVisible(
    db.select().from(s.razas).where(and(eq(s.razas.id, id), eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn))).limit(1),
  );
}
export async function getBestia(id: number) {
  return firstVisible(
    db.select().from(s.bestias).where(and(eq(s.bestias.id, id), eq(s.bestias.estadoPublicacion, "publicado"), isNull(s.bestias.eliminadoEn))).limit(1),
  );
}
export async function getMineral(id: number) {
  return firstVisible(
    db.select().from(s.minerales).where(and(eq(s.minerales.id, id), eq(s.minerales.estadoPublicacion, "publicado"), isNull(s.minerales.eliminadoEn))).limit(1),
  );
}
export async function getConcepto(id: number) {
  return firstVisible(
    db.select().from(s.conceptos).where(and(eq(s.conceptos.id, id), eq(s.conceptos.estadoPublicacion, "publicado"), isNull(s.conceptos.eliminadoEn))).limit(1),
  );
}
export async function getMision(id: number) {
  const mision = await firstVisible(
    db.select().from(s.misiones).where(and(eq(s.misiones.id, id), eq(s.misiones.estadoPublicacion, "publicado"), isNull(s.misiones.eliminadoEn))).limit(1),
  );
  if (!mision) return null;
  // Encargante: ficha de personaje si la tiene; si no, nombre libre.
  let encargante: { id: number; nombre: string } | null = null;
  if (mision.personajeId) {
    const [p] = await db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre })
      .from(s.personajes)
      .where(and(eq(s.personajes.id, mision.personajeId), isNull(s.personajes.eliminadoEn)))
      .limit(1);
    encargante = p ?? null;
  }
  return { ...mision, encargante };
}
export async function getLordDemonio(id: number) {
  return firstVisible(
    db.select().from(s.lordDemonio).where(and(eq(s.lordDemonio.id, id), eq(s.lordDemonio.estadoPublicacion, "publicado"), isNull(s.lordDemonio.eliminadoEn))).limit(1),
  );
}

export async function getArtefacto(id: number) {
  const artefacto = await firstVisible(
    db.select().from(s.armasArtefactos).where(and(eq(s.armasArtefactos.id, id), eq(s.armasArtefactos.estadoPublicacion, "publicado"), isNull(s.armasArtefactos.eliminadoEn))).limit(1),
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
    propietario = p ?? null;
  }
  return { ...artefacto, propietario };
}

/** Todas las monedas publicadas (la economía se muestra en una sola página). */
export async function getSistemaMonetario() {
  return db
    .select()
    .from(s.sistemaMonetario)
    .where(and(eq(s.sistemaMonetario.estadoPublicacion, "publicado"), isNull(s.sistemaMonetario.eliminadoEn)))
    .orderBy(asc(s.sistemaMonetario.nombre));
}

export async function getPaginaLore(slug: string) {
  return firstVisible(
    db.select().from(s.paginasLore).where(and(eq(s.paginasLore.slug, slug), eq(s.paginasLore.estadoPublicacion, "publicado"))).limit(1),
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
  return { pagina, secciones };
}

// ── Organización (con jerarquía y facciones) ─────────────
export async function getOrganizacionFicha(id: number) {
  const org = await firstVisible(
    db.select().from(s.organizaciones).where(and(eq(s.organizaciones.id, id), eq(s.organizaciones.estadoPublicacion, "publicado"))).limit(1),
  );
  if (!org) return null;

  const [jerRaw, facciones, historial, vinculados] = await Promise.all([
    db
      .select({
        id: s.orgJerarquia.id,
        nombreLibre: s.orgJerarquia.nombre,
        tituloApodo: s.orgJerarquia.tituloApodo,
        orden: s.orgJerarquia.orden,
        personajeId: s.personajes.id,
        personajeNombre: s.personajes.nombre,
        personajeImg: s.personajes.imagenUrl,
        rango: s.orgRangos.nombre,
        rangoPeso: s.orgRangos.peso,
      })
      .from(s.orgJerarquia)
      .leftJoin(s.personajes, eq(s.orgJerarquia.personajeId, s.personajes.id))
      .leftJoin(s.orgRangos, eq(s.orgJerarquia.rangoId, s.orgRangos.id))
      .where(eq(s.orgJerarquia.organizacionId, id))
      .orderBy(asc(s.orgJerarquia.orden)),
    db.select().from(s.orgFacciones).where(eq(s.orgFacciones.organizacionId, id)),
    db.select().from(s.orgHistorial).where(eq(s.orgHistorial.organizacionId, id)).orderBy(asc(s.orgHistorial.orden)),
    // Miembros vinculados desde la ficha de personaje (personaje_organizacion).
    db
      .select({ id: s.personajes.id, nombre: s.personajes.nombre, imagenUrl: s.personajes.imagenUrl, rol: s.personajeOrganizacion.rol })
      .from(s.personajeOrganizacion)
      .innerJoin(s.personajes, eq(s.personajeOrganizacion.personajeId, s.personajes.id))
      .where(and(eq(s.personajeOrganizacion.organizacionId, id), eq(s.personajes.estadoPublicacion, "publicado"), isNull(s.personajes.eliminadoEn)))
      .orderBy(asc(s.personajes.nombre)),
  ]);

  const jerarquia: FichaJerarquia[] = jerRaw.map((j) => ({
    id: j.id,
    nombre: j.personajeNombre ?? j.nombreLibre ?? null,
    tituloApodo: j.tituloApodo,
    tituloNobiliario: null,
    tituloFamilia: null,
    rango: j.rango,
    rangoPeso: j.rangoPeso,
    personajeId: j.personajeId,
    personajeImg: j.personajeImg,
  }));

  // Vinculados que no están ya en la jerarquía manual (evita duplicar).
  const enJerarquia = new Set(jerRaw.map((j) => j.personajeId).filter(Boolean));
  const vinculadosUnicos = vinculados.filter((v) => !enJerarquia.has(v.id));

  return { org, jerarquia, facciones, historial, vinculados: vinculadosUnicos };
}

// ── Familia (con árbol y jerarquía) ──────────────────────
export async function getFamiliaFicha(id: number) {
  const familia = await firstVisible(
    db.select().from(s.familias).where(and(eq(s.familias.id, id), eq(s.familias.estadoPublicacion, "publicado"))).limit(1),
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

  const jerarquiaFicha: FichaJerarquia[] = jerarquia.map((j) => ({
    id: j.id,
    nombre: j.personajeNombre ?? j.nombreLibre ?? null,
    tituloApodo: null,
    tituloNobiliario: j.tituloNobiliario,
    tituloFamilia: j.tituloFamilia,
    rango: j.rango,
    rangoPeso: j.rangoPeso,
    personajeId: j.personajeId,
    personajeImg: j.personajeImg,
  }));

  return { familia, arbol, jerarquia: jerarquiaFicha, facciones };
}

// ── Gremio (singleton, sin estado_publicacion) ───────────
export async function getGremioFicha() {
  const [gremio] = await db.select().from(s.gremio).limit(1);
  if (!gremio) return null;
  const gid = gremio.id;
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
  const jerarquia: FichaJerarquia[] = jerRaw.map((j) => ({
    id: j.id,
    nombre: j.personajeNombre ?? j.nombreLibre ?? null,
    tituloApodo: j.tituloApodo,
    tituloNobiliario: null,
    tituloFamilia: null,
    rango: j.rango,
    rangoPeso: j.rangoPeso,
    personajeId: j.personajeId,
    personajeImg: j.personajeImg,
  }));
  return { gremio, rangos, facciones, jerarquia, historial };
}

// ── generateStaticParams helpers (ids visibles) ──────────
export async function getVisibleIds(
  key: "personajes" | "naciones" | "organizaciones" | "familias" | "razas" | "bestias" | "minerales" | "conceptos" | "magia" | "misiones" | "demonios" | "artefactos",
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
