/**
 * Los personajes sin publicar vuelven a contar como «nunca publicados» (decisión
 * del autor, 2026-11-10).
 *
 * La importación inicial puso `publicado_primera_vez_en = 2026-06-05` a todos los
 * personajes, incluidos los que nunca llegaron a verse (es anterior incluso al
 * primero creado en la wiki, del 2026-06-06). Con esa fecha, publicarlos no
 * avisaba en Discord: el aviso de estreno solo sale si la fecha está vacía. La
 * limpieza del 2026-11-03 dejó además esas fichas solo con nombre y estado, así
 * que al publicarse son de verdad nuevas para los jugadores.
 *
 * Solo toca personajes **sin publicar** con esa fecha exacta; los publicados la
 * conservan (no se vuelven a anunciar).
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-estrenos.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-estrenos.ts --aplicar
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
  const filas = await tx<{ id: number; nombre: string; estado: string }[]>`
    update personajes set publicado_primera_vez_en = null
     where estado_publicacion <> 'publicado'
       and publicado_primera_vez_en::date = date '2026-06-05'
    returning id, nombre, estado_publicacion as estado`;
  const porEstado = new Map<string, number>();
  for (const f of filas) porEstado.set(f.estado, (porEstado.get(f.estado) ?? 0) + 1);
  console.log(`✅ ${filas.length} personajes sin publicar vuelven a «nunca publicados» (${[...porEstado].map(([e, n]) => `${n} ${e}`).join(", ") || "ninguno"}).`);
  const muestra = filas.filter((f) => f.id >= 37 && f.id <= 43).map((f) => `#${f.id} ${f.nombre}`);
  if (muestra.length) console.log(`   Entre ellos: ${muestra.join(", ")}.`);

  const [r] = await tx<{ pub: number; quedan: number }[]>`
    select count(*) filter (where estado_publicacion = 'publicado' and publicado_primera_vez_en is not null)::int as pub,
           count(*) filter (where estado_publicacion <> 'publicado' and publicado_primera_vez_en is not null)::int as quedan
      from personajes where eliminado_en is null`;
  console.log(`\n   Publicados con su fecha (no se tocan): ${r.pub} · sin publicar que aún la tienen: ${r.quedan}.`);
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
