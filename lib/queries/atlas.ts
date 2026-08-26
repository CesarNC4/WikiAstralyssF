import "server-only";
import { eq, sql, getTableColumns, getTableName } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { relacionesDelAtlas, CUALQUIERA } from "@/lib/relaciones/registro";
import { tablaDe } from "@/lib/relaciones/tablas";
import { entityByKey } from "@/lib/entities";

/**
 * Grafo global del mundo, construido a partir del registro de relaciones.
 *
 * Antes estaba cableado a mano: cinco tipos de nodo y cinco de arista, sin
 * personajes pese a ser la sección más poblada. Ahora cada relación declarada
 * aporta sus aristas sola.
 *
 * Se resuelve en **dos consultas**. Una primera versión hacía una por relación y
 * otra por entidad —más de cuarenta— y contra esta base, donde una consulta
 * trivial ronda el medio segundo, la página tardaba minutos. Ahora las aristas
 * salen de un único UNION ALL y los nodos de `search_index`, que ya guarda
 * título, imagen, URL y estado de publicación de todas las entidades.
 */

export type AtlasTipo = string;

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

/** Leyenda del grafo: qué tipos hay y cómo se pintan. */
export interface AtlasTipoMeta {
  key: AtlasTipo;
  label: string;
  color: string;
  icon: string;
}

/** Color por entidad. Los tokens del diseño son clases; aquí hace falta el hex. */
const COLOR: Record<string, string> = {
  personajes: "#8b7bff",
  naciones: "#7b5cff",
  razas: "#9b8cff",
  bestias: "#ef6f6f",
  minerales: "#6fc3d6",
  organizaciones: "#5b8def",
  familias: "#e0a44a",
  artefactos: "#d8a05f",
  locaciones: "#5fb98f",
  regiones: "#4f9d7e",
  misiones: "#e6b450",
  conceptos: "#c08bff",
  magia: "#a78bfa",
  lore: "#8ab4f8",
  demonios: "#e05252",
  timeline: "#9aa3b2",
};

type Cols = Record<string, PgColumn>;
const columna = (t: PgTable, clave: string) => (getTableColumns(t) as unknown as Cols)[clave].name;

const nid = (tipo: string, id: number | string) => `${tipo}:${id}`;

interface AristaBruta {
  at: string;
  a: number;
  bt: string;
  b: number;
  tipo: string;
}

/**
 * Una sola sentencia con todas las aristas del mundo: cada relación aporta una
 * rama del UNION ALL, así que declarar una relación nueva la mete en el grafo
 * sin tocar nada de aquí.
 */
function consultaDeAristas() {
  const ramas = [];

  for (const rel of relacionesDelAtlas()) {
    if (rel.medio === "vinculo") continue; // van juntas en una rama aparte
    if (rel.a.entidad === CUALQUIERA || rel.b.entidad === CUALQUIERA) continue;
    const def = tablaDe(rel.id);
    if (!def) continue;

    const tabla = sql.identifier(getTableName(def.tabla));
    const colA = sql.identifier(columna(def.tabla, def.colA));
    const colB = sql.identifier(columna(def.tabla, def.colB));
    const filtro = def.filtroA
      ? sql` and ${sql.identifier(columna(def.tabla, def.filtroA.col))} = ${def.filtroA.valor}`
      : sql``;

    ramas.push(sql`
      select ${rel.a.entidad}::text as at, ${colA}::int as a,
             ${rel.b.entidad}::text as bt, ${colB}::int as b,
             ${rel.id}::text as tipo
        from ${tabla}
       where ${colA} is not null and ${colB} is not null${filtro}`);
  }

  const genericas = relacionesDelAtlas()
    .filter((r) => r.medio === "vinculo")
    .map((r) => r.relacion ?? r.id);
  if (genericas.length > 0) {
    ramas.push(sql`
      select origen_tipo as at, origen_id as a, destino_tipo as bt, destino_id as b, relacion as tipo
        from vinculo
       where relacion in (${sql.join(genericas.map((x) => sql`${x}`), sql`, `)})`);
  }

  // El linaje de sub-razas es una referencia simple, no una tabla N:M, pero en
  // el grafo cuenta igual.
  ramas.push(sql`
    select 'razas'::text as at, id::int as a, 'razas'::text as bt, raza_padre_id::int as b, 'linaje'::text as tipo
      from razas where raza_padre_id is not null`);

  return sql.join(ramas, sql` union all `);
}

export async function getAtlas(): Promise<{
  nodos: AtlasNodo[];
  aristas: AtlasArista[];
  tipos: AtlasTipoMeta[];
}> {
  const [brutas, fichas] = await Promise.all([
    db.execute(consultaDeAristas()) as unknown as Promise<AristaBruta[]>,
    db
      .select({
        tipo: s.searchIndex.entidadTipo,
        id: s.searchIndex.entidadId,
        label: s.searchIndex.titulo,
        img: s.searchIndex.imagenUrl,
        href: s.searchIndex.url,
      })
      .from(s.searchIndex)
      .where(eq(s.searchIndex.estadoPublicacion, "publicado")),
  ]);

  // `search_index` es la única fuente de nodos: si una ficha no está ahí, el
  // público no puede verla y sus aristas tampoco deben dibujarse.
  const visible = new Map<string, AtlasNodo>();
  for (const f of fichas) {
    const clave = nid(f.tipo, f.id);
    visible.set(clave, { id: clave, tipo: f.tipo, label: f.label, img: f.img, href: f.href });
  }

  const aristas: AtlasArista[] = [];
  const vistas = new Set<string>();
  const usados = new Set<string>();

  for (const e of brutas) {
    const a = nid(e.at, e.a);
    const b = nid(e.bt, e.b);
    if (a === b || !visible.has(a) || !visible.has(b)) continue;
    // Una relación recíproca guarda dos filas; en el grafo es una sola arista.
    const clave = a < b ? `${a}|${b}|${e.tipo}` : `${b}|${a}|${e.tipo}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    aristas.push({ a, b, tipo: e.tipo });
    usados.add(a);
    usados.add(b);
  }

  // Sólo entran las fichas que conectan con algo: doscientos puntos sueltos no
  // dicen nada y hacen ilegible lo que sí está conectado.
  const nodos = [...usados].map((k) => visible.get(k)!);

  const conNodos = new Set(nodos.map((n) => n.tipo));
  const tipos: AtlasTipoMeta[] = [...conNodos]
    .map((key) => {
      const meta = entityByKey(key);
      return { key, label: meta?.plural ?? key, color: COLOR[key] ?? "#9aa3b2", icon: meta?.icon ?? "Circle" };
    })
    .sort((x, y) => x.label.localeCompare(y.label));

  return { nodos, aristas, tipos };
}
