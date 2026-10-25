/**
 * Canciones — Fase 3 de docs/fragmentos-y-musica.md (§3.3).
 *
 * Añade a `canciones`:
 *  - `letra` (texto), para la ficha y el panel del reproductor;
 *  - `duracion` (segundos), que da Cloudinary al subir audio propio;
 *  - `audio_asset_id` → media_assets (on delete set null), el archivo propio.
 *
 * Los vínculos nuevos (canción ↔ personaje, capítulo, fragmento, nación…) van
 * en la tabla genérica `vinculo` y no necesitan migración. Las tablas viejas
 * (`personaje_cancion`, `capitulo_cancion`, `acto_cancion`, `hoja_cancion`) se
 * retiran en la Fase 6.
 *
 * Aditiva: el despliegue anterior no lee estas columnas y sigue funcionando.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-canciones.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-canciones.ts --aplicar
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
    alter table canciones
      add column if not exists letra text,
      add column if not exists duracion integer check (duracion is null or duracion > 0),
      add column if not exists audio_asset_id integer references media_assets(id) on delete set null`);
  await tx.unsafe(`create index if not exists canciones_audio_asset_idx on canciones (audio_asset_id)`);
  console.log("✅ canciones: letra, duracion y audio_asset_id.");

  const filas = await tx<{ id: number; titulo: string; tipo_fuente: string | null; url: string | null }[]>`
    select id, titulo, tipo_fuente, url from canciones order by id`;
  console.log(`\n   Canciones actuales: ${filas.length}`);
  for (const f of filas) console.log(`   · #${f.id} ${f.titulo} — ${f.tipo_fuente ?? "sin fuente"} ${f.url ?? ""}`);
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
