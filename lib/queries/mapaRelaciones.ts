import "server-only";
import { eq, sql, getTableColumns, getTableName } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { rutaEditor } from "@/lib/admin/taller";
import { CUALQUIERA, RELACIONES } from "@/lib/relaciones/registro";
import { infoDe, tablaDe } from "@/lib/relaciones/tablas";
import type { RelacionDef } from "@/lib/relaciones/tipos";
import { getCategoriasRelacion } from "./categoriasRelacion";
import type { CategoriaRelacion } from "@/lib/relaciones/categorias";

/**
 * El grafo del mundo (spec §11): lo comparten el Atlas público y el mapa de
 * relaciones del taller.
 *
 * Sale del registro de relaciones en una sola sentencia: cada relación aporta
 * su rama del UNION ALL, con el id de la relación y el de la fila (para poder
 * editarla) y el campo destacado (el "tipo": "Rival", "Ciudadano"…).
 *
 *  - En el taller entran todas las fichas fuera de la papelera, publicadas o
 *    no, conectadas o sueltas, y enlazan a su editor.
 *  - En público solo las publicadas que conectan con algo (doscientos puntos
 *    sueltos no dicen nada), enlazadas a su ficha.
 */

export interface NodoMapa {
  /** "personajes:12" */
  id: string;
  tipo: string;
  entidadId: number;
  label: string;
  img: string | null;
  /** Editor en el taller; ficha pública en el Atlas. */
  href: string;
  publicado: boolean;
}

export interface AristaMapa {
  /** "relaciones:57": relación del registro y fila. */
  id: string;
  relId: string;
  fila: number;
  /** Lado A y lado B de la relación, como en el registro. */
  a: string;
  b: string;
  /** Valor del campo destacado ("Rival", "Ciudadano"…), si lo tiene. */
  matiz: string | null;
}

type Cols = Record<string, PgColumn>;
const columna = (t: PgTable, clave: string) => (getTableColumns(t) as unknown as Cols)[clave].name;

interface Bruta {
  at: string;
  a: number;
  bt: string;
  b: number;
  rel: string;
  fila: number;
  matiz: string | null;
}

function consulta() {
  const ramas = [];
  for (const rel of RELACIONES) {
    if (rel.fueraDelAtlas || rel.medio === "vinculo") continue;
    if (rel.medio === "referencia") {
      const info = infoDe(rel.a.entidad);
      if (!info || !rel.columna) continue;
      const tabla = sql.identifier(getTableName(info.tabla));
      const col = sql.identifier(columna(info.tabla, rel.columna));
      const papelera = info.papelera ? sql` and eliminado_en is null` : sql``;
      ramas.push(sql`
        select ${rel.a.entidad}::text as at, id::int as a, ${rel.b.entidad}::text as bt, ${col}::int as b,
               ${rel.id}::text as rel, id::int as fila, null::text as matiz
          from ${tabla} where ${col} is not null${papelera}`);
      continue;
    }
    if (rel.a.entidad === CUALQUIERA || rel.b.entidad === CUALQUIERA) continue;
    const def = tablaDe(rel.id);
    if (!def) continue;
    const tabla = sql.identifier(getTableName(def.tabla));
    const colA = sql.identifier(columna(def.tabla, def.colA));
    const colB = sql.identifier(columna(def.tabla, def.colB));
    const pk = sql.identifier(columna(def.tabla, def.pk));
    const destacado = rel.campos.find((c) => c.destacado);
    const matiz = destacado ? sql`${sql.identifier(columna(def.tabla, destacado.name))}::text` : sql`null::text`;
    const filtro = def.filtroA ? sql` and ${sql.identifier(columna(def.tabla, def.filtroA.col))} = ${def.filtroA.valor}` : sql``;
    ramas.push(sql`
      select ${rel.a.entidad}::text as at, ${colA}::int as a, ${rel.b.entidad}::text as bt, ${colB}::int as b,
             ${rel.id}::text as rel, ${pk}::int as fila, ${matiz} as matiz
        from ${tabla}
       where ${colA} is not null and ${colB} is not null${filtro}`);
  }
  ramas.push(sql`
    select origen_tipo as at, origen_id as a, destino_tipo as bt, destino_id as b,
           'v:' || relacion as rel, id as fila, tipo as matiz
      from vinculo`);
  return sql.join(ramas, sql` union all `);
}

