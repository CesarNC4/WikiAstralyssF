/**
 * Avisos a Discord por canal, con un bot (docs/arquitectura.md §14).
 *
 *  - `discord_canal`: el canal por defecto de cada tipo de ficha (`entidad_tipo`
 *    → id del canal). Lo eligen en /admin/discord. Sin fila, ese tipo no avisa
 *    salvo que se elija un canal al publicar.
 *  - `discord_aviso`: el registro de cada aviso enviado (estreno, cambio o prueba),
 *    con el mensaje de Discord y la nota del autor. El aviso de un cambio va por
 *    defecto al canal donde se estrenó la ficha.
 *
 * Las dos nacen con RLS y sin políticas, como el resto de tablas del panel: la
 * clave pública de Supabase no las lee ni las escribe. La web usa su propia
 * conexión, que no pasa por RLS.
 *
 * Aditiva: el despliegue anterior no lee estas tablas. Va **antes** del
 * despliegue que las usa.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-discord.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-discord.ts --aplicar
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
    create table if not exists discord_canal (
      entidad_tipo varchar primary key,
      canal_id varchar not null,
      actualizado_en timestamp not null default now()
    )`);
  await tx.unsafe(`
    create table if not exists discord_aviso (
      id serial primary key,
      entidad_tipo varchar not null,
      entidad_id integer not null,
      clase varchar not null check (clase in ('estreno', 'cambio', 'prueba')),
      canal_id varchar not null,
      mensaje_id varchar,
      nota text,
      enviado_en timestamp not null default now()
    )`);
  await tx.unsafe(`create index if not exists discord_aviso_ficha_idx on discord_aviso (entidad_tipo, entidad_id, enviado_en desc)`);
  for (const t of ["discord_canal", "discord_aviso"]) {
    await tx.unsafe(`alter table ${t} enable row level security`);
    await tx.unsafe(`revoke all on ${t} from anon, authenticated`);
  }
  await tx.unsafe(`revoke all on sequence discord_aviso_id_seq from anon, authenticated`);
  console.log("✅ discord_canal y discord_aviso, con RLS y sin acceso para la clave pública.");

  const filas = await tx<{ tabla: string; rls: boolean; anon: boolean }[]>`
    select c.relname as tabla, c.relrowsecurity as rls, has_table_privilege('anon', c.oid, 'select') as anon
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('discord_canal', 'discord_aviso')
     order by 1`;
  for (const f of filas) console.log(`   ${f.tabla}: RLS ${f.rls ? "sí" : "no"} · la clave pública lee ${f.anon ? "sí ⚠️" : "no"}`);
  const [c] = await tx<{ n: number }[]>`select count(*)::int as n from discord_canal`;
  const [a] = await tx<{ n: number }[]>`select count(*)::int as n from discord_aviso`;
  console.log(`\n   Canales por defecto: ${c.n} · avisos registrados: ${a.n}.`);
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
