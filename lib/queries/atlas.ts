import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

export type AtlasTipo = "naciones" | "razas" | "bestias" | "minerales" | "organizaciones";

export interface AtlasNodo {
  id: string;
  tipo: AtlasTipo;
  label: string;
  img: string | null;
  href: string;
}
export interface AtlasArista {
  a: string;
  b: string;
  tipo: string;
}

const VIS = { estadoPublicacion: "publicado" } as const;

/** Nodos + aristas del grafo global del mundo (solo publicados). */
export async function getAtlas(): Promise<{ nodos: AtlasNodo[]; aristas: AtlasArista[] }> {
  const [naciones, razas, bestias, minerales, organizaciones] = await Promise.all([
    db.select({ id: s.naciones.id, nombre: s.naciones.nombre, img: s.naciones.imagenUrl }).from(s.naciones).where(and(eq(s.naciones.estadoPublicacion, VIS.estadoPublicacion), isNull(s.naciones.eliminadoEn))),
    db.select({ id: s.razas.id, nombre: s.razas.nombre, img: s.razas.imagenUrl, padre: s.razas.razaPadreId }).from(s.razas).where(and(eq(s.razas.estadoPublicacion, VIS.estadoPublicacion), isNull(s.razas.eliminadoEn))),
    db.select({ id: s.bestias.id, nombre: s.bestias.nombre, img: s.bestias.imagenUrl }).from(s.bestias).where(and(eq(s.bestias.estadoPublicacion, VIS.estadoPublicacion), isNull(s.bestias.eliminadoEn))),
    db.select({ id: s.minerales.id, nombre: s.minerales.nombre, img: s.minerales.imagenUrl }).from(s.minerales).where(and(eq(s.minerales.estadoPublicacion, VIS.estadoPublicacion), isNull(s.minerales.eliminadoEn))),
    db.select({ id: s.organizaciones.id, nombre: s.organizaciones.nombre, img: s.organizaciones.imagenUrl }).from(s.organizaciones).where(eq(s.organizaciones.estadoPublicacion, VIS.estadoPublicacion)),
  ]);

  const nodos: AtlasNodo[] = [
    ...naciones.map((n): AtlasNodo => ({ id: `n${n.id}`, tipo: "naciones", label: n.nombre, img: n.img, href: `/naciones/${n.id}` })),
    ...razas.map((r): AtlasNodo => ({ id: `r${r.id}`, tipo: "razas", label: r.nombre, img: r.img, href: `/razas/${r.id}` })),
    ...bestias.map((b): AtlasNodo => ({ id: `b${b.id}`, tipo: "bestias", label: b.nombre, img: b.img, href: `/bestias/${b.id}` })),
    ...minerales.map((m): AtlasNodo => ({ id: `m${m.id}`, tipo: "minerales", label: m.nombre, img: m.img, href: `/minerales/${m.id}` })),
    ...organizaciones.map((o): AtlasNodo => ({ id: `o${o.id}`, tipo: "organizaciones", label: o.nombre, img: o.img, href: `/organizaciones/${o.id}` })),
  ];
  const existe = new Set(nodos.map((n) => n.id));

  const [nr, no, bn, bd, diplo] = await Promise.all([
    db.select({ a: s.nacionRaza.nacionId, b: s.nacionRaza.razaId }).from(s.nacionRaza),
    db.select({ a: s.nacionOrganizacion.nacionId, b: s.nacionOrganizacion.organizacionId }).from(s.nacionOrganizacion),
    db.select({ a: s.bestiaNacion.bestiaId, b: s.bestiaNacion.nacionId }).from(s.bestiaNacion),
    db.select({ a: s.bestiaDrop.bestiaId, b: s.bestiaDrop.mineralId }).from(s.bestiaDrop),
    db.select({ a: s.nacionDiplomacia.nacionId, b: s.nacionDiplomacia.otraNacionId }).from(s.nacionDiplomacia),
  ]);

  const aristas: AtlasArista[] = [];
  const push = (a: string, b: string, tipo: string) => {
    if (existe.has(a) && existe.has(b) && a !== b) aristas.push({ a, b, tipo });
  };
  nr.forEach((e) => push(`n${e.a}`, `r${e.b}`, "habita"));
  no.forEach((e) => push(`n${e.a}`, `o${e.b}`, "organizacion"));
  bn.forEach((e) => push(`b${e.a}`, `n${e.b}`, "habitat"));
  bd.forEach((e) => push(`b${e.a}`, `m${e.b}`, "drop"));
  diplo.forEach((e) => push(`n${e.a}`, `n${e.b}`, "diplomacia"));
  razas.forEach((r) => { if (r.padre) push(`r${r.id}`, `r${r.padre}`, "linaje"); });

  return { nodos, aristas };
}
