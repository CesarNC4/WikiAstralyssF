/**
 * Taller · Fase 10 — Medidas para el comparador de alturas.
 * Ver docs/taller-del-autor.md §12 y docs/taller-plan.md (Fase 10).
 *
 * Añade a `bestias` y `lord_demonio`:
 *  - `altura` y `longitud`, en metros (con decimales);
 *  - `silueta`, la forma con que se dibujan (lista fija en `lib/alturas/siluetas.ts`).
 *
 * Los personajes ya tenían `altura`; se dibujan siempre con la silueta humana.
 *
 * Aditiva: el despliegue anterior no lee estas columnas y sigue funcionando.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-alturas.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-alturas.ts --aplicar
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
  for (const tabla of ["bestias", "lord_demonio"]) {
    await tx.unsafe(`
      alter table ${tabla}
        add column if not exists altura double precision check (altura is null or altura > 0),
        add column if not exists longitud double precision check (longitud is null or longitud > 0),
        add column if not exists silueta varchar`);
    console.log(`✅ ${tabla}: altura, longitud y silueta.`);
  }
  const [p] = await tx<{ n: number }[]>`select count(*)::int as n from personajes where altura > 0 and eliminado_en is null`;
  console.log(`\n   Personajes que ya tienen altura: ${p.n}.`);
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
