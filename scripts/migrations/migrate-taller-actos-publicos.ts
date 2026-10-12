/**
 * Taller · Fase 5 — Los actos entran en el buscador.
 * Ver docs/taller-del-autor.md §4 y docs/taller-plan.md (Fase 5).
 *
 * El trigger genérico `search_index_sync` construye la URL como `/<ruta>/<id>`
 * y toma el estado de la propia fila. Al acto no le vale ninguna de las dos
 * cosas: vive en `/capitulos/<capítulo>/actos/<id>` y solo es público si su
 * capítulo también lo es. Por eso lleva su propia función:
 *
 *  1. `search_index_acto(id)`: indexa (o desindexa) un acto, con su rótulo
 *     ("Acto II · Capítulo 3 — Título") y su visibilidad compuesta.
 *  2. Trigger en `actos`: reindexa el acto en cada alta, cambio o baja; si
 *     cambia de capítulo, reindexa también a los que deja atrás.
 *  3. Trigger en `capitulos`: si cambia lo que el acto hereda (estado, número,
 *     título, papelera), reindexa sus actos.
 *  4. Indexa los actos que ya existen.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-taller-actos-publicos.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-taller-actos-publicos.ts --aplicar
 *
 * Idempotente.
 */
import postgres from "postgres";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 3, onnotice: () => {} });

type Tx = postgres.TransactionSql;

async function trabajo(tx: Tx) {
  await tx.unsafe(`
    create or replace function public.search_index_acto(p_id integer) returns void
    language plpgsql
    set search_path to 'public', 'pg_catalog'
    as $$
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
      _resumen := left(coalesce(a.descripcion, ''), 200);
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
    $$`);
  console.log("✅ 1/4 Función search_index_acto.");

  await tx.unsafe(`
    create or replace function public.trg_fn_search_actos() returns trigger
    language plpgsql
    set search_path to 'public', 'pg_catalog'
    as $$
    declare
      h record;
    begin
      if tg_op = 'DELETE' then
        delete from search_index where entidad_tipo = 'actos' and entidad_id = old.id::text;
        return old;
      end if;
      perform search_index_acto(new.id);
      -- Al irse a otro capítulo, los que se quedan cambian de número.
      if tg_op = 'UPDATE' and old.capitulo_id is distinct from new.capitulo_id and old.capitulo_id is not null then
        for h in select id from actos where capitulo_id = old.capitulo_id loop
          perform search_index_acto(h.id);
        end loop;
      end if;
      return new;
    end;
    $$`);
  await tx.unsafe(`drop trigger if exists trg_search_actos on actos`);
  await tx.unsafe(`
    create trigger trg_search_actos
      after insert or update or delete on actos
      for each row execute function trg_fn_search_actos()`);
  console.log("✅ 2/4 Trigger de búsqueda en actos.");

  await tx.unsafe(`
    create or replace function public.trg_fn_search_actos_de_capitulo() returns trigger
    language plpgsql
    set search_path to 'public', 'pg_catalog'
    as $$
    declare
      h record;
    begin
      if (old.estado_publicacion, old.numero, old.titulo, old.eliminado_en)
         is distinct from (new.estado_publicacion, new.numero, new.titulo, new.eliminado_en) then
        for h in select id from actos where capitulo_id = new.id loop
          perform search_index_acto(h.id);
        end loop;
      end if;
      return new;
    end;
    $$`);
  await tx.unsafe(`drop trigger if exists trg_search_actos_capitulo on capitulos`);
  await tx.unsafe(`
    create trigger trg_search_actos_capitulo
      after update on capitulos
      for each row execute function trg_fn_search_actos_de_capitulo()`);
  console.log("✅ 3/4 Trigger en capítulos que reindexa sus actos.");

  const actos = await tx<{ id: number }[]>`select id from actos`;
  for (const a of actos) await tx`select search_index_acto(${a.id})`;
  const indexados = await tx<{ titulo: string; subtitulo: string; url: string; estado_publicacion: string }[]>`
    select titulo, subtitulo, url, estado_publicacion from search_index where entidad_tipo = 'actos' order by url`;
  console.log(`✅ 4/4 ${indexados.length} actos en el buscador:`);
  for (const i of indexados) console.log(`   · ${i.titulo} — ${i.subtitulo} → ${i.url} (${i.estado_publicacion})`);
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
        throw new Error(CENTINELA);
      });
    } catch (e) {
      if ((e as Error)?.message !== CENTINELA) throw e;
    }
  }
  console.log(
    APLICAR
      ? "\n✅ Aplicado."
      : "\n✅ Ensayo terminado y revertido. La base está intacta.\n   Para aplicarlo de verdad: añade --aplicar",
  );
} finally {
  await sql.end();
}
