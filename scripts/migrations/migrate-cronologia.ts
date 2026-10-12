/**
 * Taller · Fases 6 y 7 — Preparación aditiva de la cronología derivada.
 * Ver docs/taller-del-autor.md §13 y §14, y docs/taller-plan.md (Fases 6 y 7).
 *
 *  1. `timeline_eventos.fecha_lore` deja de ser obligatoria: el código nuevo crea
 *     eventos sin ese texto (su fecha va en la tabla `fecha_lore`). El código
 *     viejo la sigue rellenando, así que convive con los dos.
 *  2. Marca como importantes (los que salen en la cronología destacada) las
 *     fechas de los eventos con importancia Mayor, Crítico o Definitorio. Solo
 *     sube la marca, nunca la quita.
 *
 * Aditiva: el despliegue anterior sigue funcionando después de aplicarla.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-cronologia.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-cronologia.ts --aplicar
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

const IMPORTANTES = ["Mayor", "Crítico", "Definitorio"];

async function trabajo(tx: Tx) {
  await tx.unsafe(`alter table timeline_eventos alter column fecha_lore drop not null`);
  console.log("✅ 1/2 timeline_eventos.fecha_lore ya admite vacío.");

  const marcadas = await tx<{ titulo: string; importancia: string }[]>`
    update fecha_lore f set importante = true
      from timeline_eventos t
     where f.entidad_tipo = 'timeline' and f.entidad_id = t.id
       and t.importancia = any(${IMPORTANTES})
       and not f.importante
    returning t.titulo, t.importancia`;
  console.log(`✅ 2/2 ${marcadas.length} eventos marcados como importantes (${IMPORTANTES.join(", ")}).`);
  for (const m of marcadas.slice(0, 10)) console.log(`   · ${m.titulo} (${m.importancia})`);
  if (marcadas.length > 10) console.log(`   … y ${marcadas.length - 10} más.`);

  const [r] = await tx<{ total: number; imp: number }[]>`
    select count(*)::int as total, count(*) filter (where importante)::int as imp from fecha_lore`;
  console.log(`\n   fecha_lore: ${r.total} fechas, ${r.imp} importantes.`);
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
