/**
 * Migración Frente A: añade columnas de auditoría (creado_en, actualizado_en,
 * eliminado_en) a las entidades huérfanas que antes no las tenían, para que
 * encajen en el admin genérico (papelera, orden, edición). Idempotente.
 *
 * Uso:  node --env-file=.env.local scripts/migrate-frente-a.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida. Usa: node --env-file=.env.local scripts/migrate-frente-a.mjs");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 15 });

const TABLES = ["lord_demonio", "armas_artefactos", "sistema_monetario"];

try {
  for (const t of TABLES) {
    await sql.unsafe(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS creado_en timestamptz NOT NULL DEFAULT now()`);
    await sql.unsafe(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now()`);
    await sql.unsafe(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS eliminado_en timestamptz`);
    console.log(`  ✅ ${t}: columnas de auditoría OK`);
  }
  console.log("\n✨ Migración Frente A completada.");
} finally {
  await sql.end();
}
