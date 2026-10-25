/**
 * Fragmentos del acto — Fase 2 de docs/fragmentos-y-musica.md (§2.2).
 *
 * Crea `acto_fragmento`: varios tramos por acto, cada uno con su POV, su enlace
 * y su orden de lectura. La fecha de cada fragmento no lleva columnas: va en
 * `fecha_lore` con `entidad_tipo = 'fragmentos'`, como el resto de fechas.
 *
 *  - `acto_id` → actos, on delete cascade: borrar el acto para siempre se lleva
 *    sus fragmentos (sus fechas y vínculos los limpia `eliminarDelTaller`).
 *  - `personaje_id` → personajes, on delete set null: el fragmento sobrevive sin
 *    POV si la ficha se borra para siempre.
 *
 * Aditiva: el despliegue anterior no lee esta tabla y sigue funcionando.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-fragmentos.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-fragmentos.ts --aplicar
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
    create table if not exists acto_fragmento (
      id serial primary key,
      acto_id integer not null references actos(id) on delete cascade,
      orden integer not null default 0,
      personaje_id integer references personajes(id) on delete set null,
      titulo varchar,
      enlace varchar,
      creado_en timestamp not null default now(),
      actualizado_en timestamp not null default now()
    )`);
  await tx.unsafe(`create index if not exists acto_fragmento_acto_idx on acto_fragmento (acto_id, orden)`);
  await tx.unsafe(`create index if not exists acto_fragmento_personaje_idx on acto_fragmento (personaje_id)`);
  console.log("✅ acto_fragmento, con sus claves foráneas e índices.");

  const [f] = await tx<{ n: number }[]>`select count(*)::int as n from acto_fragmento`;
  const [a] = await tx<{ n: number }[]>`select count(*)::int as n from actos where eliminado_en is null`;
  const [h] = await tx<{ n: number }[]>`select count(*)::int as n from fecha_lore where entidad_tipo = 'fragmentos'`;
  console.log(`\n   Fragmentos: ${f.n} · actos vivos: ${a.n} · fechas de fragmentos: ${h.n}.`);
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
