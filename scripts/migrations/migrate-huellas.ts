/**
 * El aviso de un cambio dice qué campos cambiaron (decisión del autor, 2026-11-11).
 *
 * `discord_huella`: por ficha, una huella corta de cada campo visible tal y como
 * estaba en su último aviso (o al estrenarse). El aviso de un cambio la compara
 * con la ficha de ahora y dice «Cambió: Título · Imagen», sin el contenido.
 *
 * Nace con RLS y sin políticas, como el resto: la clave pública de Supabase no la
 * lee. La web usa su propia conexión, que no pasa por RLS.
 *
 * Aditiva: el despliegue anterior no la lee. Va **antes** del despliegue que la
 * usa. Después, `sembrar-huellas.ts` le da a cada ficha ya publicada su huella de
 * partida.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-huellas.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-huellas.ts --aplicar
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
  await tx.unsafe(`
    create table if not exists discord_huella (
      entidad_tipo varchar not null,
      entidad_id integer not null,
      huella jsonb not null,
      actualizado_en timestamp not null default now(),
      primary key (entidad_tipo, entidad_id)
    )`);
  await tx.unsafe(`alter table discord_huella enable row level security`);
  await tx.unsafe(`revoke all on discord_huella from anon, authenticated`);
  console.log("✅ discord_huella, con RLS y sin acceso para la clave pública.");

  const [f] = await tx<{ rls: boolean; anon: boolean }[]>`
    select c.relrowsecurity as rls, has_table_privilege('anon', c.oid, 'select') as anon
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'discord_huella'`;
  console.log(`   RLS ${f.rls ? "sí" : "no"} · la clave pública lee ${f.anon ? "sí ⚠️" : "no"}`);
  const [r] = await tx<{ sin: number }[]>`
    select count(*) filter (where not c.relrowsecurity)::int as sin
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'`;
  console.log(`   Tablas sin RLS en total: ${r.sin}.`);
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
