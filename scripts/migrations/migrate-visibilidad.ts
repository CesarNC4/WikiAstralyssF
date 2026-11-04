/**
 * Visibilidad completa (docs/area-ia.md, Fase 4). ADITIVA: no borra nada, y el
 * código que ya está desplegado sigue funcionando igual. Va ANTES del despliegue,
 * porque el código nuevo lee estas columnas.
 *
 *  1. `oculto` en lo que es una fila de conexión o de dato: `vinculo`,
 *     `fecha_lore`, las tablas de `TABLAS_REL` (lib/relaciones/tablas.ts), los
 *     nodos del árbol, los historiales y las habilidades. Las conexiones de medio
 *     "referencia" no la necesitan: su columna es un campo de la ficha y se oculta
 *     con `campo_visibilidad`.
 *  2. `personajes.nombre_real`: el nombre de un personaje con identidad oculta.
 *     La ficha lleva el alias con el que la conocen los lectores.
 *  3. `censurar_oculto(text)`: quita los trozos `[[oculto]]…[[/oculto]]` de un
 *     texto. Es la misma regla que `censurarTexto` en lib/visibilidad.ts: si falta
 *     el cierre, se oculta hasta el final.
 *  4. Los triggers del buscador (`search_index_sync`, `search_index_acto`) dejan
 *     fuera los campos ocultos y los trozos: ni se encuentran ni se muestran.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-visibilidad.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-visibilidad.ts --aplicar
 *
 * El ensayo hace todo dentro de una transacción que revierte al final, y además
 * comprueba el buscador con un personaje: le pone un trozo oculto y un campo
 * oculto, y mira lo que queda en el índice. Idempotente.
 */
import postgres from "postgres";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 1, onnotice: () => {} });

type Tx = postgres.TransactionSql;

const CON_OCULTO = [
  "vinculo",
  "fecha_lore",
  "personaje_nacion",
  "personaje_raza",
  "org_jerarquia",
  "familia_jerarquia",
  "gremio_jerarquia",
  "personaje_objeto",
  "personaje_evento",
  "relaciones",
  "nacion_organizacion",
  "nacion_raza",
  "nacion_diplomacia",
  "bestia_nacion",
  "bestia_region",
  "bestia_drop",
  "bestia_relacion",
  "mineral_artefacto",
  "entidad_elemento",
  "familia_arbol",
  "org_historial",
  "gremio_historial",
  "habilidades",
];

const CENSURAR = `
  create or replace function public.censurar_oculto(texto text)
  returns text
  language sql
  immutable
  as $$
    select regexp_replace(texto, '\\[\\[oculto\\]\\].*?(\\[\\[/oculto\\]\\]|$)', '???', 'gi')
  $$`;

const SEARCH_SYNC = `
  create or replace function public.search_index_sync()
  returns trigger
  language plpgsql
  set search_path to 'public', 'pg_catalog'
  as $function$
  declare
    v jsonb;
    _tipo text := tg_argv[0];
    _route text := tg_argv[1];
    _id text; _titulo text; _sub text; _resumen text; _img text; _url text;
    _estado estado_publicacion;
    _campo text;
  begin
    if tg_op = 'DELETE' then
      v := to_jsonb(old);
      delete from public.search_index
        where entidad_tipo = _tipo
          and entidad_id = coalesce(v->>'slug', v->>'id');
      return old;
    end if;

    v := to_jsonb(new);

    -- Soft-delete: si la entidad tiene eliminado_en y no es NULL, sacarla del índice.
    if (v ? 'eliminado_en') and (v->>'eliminado_en') is not null then
      delete from public.search_index
        where entidad_tipo = _tipo
          and entidad_id = coalesce(v->>'slug', v->>'id');
      return new;
    end if;

    -- Lo oculto al público no entra en el índice. campo_visibilidad guarda el
    -- nombre de Drizzle (camelCase) y aquí las claves son las columnas.
    for _campo in
      select lower(regexp_replace(campo, '([A-Z])', '_\\1', 'g'))
        from public.campo_visibilidad
       where entidad_tipo = _tipo and entidad_id = (v->>'id')::int and visible = false
    loop
      v := v - _campo;
    end loop;

    if _tipo = 'lore' then
      _id := v->>'slug';
      _titulo := coalesce(v->>'titulo', v->>'slug');
      _sub := v->>'subtitulo';
      _resumen := left(censurar_oculto(coalesce(v->>'introduccion','')), 200);
      _url := '/lore/' || (v->>'slug');
    else
      _id := v->>'id';
      _titulo := coalesce(v->>'nombre', v->>'titulo', '');
      _sub := coalesce(v->>'subtitulo', v->>'titulo', v->>'categoria', v->>'tipo');
      _resumen := left(censurar_oculto(coalesce(v->>'descripcion', v->>'historia', '')), 200);
      _url := '/' || _route || '/' || (v->>'id');
    end if;
    _sub := censurar_oculto(_sub);

    _img := v->>'imagen_url';
    _estado := coalesce((v->>'estado_publicacion')::estado_publicacion, 'borrador');

    insert into public.search_index
      (entidad_tipo, entidad_id, titulo, subtitulo, resumen, imagen_url, url, estado_publicacion, documento)
    values (_tipo, _id, _titulo, _sub, _resumen, _img, _url, _estado,
      setweight(to_tsvector('spanish', coalesce(_titulo,'')), 'A') ||
      setweight(to_tsvector('spanish', coalesce(_sub,'')), 'B') ||
      setweight(to_tsvector('spanish', coalesce(_resumen,'')), 'C'))
    on conflict (entidad_tipo, entidad_id) do update set
      titulo = excluded.titulo, subtitulo = excluded.subtitulo, resumen = excluded.resumen,
      imagen_url = excluded.imagen_url, url = excluded.url,
      estado_publicacion = excluded.estado_publicacion, documento = excluded.documento;
    return new;
  end;
  $function$`;

