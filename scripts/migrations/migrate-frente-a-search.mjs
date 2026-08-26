/**
 * Migración Frente A (búsqueda): engancha los triggers de search_index_sync a
 * las entidades nuevas para que aparezcan en el buscador ⌘K. La función
 * search_index_sync ya es genérica (lee columnas vía to_jsonb). Idempotente.
 *
 * Uso:  node --env-file=.env.local scripts/migrate-frente-a-search.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 15 });

// [tabla, tipo (entidad_tipo + route)]
const TRIGGERS = [
  ["lord_demonio", "demonios"],
  ["armas_artefactos", "artefactos"],
];

try {
  for (const [tabla, tipo] of TRIGGERS) {
    await sql.unsafe(`DROP TRIGGER IF EXISTS trg_search_${tipo} ON ${tabla}`);
    await sql.unsafe(
      `CREATE TRIGGER trg_search_${tipo}
       AFTER INSERT OR UPDATE OR DELETE ON ${tabla}
       FOR EACH ROW EXECUTE FUNCTION search_index_sync('${tipo}', '${tipo}')`,
    );
    // Reindexa filas existentes (dispara el trigger sin cambiar datos).
    await sql.unsafe(`UPDATE ${tabla} SET actualizado_en = actualizado_en`);
    console.log(`  ✅ ${tabla} → search_index ('${tipo}')`);
  }
  console.log("\n✨ Triggers de búsqueda enganchados.");
} finally {
  await sql.end();
}
