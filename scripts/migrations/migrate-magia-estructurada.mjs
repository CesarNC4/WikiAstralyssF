/**
 * Magia del personaje → estructurada (aditiva, segura).
 * Añade columnas tipo/variante para magia principal y secundaria, y hace backfill
 * parseando el texto combinado existente "Tipo (Variante)". NO borra las columnas
 * de texto (siguen alimentando la ficha pública y el enlace por nombre).
 * Idempotente.
 *
 * Uso:  node --env-file=.env.local scripts/migrate-magia-estructurada.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "", { prepare: false, connect_timeout: 15 });

/** Parsea "Tipo (Variante)" → { tipo, variante }. */
function parse(combinado) {
  const m = /^(.*?)(?:\s*\(([^)]+)\))?$/.exec((combinado ?? "").trim());
  return { tipo: m?.[1]?.trim() || null, variante: m?.[2]?.trim() || null };
}

try {
  await sql.unsafe(`ALTER TABLE personajes ADD COLUMN IF NOT EXISTS magia_principal_tipo varchar`);
  await sql.unsafe(`ALTER TABLE personajes ADD COLUMN IF NOT EXISTS magia_principal_variante varchar`);
  await sql.unsafe(`ALTER TABLE personajes ADD COLUMN IF NOT EXISTS magia_secundaria_tipo varchar`);
  await sql.unsafe(`ALTER TABLE personajes ADD COLUMN IF NOT EXISTS magia_secundaria_variante varchar`);
  console.log("  ✅ columnas estructuradas añadidas");

  const filas = await sql`
    SELECT id, tipo_magia_principal, magia_secundaria FROM personajes
    WHERE tipo_magia_principal IS NOT NULL OR magia_secundaria IS NOT NULL
  `;
  let n = 0;
  for (const f of filas) {
    const p = parse(f.tipo_magia_principal);
    const s = parse(f.magia_secundaria);
    await sql`
      UPDATE personajes SET
        magia_principal_tipo = ${p.tipo}, magia_principal_variante = ${p.variante},
        magia_secundaria_tipo = ${s.tipo}, magia_secundaria_variante = ${s.variante}
      WHERE id = ${f.id}
    `;
    n++;
  }
  console.log(`  ✅ backfill de ${n} personajes con magia`);
  console.log("\n✨ Migración de magia estructurada completada.");
} finally {
  await sql.end();
}