const SEARCH_ACTO = `
  create or replace function public.search_index_acto(p_id integer)
  returns void
  language plpgsql
  set search_path to 'public', 'pg_catalog'
  as $function$
    declare
      a record;
      c record;
      pos integer;
      _sub text;
      _resumen text;
      _estado estado_publicacion;
    begin
      select * into a from actos where id = p_id;
      if not found or a.eliminado_en is not null or a.capitulo_id is null then
        delete from search_index where entidad_tipo = 'actos' and entidad_id = p_id::text;
        return;
      end if;
      select * into c from capitulos where id = a.capitulo_id;
      if not found or c.eliminado_en is not null then
        delete from search_index where entidad_tipo = 'actos' and entidad_id = p_id::text;
        return;
      end if;

      -- La posición sale igual que en la app (lib/narrativa/numeracion.ts):
      -- actos vivos del capítulo por orden y, a igualdad, por id.
      select count(*) into pos from actos x
       where x.capitulo_id = a.capitulo_id and x.eliminado_en is null
         and (coalesce(x.numero_orden, 0) < coalesce(a.numero_orden, 0)
              or (coalesce(x.numero_orden, 0) = coalesce(a.numero_orden, 0) and x.id < a.id));

      _sub := 'Acto ' || to_char(pos + 1, 'FMRN') || ' · ' || c.numero || ' — ' || c.titulo;
      -- Una descripción oculta no entra en el índice; los trozos ocultos, tampoco.
      if exists (select 1 from campo_visibilidad cv
                  where cv.entidad_tipo = 'actos' and cv.entidad_id = p_id
                    and cv.campo = 'descripcion' and cv.visible = false) then
        _resumen := '';
      else
        _resumen := left(censurar_oculto(coalesce(a.descripcion, '')), 200);
      end if;
      _estado := case when a.estado_publicacion = 'publicado' and c.estado_publicacion = 'publicado'
                      then 'publicado' else 'borrador' end;

      insert into search_index
        (entidad_tipo, entidad_id, titulo, subtitulo, resumen, imagen_url, url, estado_publicacion, documento)
      values ('actos', p_id::text, a.nombre, _sub, _resumen, null,
              '/capitulos/' || c.id || '/actos/' || p_id, _estado,
              setweight(to_tsvector('spanish', coalesce(a.nombre, '')), 'A') ||
              setweight(to_tsvector('spanish', coalesce(_sub, '')), 'B') ||
              setweight(to_tsvector('spanish', coalesce(_resumen, '')), 'C'))
      on conflict (entidad_tipo, entidad_id) do update set
        titulo = excluded.titulo, subtitulo = excluded.subtitulo, resumen = excluded.resumen,
        imagen_url = excluded.imagen_url, url = excluded.url,
        estado_publicacion = excluded.estado_publicacion, documento = excluded.documento;
    end;
    $function$`;

