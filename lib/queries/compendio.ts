import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

export interface CompendioRow {
  id: number;
  nombre: string;
  imagenUrl: string | null;
  /** Atributos cortos (clasificación, rareza…) y stats numéricos por clave. */
  attrs: Record<string, string | null>;
  stats: Record<string, number | null>;
}

export async function getCompendio() {
  const [bestias, minerales, razas, naciones] = await Promise.all([
    db.select().from(s.bestias).where(and(eq(s.bestias.estadoPublicacion, "publicado"), isNull(s.bestias.eliminadoEn))).orderBy(asc(s.bestias.nombre)),
    db.select().from(s.minerales).where(and(eq(s.minerales.estadoPublicacion, "publicado"), isNull(s.minerales.eliminadoEn))).orderBy(asc(s.minerales.nombre)),
    db.select().from(s.razas).where(and(eq(s.razas.estadoPublicacion, "publicado"), isNull(s.razas.eliminadoEn))).orderBy(asc(s.razas.nombre)),
    db.select().from(s.naciones).where(and(eq(s.naciones.estadoPublicacion, "publicado"), isNull(s.naciones.eliminadoEn))).orderBy(asc(s.naciones.nombre)),
  ]);

  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

  return {
    bestias: bestias.map((b): CompendioRow => ({
      id: b.id,
      nombre: b.nombre,
      imagenUrl: b.imagenUrl,
      attrs: { nivelAmenaza: b.nivelAmenaza, categoria: b.categoria, tamano: b.tamano, dieta: b.dieta },
      stats: {
        statFuerza: num(b.statFuerza), statVelocidad: num(b.statVelocidad), statResistencia: num(b.statResistencia), statPoderMagico: num(b.statPoderMagico),
        statPeligrosidad: num(b.statPeligrosidad), statRareza: num(b.statRareza), statTerritorialidad: num(b.statTerritorialidad),
      },
    })),
    minerales: minerales.map((m): CompendioRow => ({
      id: m.id,
      nombre: m.nombre,
      imagenUrl: m.imagenUrl,
      attrs: { rareza: m.rareza, tipo: m.tipo, elemento: m.elemento },
      stats: {
        statDureza: num(m.statDureza), statPureza: num(m.statPureza), statConductividad: num(m.statConductividad),
        statRareza: num(m.statRareza), statValor: num(m.statValor), statDemanda: num(m.statDemanda), statAbundancia: num(m.statAbundancia),
      },
    })),
    razas: razas.map((r): CompendioRow => ({
      id: r.id,
      nombre: r.nombre,
      imagenUrl: r.imagenUrl,
      attrs: { clasificacion: r.clasificacion, afinidad: r.afinidad, dieta: r.dieta },
      stats: {
        statLongevidad: num(r.statLongevidad), statAfinidadMagica: num(r.statAfinidadMagica), statFuerza: num(r.statFuerza), statAgilidad: num(r.statAgilidad), statAdaptabilidad: num(r.statAdaptabilidad),
        statDispersion: num(r.statDispersion), statPurezaLinaje: num(r.statPurezaLinaje),
      },
    })),
    naciones: naciones.map((n): CompendioRow => ({
      id: n.id,
      nombre: n.nombre,
      imagenUrl: n.imagenUrl,
      attrs: { gobierno: n.gobierno, clima: n.clima, elementoFundamental: n.elementoFundamental },
      stats: {
        poderMilitarNivel: num(n.poderMilitarNivel), poderEconomicoNivel: num(n.poderEconomicoNivel), poderPoliticoNivel: num(n.poderPoliticoNivel),
        poderMagicoNivel: num(n.poderMagicoNivel), poderTecnologicoNivel: num(n.poderTecnologicoNivel),
      },
    })),
  };
}

export type CompendioData = Awaited<ReturnType<typeof getCompendio>>;
