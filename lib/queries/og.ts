import "server-only";
import { db } from "@/db/client";

/**
 * Consultas mínimas para las imágenes Open Graph (§11): solo nombre, subtítulo
 * e imagen, filtrando contenido publicado. No cargan relaciones (a diferencia de
 * las queries de ficha) porque la imagen OG solo necesita la cabecera.
 */

export interface OgFichaData {
  tipo: string;
  titulo: string;
  subtitulo: string | null;
  imagenUrl: string | null;
  acento: string;
}

interface OgCfg {
  accessor: string; // clave en db.query
  tipo: string;
  acento: string;
  cols: Record<string, true>;
  name: (r: Record<string, unknown>) => string;
  sub: (r: Record<string, unknown>) => string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const OG: Record<string, OgCfg> = {
  personajes: {
    accessor: "personajes",
    tipo: "Personaje",
    acento: "#7b5cff",
    cols: { nombre: true, surname: true, titulo: true, subtitulo: true, imagenUrl: true },
    name: (r) => [str(r.nombre), str(r.surname)].filter(Boolean).join(" ") || String(r.nombre ?? ""),
    sub: (r) => str(r.subtitulo) ?? str(r.titulo),
  },
  naciones: {
    accessor: "naciones", tipo: "Nación", acento: "#2dd4bf",
    cols: { nombre: true, subtitulo: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.subtitulo),
  },
  organizaciones: {
    accessor: "organizaciones", tipo: "Organización", acento: "#ffd66b",
    cols: { nombre: true, subtitulo: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.subtitulo),
  },
  familias: {
    accessor: "familias", tipo: "Familia", acento: "#ff8c5a",
    cols: { nombre: true, subtitulo: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.subtitulo),
  },
  razas: {
    accessor: "razas", tipo: "Raza", acento: "#2dd4bf",
    cols: { nombre: true, subtitulo: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.subtitulo),
  },
  bestias: {
    accessor: "bestias", tipo: "Bestia", acento: "#f87171",
    cols: { nombre: true, subtitulo: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.subtitulo),
  },
  minerales: {
    accessor: "minerales", tipo: "Mineral", acento: "#60a5fa",
    cols: { nombre: true, tipo: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.tipo),
  },
  conceptos: {
    accessor: "conceptos", tipo: "Concepto", acento: "#9d7bff",
    cols: { nombre: true, categoria: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.categoria),
  },
  magia: {
    accessor: "magiaFundamentos", tipo: "Magia", acento: "#7b5cff",
    cols: { nombre: true, categoria: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.categoria),
  },
  misiones: {
    accessor: "misiones", tipo: "Misión", acento: "#fbbf24",
    cols: { nombre: true, tipo: true, imagenUrl: true },
    name: (r) => String(r.nombre ?? ""), sub: (r) => str(r.tipo),
  },
};

/** OG de una ficha por id (entidades con id numérico). */
export async function getOgFicha(key: string, id: number): Promise<OgFichaData | null> {
  const cfg = OG[key];
  if (!cfg) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (db.query as any)[cfg.accessor];
  if (!q) return null;
  const row = await q.findFirst({
    columns: cfg.cols,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: (t: any, h: any) => h.and(h.eq(t.id, id), h.eq(t.estadoPublicacion, "publicado"), h.isNull(t.eliminadoEn)),
  });
  if (!row) return null;
  return { tipo: cfg.tipo, titulo: cfg.name(row), subtitulo: cfg.sub(row), imagenUrl: str(row.imagenUrl), acento: cfg.acento };
}

/** OG de una página de lore por slug. */
export async function getOgLore(slug: string): Promise<OgFichaData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (db.query as any).paginasLore.findFirst({
    columns: { titulo: true, subtitulo: true, imagenUrl: true },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: (t: any, h: any) => h.and(h.eq(t.slug, slug), h.eq(t.estadoPublicacion, "publicado"), h.isNull(t.eliminadoEn)),
  });
  if (!row) return null;
  return {
    tipo: "Lore",
    titulo: str(row.titulo) ?? "Astralys",
    subtitulo: str(row.subtitulo),
    imagenUrl: str(row.imagenUrl),
    acento: "#ffd66b",
  };
}
