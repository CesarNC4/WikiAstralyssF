import "server-only";
import { and, asc, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/** Entrada de magia para la vista índice (§ puntos 11-12). */
export interface MagiaIndexItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  naturaleza: string | null;
  tipo: string | null;
  subcategoria: string | null;
  imagenUrl: string | null;
}

/** Todas las entradas de magia publicadas, ordenadas, para el explorador. */
export async function listMagiaIndex(): Promise<MagiaIndexItem[]> {
  const rows = await db
    .select({
      id: s.magiaFundamentos.id,
      nombre: s.magiaFundamentos.nombre,
      descripcion: s.magiaFundamentos.descripcion,
      naturaleza: s.magiaFundamentos.naturaleza,
      tipo: s.magiaFundamentos.tipo,
      subcategoria: s.magiaFundamentos.subcategoria,
      imagenUrl: s.magiaFundamentos.imagenUrl,
    })
    .from(s.magiaFundamentos)
    .where(
      and(
        eq(s.magiaFundamentos.estadoPublicacion, "publicado"),
        isNull(s.magiaFundamentos.eliminadoEn),
      ),
    )
    .orderBy(asc(s.magiaFundamentos.orden), asc(s.magiaFundamentos.nombre));
  return rows;
}

/** Ficha de magia: la entrada + personajes que la usan + relacionadas + jerarquía. */
export async function getMagiaFicha(id: number) {
  const [magia] = await db
    .select()
    .from(s.magiaFundamentos)
    .where(
      and(
        eq(s.magiaFundamentos.id, id),
        eq(s.magiaFundamentos.estadoPublicacion, "publicado"),
        isNull(s.magiaFundamentos.eliminadoEn),
      ),
    )
    .limit(1);
  if (!magia) return null;

  // Personajes cuyas habilidades referencian este fundamento.
  const personajes = await db
    .selectDistinct({
      id: s.personajes.id,
      nombre: s.personajes.nombre,
      surname: s.personajes.surname,
      imagenUrl: s.personajes.imagenUrl,
      habilidad: s.habilidades.nombre,
    })
    .from(s.habilidades)
    .innerJoin(s.personajes, eq(s.habilidades.personajeId, s.personajes.id))
    .where(
      and(
        eq(s.habilidades.magiaFundamentoId, id),
        eq(s.personajes.estadoPublicacion, "publicado"),
        isNull(s.personajes.eliminadoEn),
      ),
    )
    .orderBy(asc(s.personajes.nombre));

  // Magias relacionadas: mismo elemento o mismo tipo (excluyendo la actual).
  const matchers = [
    magia.subcategoria ? eq(s.magiaFundamentos.subcategoria, magia.subcategoria) : undefined,
    magia.tipo ? eq(s.magiaFundamentos.tipo, magia.tipo) : undefined,
  ].filter(Boolean);
  const relacionadas =
    matchers.length > 0
      ? await db
          .select({
            id: s.magiaFundamentos.id,
            nombre: s.magiaFundamentos.nombre,
            naturaleza: s.magiaFundamentos.naturaleza,
            tipo: s.magiaFundamentos.tipo,
            subcategoria: s.magiaFundamentos.subcategoria,
            imagenUrl: s.magiaFundamentos.imagenUrl,
          })
          .from(s.magiaFundamentos)
          .where(
            and(
              eq(s.magiaFundamentos.estadoPublicacion, "publicado"),
              isNull(s.magiaFundamentos.eliminadoEn),
              ne(s.magiaFundamentos.id, id),
              or(...matchers),
            ),
          )
          .orderBy(asc(s.magiaFundamentos.nombre))
          .limit(8)
      : [];

  // Jerarquía: fundamento padre e hijos directos.
  const padre = magia.fundamentoPadreId
    ? (
        await db
          .select({ id: s.magiaFundamentos.id, nombre: s.magiaFundamentos.nombre })
          .from(s.magiaFundamentos)
          .where(eq(s.magiaFundamentos.id, magia.fundamentoPadreId))
          .limit(1)
      )[0] ?? null
    : null;

  const hijos = await db
    .select({
      id: s.magiaFundamentos.id,
      nombre: s.magiaFundamentos.nombre,
      naturaleza: s.magiaFundamentos.naturaleza,
      tipo: s.magiaFundamentos.tipo,
      subcategoria: s.magiaFundamentos.subcategoria,
      imagenUrl: s.magiaFundamentos.imagenUrl,
    })
    .from(s.magiaFundamentos)
    .where(
      and(
        eq(s.magiaFundamentos.fundamentoPadreId, id),
        eq(s.magiaFundamentos.estadoPublicacion, "publicado"),
        isNull(s.magiaFundamentos.eliminadoEn),
      ),
    )
    .orderBy(asc(s.magiaFundamentos.nombre));

  return { magia, personajes, relacionadas, padre, hijos };
}

export type MagiaFicha = NonNullable<Awaited<ReturnType<typeof getMagiaFicha>>>;

/**
 * Resuelve nombres de magia (p.ej. la magia principal/secundaria de un personaje)
 * a sus fichas publicadas. Devuelve un mapa nombre-normalizado → id.
 */
export async function resolveMagiaLinks(nombres: (string | null | undefined)[]): Promise<Map<string, number>> {
  const limpios = [...new Set(nombres.filter((n): n is string => !!n && n.trim() !== ""))];
  if (limpios.length === 0) return new Map();
  const rows = await db
    .select({ id: s.magiaFundamentos.id, nombre: s.magiaFundamentos.nombre })
    .from(s.magiaFundamentos)
    .where(
      and(
        eq(s.magiaFundamentos.estadoPublicacion, "publicado"),
        isNull(s.magiaFundamentos.eliminadoEn),
      ),
    );
  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const wanted = new Set(limpios.map(norm));
  const out = new Map<string, number>();
  for (const r of rows) {
    const key = norm(r.nombre);
    if (wanted.has(key) && !out.has(key)) out.set(key, r.id);
  }
  return out;
}

/** Opciones (id + label) para el campo de referencia 'fundamento padre' del admin. */
export async function listMagiaOpciones(): Promise<{ id: number; label: string }[]> {
  const rows = await db
    .select({ id: s.magiaFundamentos.id, nombre: s.magiaFundamentos.nombre, naturaleza: s.magiaFundamentos.naturaleza })
    .from(s.magiaFundamentos)
    .where(isNull(s.magiaFundamentos.eliminadoEn))
    .orderBy(asc(s.magiaFundamentos.nombre));
  return rows.map((r) => ({
    id: r.id,
    label: r.naturaleza ? `${r.nombre} · ${r.naturaleza}` : r.nombre,
  }));
}
