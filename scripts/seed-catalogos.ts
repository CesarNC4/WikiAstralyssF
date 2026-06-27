/**
 * Sincroniza la tabla `catalogos` con la fuente única `lib/catalogos.ts` (espejo
 * ESTRICTO) y migra los valores en uso en registros a su forma canónica.
 *
 * Uso:  node --env-file=.env.local scripts/seed-catalogos.ts
 *
 * Idempotente. Seguro: si encuentra en BD un `campo` que NO está en el archivo,
 * NO lo borra y avisa, para que lo añadas al archivo antes de mirror-ear.
 */
import postgres from "postgres";
import { CATALOGOS, MAGIA_VARIANTES } from "../lib/catalogos.ts";

/** Migraciones de valores YA guardados en registros (tabla.columna: viejo→nuevo). */
const RECORD_MIGRATIONS: { table: string; column: string; map: Record<string, string> }[] = [
  { table: "habilidades", column: "categoria", map: { TECNICA: "Técnica" } },
  { table: "timeline_eventos", column: "categoria", map: { Magico: "Mágico", Politico: "Político", Cosmico: "Cósmico" } },
  { table: "relaciones", column: "subtipo_relacion", map: { amigo: "Amigo" } },
];

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 15 });

// Conjunto deseado (lo que debe quedar en `catalogos`).
type Row = { campo: string; grupo: string | null; valor: string; orden: number };
const desired: Row[] = [];
for (const [campo, valores] of Object.entries(CATALOGOS)) {
  (valores as readonly string[]).forEach((valor, i) => desired.push({ campo, grupo: null, valor, orden: i }));
}
for (const [grupo, valores] of Object.entries(MAGIA_VARIANTES)) {
  (valores as readonly string[]).forEach((valor, i) => desired.push({ campo: "magia_variante", grupo, valor, orden: i }));
}
const managed = new Set([...Object.keys(CATALOGOS), "magia_variante"]);

try {
  // 1) Migrar valores en uso en registros.
  console.log("→ Migrando valores en uso en registros…");
  for (const m of RECORD_MIGRATIONS) {
    for (const [oldV, newV] of Object.entries(m.map)) {
      const r = await sql.unsafe(
        `UPDATE ${m.table} SET ${m.column} = $1 WHERE ${m.column} = $2`,
        [newV, oldV],
      );
      if (r.count > 0) console.log(`   ${m.table}.${m.column}: ${r.count}× '${oldV}' → '${newV}'`);
    }
  }

  // 2) Guardia: campos en BD que no están en el archivo.
  const dbCampos = (await sql`SELECT DISTINCT campo FROM catalogos`).map((r) => r.campo as string);
  const huérfanos = dbCampos.filter((c) => !managed.has(c));
  if (huérfanos.length > 0) {
    console.warn(`\n⚠️  Campos en BD que NO están en lib/catalogos.ts (se DEJAN intactos): ${huérfanos.join(", ")}`);
    console.warn("   Añádelos al archivo si quieres gestionarlos; por seguridad no se borran.\n");
  }

  // 3) Espejo estricto de los campos gestionados: borra e inserta exactamente.
  await sql.begin(async (tx) => {
    await tx`DELETE FROM catalogos WHERE campo IN ${tx(Array.from(managed))}`;
    // Inserta en bloque.
    await tx`INSERT INTO catalogos ${tx(desired, "campo", "grupo", "valor", "orden")}`;
  });

  // 4) Resumen.
  const resumen = await sql`
    SELECT campo, count(*)::int AS n FROM catalogos GROUP BY campo ORDER BY campo
  `;
  console.log("\n✅ Catálogos sincronizados (espejo del archivo):");
  for (const r of resumen) console.log(`   ${String(r.campo).padEnd(22)} ${r.n}`);
  console.log(`\n   Total filas: ${desired.length}`);
} finally {
  await sql.end();
}
