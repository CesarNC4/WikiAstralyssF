import "server-only";
import { getTableColumns, getTableName, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { ENTIDAD_INFO } from "@/lib/relaciones/tablas";

/** Dónde se usa una imagen: «Banner de <ficha>», «Imagen de <ficha>», «Galería de <ficha>». */
export type UsosDeImagen = Map<number, string[]>;

/** postgres-js devuelve el array de filas directamente; otros drivers, `{ rows }`. */
function filas<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as T[];
}

const ROL: Record<string, string> = { imagen_asset_id: "Imagen", banner_asset_id: "Banner", imagen_url: "Imagen", banner_url: "Banner" };

/**
 * Qué fichas usan cada imagen de `media_assets`, con su nombre. Lo usa el panel
 * para elegir una imagen ya subida en vez de subirla otra vez.
 *
 * Las columnas se buscan en `information_schema`, igual que la purga
 * (`lib/media/purga.ts`): varias tablas las tienen en la base sin declararlas en
 * Drizzle. Cuenta también la dirección guardada sin id (`imagen_url`, `banner_url`),
 * como la purga. Así, lo que aquí sale «en uso» es exactamente lo que la purga respeta.
 * Solo para el admin: incluye fichas ocultas y en borrador.
 */
export async function usosDeImagenes(): Promise<UsosDeImagen> {
  const columnas = filas<{ table_name: string; column_name: string }>(
    await db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public' and column_name in ('imagen_asset_id', 'banner_asset_id', 'imagen_url', 'banner_url')
        and table_name <> 'search_index'
      order by table_name, column_name
    `),
  );

  // Tabla de la base → columna con el nombre de la ficha («nombre», «titulo»…).
  const etiquetaDe = new Map<string, string>();
  for (const info of Object.values(ENTIDAD_INFO)) {
    const col = (getTableColumns(info.tabla) as Record<string, { name: string }>)[info.label];
    if (col) etiquetaDe.set(getTableName(info.tabla), col.name);
  }

  const partes: SQL[] = [];
  for (const c of columnas) {
    const col = sql.identifier(c.column_name);
    const etiqueta = etiquetaDe.get(c.table_name);
    const nombre = etiqueta ? sql`x.${sql.identifier(etiqueta)}::text` : sql`'#' || x.id::text`;
    const tabla = sql.identifier(c.table_name);
    partes.push(
      c.column_name.endsWith("_asset_id")
        ? sql`select x.${col} as asset, ${ROL[c.column_name]}::text as rol, ${nombre} as nombre
              from ${tabla} x where x.${col} is not null`
        : sql`select m.id as asset, ${ROL[c.column_name]}::text as rol, ${nombre} as nombre
              from ${tabla} x join media_assets m on m.url_publica = x.${col}`,
    );
  }

  const usos: UsosDeImagen = new Map();
  const anotar = (asset: number, texto: string) => {
    const lista = usos.get(asset) ?? [];
    if (!lista.includes(texto)) lista.push(texto);
    usos.set(asset, lista);
  };

  if (partes.length) {
    const rows = filas<{ asset: number; rol: string; nombre: string | null }>(
      await db.execute(sql.join(partes, sql` union all `)),
    );
    for (const r of rows) anotar(Number(r.asset), `${r.rol} de ${r.nombre ?? "una ficha sin nombre"}`);
  }

  // La galería: entidad_media guarda el tipo y el id; el nombre se busca por tipo.
  const galeria = filas<{ asset: number; tipo: string; id: number }>(
    await db.execute(sql`select asset_id as asset, entidad_tipo as tipo, entidad_id as id from entidad_media`),
  );
  const porTipo = new Map<string, Set<number>>();
  for (const g of galeria) porTipo.set(g.tipo, (porTipo.get(g.tipo) ?? new Set()).add(Number(g.id)));
  const nombres = new Map<string, string>();
  for (const [tipo, ids] of porTipo) {
    const info = ENTIDAD_INFO[tipo];
    const col = info && (getTableColumns(info.tabla) as Record<string, { name: string }>)[info.label];
    if (!info || !col) continue;
    const rows = filas<{ id: number; nombre: string | null }>(
      await db.execute(sql`
        select id, ${sql.identifier(col.name)}::text as nombre from ${info.tabla}
        where id in (${sql.join([...ids].map((i) => sql`${i}`), sql`, `)})
      `),
    );
    for (const r of rows) nombres.set(`${tipo}:${r.id}`, r.nombre ?? `#${r.id}`);
  }
  for (const g of galeria) anotar(Number(g.asset), `Galería de ${nombres.get(`${g.tipo}:${g.id}`) ?? `${g.tipo} #${g.id}`}`);

  return usos;
}