async function trabajo(tx: Tx) {
  // 1. Columnas `oculto`.
  for (const t of CON_OCULTO) {
    const [ya] = await tx<{ ok: boolean }[]>`
      select exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = ${t} and column_name = 'oculto') as ok`;
    if (ya.ok) {
      console.log(`·  ${t}.oculto: ya existe.`);
      continue;
    }
    await tx.unsafe(`alter table ${t} add column oculto boolean not null default false`);
    console.log(`✅ ${t}.oculto`);
  }

  // 2. Nombre real.
  await tx.unsafe(`alter table personajes add column if not exists nombre_real varchar`);
  console.log("✅ personajes.nombre_real");

  // 3 y 4. El buscador.
  await tx.unsafe(CENSURAR);
  await tx.unsafe(SEARCH_SYNC);
  await tx.unsafe(SEARCH_ACTO);
  console.log("✅ censurar_oculto, search_index_sync y search_index_acto");

  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from search_index`;
  const [marcas] = await tx<{ n: number }[]>`select count(*)::int as n from campo_visibilidad where visible = false`;
  console.log(`\n   Filas en el buscador: ${n.n}. Campos ocultos hoy: ${marcas.n} (no hay nada que reindexar).`);
}

/** Solo en el ensayo: prueba el buscador con un personaje, dentro de la transacción que se revierte. */
async function probarBuscador(tx: Tx) {
  const [p] = await tx<{ id: number; nombre: string }[]>`
    select id, nombre from personajes where eliminado_en is null order by id limit 1`;
  if (!p) return;
  const fila = async () => {
    const [f] = await tx<{ sub: string | null; resumen: string | null }[]>`
      select subtitulo as sub, resumen from search_index where entidad_tipo = 'personajes' and entidad_id = ${String(p.id)}`;
    return f;
  };
  const SECRETO = "prueba-texto-secreto";
  console.log(`\n🧪 Prueba del buscador con ${p.nombre} (#${p.id}), revertida al final:`);

  await tx`update personajes set titulo = 'prueba-titulo', historia = ${`Se sabe esto. [[oculto]]${SECRETO}[[/oculto]] Y esto.`} where id = ${p.id}`;
  let f = await fila();
  console.log(`   Trozo oculto  → resumen: «${f.resumen}»`);
  if (f.resumen?.includes(SECRETO) || !f.resumen?.includes("???")) throw new Error("El trozo oculto ha llegado al buscador.");

  await tx`update personajes set historia = ${`Sin cierre. [[oculto]]${SECRETO}`} where id = ${p.id}`;
  f = await fila();
  console.log(`   Sin cierre    → resumen: «${f.resumen}»`);
  if (f.resumen?.includes(SECRETO)) throw new Error("Un trozo sin cierre ha llegado al buscador.");

  await tx`insert into campo_visibilidad (entidad_tipo, entidad_id, campo, visible) values ('personajes', ${p.id}, 'historia', false)
           on conflict (entidad_tipo, entidad_id, campo) do update set visible = false`;
  await tx`insert into campo_visibilidad (entidad_tipo, entidad_id, campo, visible) values ('personajes', ${p.id}, 'titulo', false)
           on conflict (entidad_tipo, entidad_id, campo) do update set visible = false`;
  await tx`update personajes set id = id where id = ${p.id}`;
  f = await fila();
  console.log(`   Campos ocultos → subtítulo: ${JSON.stringify(f.sub)}, resumen: ${JSON.stringify(f.resumen)}`);
  if (f.sub === "prueba-titulo" || f.resumen?.includes("Sin cierre")) throw new Error("Un campo oculto ha llegado al buscador.");
  console.log("   ✅ Nada oculto entra en el índice.");
}

try {
  console.log(APLICAR ? "⚙️  APLICANDO cambios a la base…\n" : "🔍 ENSAYO (no se escribe nada; todo se revierte al final)\n");
  if (APLICAR) {
    await sql.begin(trabajo);
  } else {
    const CENTINELA = "__ensayo_terminado__";
    try {
      await sql.begin(async (tx) => {
        await trabajo(tx);
        await probarBuscador(tx);
        throw new Error(CENTINELA);
      });
    } catch (e) {
      if ((e as Error)?.message !== CENTINELA) throw e;
    }
  }
  console.log(APLICAR ? "\n✅ Aplicado." : "\n✅ Ensayo terminado y revertido. La base está intacta.\n   Para aplicarlo de verdad: añade --aplicar");
} finally {
  await sql.end();
}