/** La relación del registro a la que pertenece una fila de `vinculo`. */
function relDeVinculo(relacion: string, at: string, bt: string): RelacionDef | undefined {
  const encaja = (decl: string, real: string) => decl === CUALQUIERA || decl === real;
  return RELACIONES.find(
    (r) => r.medio === "vinculo" && !r.fueraDelAtlas && (r.relacion ?? r.id) === relacion && encaja(r.a.entidad, at) && encaja(r.b.entidad, bt),
  );
}

export async function getMapaRelaciones({ publico = false }: { publico?: boolean } = {}): Promise<{
  nodos: NodoMapa[];
  aristas: AristaMapa[];
  categorias: CategoriaRelacion[];
  /** Valor de `tipo_relacion` → id de su categoría. */
  categoriaDeTipo: Record<string, number>;
}> {
  const [brutas, fichas, cats] = await Promise.all([
    db.execute(consulta()) as unknown as Promise<Bruta[]>,
    // El índice de búsqueda ya tiene nombre, imagen y estado de todas las fichas
    // fuera de la papelera, publicadas o no.
    db
      .select({
        tipo: s.searchIndex.entidadTipo,
        id: s.searchIndex.entidadId,
        label: s.searchIndex.titulo,
        img: s.searchIndex.imagenUrl,
        url: s.searchIndex.url,
        estado: s.searchIndex.estadoPublicacion,
      })
      .from(s.searchIndex)
      .where(publico ? eq(s.searchIndex.estadoPublicacion, "publicado") : undefined),
    getCategoriasRelacion(),
  ]);

  const nodos = new Map<string, NodoMapa>();
  for (const f of fichas) {
    const id = Number(f.id);
    if (!Number.isFinite(id)) continue;
    const clave = `${f.tipo}:${id}`;
    nodos.set(clave, {
      id: clave,
      tipo: f.tipo,
      entidadId: id,
      label: f.label,
      img: f.img,
      href: publico ? f.url : rutaEditor(f.tipo, id),
      publicado: f.estado === "publicado",
    });
  }

  const aristas: AristaMapa[] = [];
  const vistas = new Set<string>();
  for (const e of brutas) {
    // Las filas de `vinculo` llegan con "v:" delante de su columna `relacion`.
    const rel = e.rel.startsWith("v:") ? relDeVinculo(e.rel.slice(2), e.at, e.bt)?.id : e.rel;
    if (!rel) continue;
    const a = `${e.at}:${e.a}`;
    const b = `${e.bt}:${e.b}`;
    if (a === b || !nodos.has(a) || !nodos.has(b)) continue;
    // Una relación recíproca guarda dos filas; en el mapa es una sola línea.
    const par = a < b ? `${a}|${b}|${rel}` : `${b}|${a}|${rel}`;
    if (vistas.has(par)) continue;
    vistas.add(par);
    aristas.push({ id: `${rel}:${e.fila}`, relId: rel, fila: Number(e.fila), a, b, matiz: e.matiz?.trim() || null });
  }

  const categoriaDeTipo: Record<string, number> = {};
  for (const t of cats.tipos) if (t.categoriaId != null) categoriaDeTipo[t.valor] = t.categoriaId;

  let lista = [...nodos.values()];
  if (publico) {
    const usados = new Set(aristas.flatMap((x) => [x.a, x.b]));
    lista = lista.filter((n) => usados.has(n.id));
  }
  return { nodos: lista, aristas, categorias: cats.categorias, categoriaDeTipo };
}
