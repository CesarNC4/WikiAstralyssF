/**
 * Migración Personajes/Magia:
 *   1) Elimina la columna obsoleta personajes.subtitulo (ya no se usa).
 *   2) Añade estadisticas.poder_de_combate (se recalcula al guardar cada ficha).
 *   3) Renombra la naturaleza de magia "Hechizo" → "Tecnica" (datos + catálogo)
 *      y siembra las naturalezas canónicas (Fundamento, Concepto, Tecnica,
 *      Tecnica Avanzada).
 * Idempotente.
 *
 * Uso:  node --env-file=.env.local scripts/migrate-personaje-stats.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 15 });

try {
  // 1) Quitar subtitulo de personajes (eliminación total).
  await sql.unsafe(`ALTER TABLE personajes DROP COLUMN IF EXISTS subtitulo`);
  console.log("  ✅ personajes.subtitulo eliminada");

  // 2) Poder de Combate persistido en estadisticas.
  await sql.unsafe(`ALTER TABLE estadisticas ADD COLUMN IF NOT EXISTS poder_de_combate integer`);
  console.log("  ✅ estadisticas.poder_de_combate añadida");

  // 3a) Datos: naturaleza 'Hechizo' → 'Tecnica'.
  const upd = await sql.unsafe(
    `UPDATE magia_fundamentos SET naturaleza = 'Tecnica' WHERE naturaleza = 'Hechizo'`,
  );
  console.log(`  ✅ magia_fundamentos: ${upd.count} filas 'Hechizo' → 'Tecnica'`);

  // 3b) Catálogo del combobox: migrar 'Hechizo' a 'Tecnica' (sin duplicar).
  await sql.unsafe(`
    UPDATE catalogos SET valor = 'Tecnica'
    WHERE campo = 'magia_naturaleza' AND valor = 'Hechizo'
      AND NOT EXISTS (
        SELECT 1 FROM catalogos c2
        WHERE c2.campo = 'magia_naturaleza' AND c2.valor = 'Tecnica'
      )
  `);
  await sql.unsafe(`DELETE FROM catalogos WHERE campo = 'magia_naturaleza' AND valor = 'Hechizo'`);

  // 3c) Sembrar las naturalezas canónicas si faltan (orden teoría → técnicas).
  const NATURALEZAS = [
    ["Fundamento", 0],
    ["Concepto", 1],
    ["Tecnica", 2],
    ["Tecnica Avanzada", 3],
  ];
  for (const [valor, orden] of NATURALEZAS) {
    await sql`
      INSERT INTO catalogos (campo, valor, orden)
      SELECT 'magia_naturaleza', ${valor}, ${orden}
      WHERE NOT EXISTS (
        SELECT 1 FROM catalogos WHERE campo = 'magia_naturaleza' AND valor = ${valor}
      )
    `;
    // Forzar el orden canónico también para valores ya existentes (p. ej. el
    // 'Tecnica' que viene de renombrar 'Hechizo' conserva el orden viejo).
    await sql`
      UPDATE catalogos SET orden = ${orden}
      WHERE campo = 'magia_naturaleza' AND valor = ${valor} AND orden IS DISTINCT FROM ${orden}
    `;
  }
  console.log("  ✅ catálogo magia_naturaleza actualizado");

  console.log("\n✨ Migración de personajes/magia completada.");
  console.log("   Nota: poder_de_combate se rellena al volver a guardar cada personaje.");
} finally {
  await sql.end();
}
