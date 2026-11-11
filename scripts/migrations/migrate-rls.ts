/**
 * Cierra a la clave pública de Supabase las tablas que aún se podían leer con ella
 * (decisión del autor, 2026-11-10).
 *
 * La web lee la base con su propia conexión (`DATABASE_URL`, el rol dueño de las
 * tablas), que no pasa por RLS. La clave pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
 * solo la usa el inicio de sesión, en el servidor, y no llega al navegador; aun
 * así, con ella se podían leer por la API de Supabase 22 tablas sin RLS, entre
 * ellas `vinculo`, `fecha_lore`, `regiones` y `locaciones`, con sus partes ocultas.
 *
 * Activa RLS, sin políticas, en toda tabla de `public` que no lo tenga: la clave
 * pública deja de ver sus filas, como ya pasaba con las otras 51. No cambia ningún
 * dato. Las tablas nuevas tienen que nacer igual (ver `migrate-discord.ts`).
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-rls.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-rls.ts --aplicar
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
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 1, onnotice: () => {} });

type Tx = postgres.TransactionSql;

async function trabajo(tx: Tx) {
  const abiertas = await tx<{ tabla: string }[]>`
    select c.relname as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
     order by 1`;
  for (const { tabla } of abiertas) await tx.unsafe(`alter table "${tabla}" enable row level security`);
  console.log(`✅ RLS activado en ${abiertas.length} tablas: ${abiertas.map((t) => t.tabla).join(", ") || "ninguna"}.`);

  // Comprobación: ninguna tabla queda sin RLS y la web (este rol) sigue leyéndolas.
  const [r] = await tx<{ sin: number; con: number }[]>`
    select count(*) filter (where not c.relrowsecurity)::int as sin, count(*) filter (where c.relrowsecurity)::int as con
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'`;
  const [v] = await tx<{ n: number }[]>`select count(*)::int as n from vinculo`;
  const [f] = await tx<{ n: number }[]>`select count(*)::int as n from fecha_lore`;
  console.log(`\n   Tablas con RLS: ${r.con} · sin RLS: ${r.sin}.`);
  console.log(`   La web sigue leyendo: vinculo ${v.n} filas, fecha_lore ${f.n} filas.`);
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
