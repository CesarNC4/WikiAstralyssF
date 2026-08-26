/**
 * Backfill de media_assets (§1, problema 3 / Frente D).
 *
 * Por cada entidad con `imagen_url` / `banner_url`:
 *   1. Añade las columnas `imagen_asset_id` / `banner_asset_id` si no existen.
 *   2. Crea un registro en `media_assets` (alt = nombre de la entidad, blurhash
 *      generado desde Cloudinary) y enlaza el asset_id en la entidad.
 *
 * NO destructivo e idempotente: solo procesa filas con asset_id NULL; reejecutar
 * es seguro. No borra ni vacía `imagen_url` (eso es el Frente D·2).
 *
 * Uso:  node --env-file=.env.local scripts/backfill-media.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no está definida. Ejecuta con: node --env-file=.env.local scripts/backfill-media.mjs");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, connect_timeout: 15 });

// Whitelist de tablas (identificadores fijos, sin entrada de usuario → sin riesgo de inyección).
const TABLES = [
  { t: "personajes", name: "nombre", banner: true },
  { t: "naciones", name: "nombre", banner: true },
  { t: "razas", name: "nombre", banner: true },
  { t: "organizaciones", name: "nombre", banner: true },
  { t: "familias", name: "nombre", banner: true },
  { t: "bestias", name: "nombre", banner: true },
  { t: "minerales", name: "nombre", banner: false },
  { t: "conceptos", name: "nombre", banner: false },
  { t: "magia_fundamentos", name: "nombre", banner: false },
  { t: "misiones", name: "nombre", banner: false },
  { t: "paginas_lore", name: "titulo", banner: true },
  { t: "gremio", name: "nombre", banner: true },
  { t: "lord_demonio", name: "nombre", banner: true },
  { t: "armas_artefactos", name: "nombre", banner: false },
  { t: "sistema_monetario", name: "nombre", banner: false },
  { t: "canciones", name: "titulo", banner: false },
];

/** Extrae el public_id de Cloudinary de una URL de entrega (best-effort). */
function publicIdFromUrl(u) {
  const after = u.split("/upload/")[1];
  if (!after) return null;
  return after.replace(/^v\d+\//, "").replace(/\.[a-zA-Z0-9]+$/, "");
}

/** Genera un blurDataURL diminuto desde Cloudinary (best-effort). */
async function blurOf(u) {
  try {
    if (!u.includes("res.cloudinary.com") || !u.includes("/upload/")) return null;
    const tiny = u.replace("/upload/", "/upload/w_16,e_blur:1200,q_30,f_auto/");
    const res = await fetch(tiny);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function migrarColumna(table, nameCol, urlCol, assetCol, altSuffix) {
  await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${assetCol} integer`);
  const rows = await sql.unsafe(
    `SELECT id, ${nameCol} AS name, ${urlCol} AS url FROM ${table} WHERE ${urlCol} IS NOT NULL AND ${urlCol} <> '' AND ${assetCol} IS NULL`,
  );
  let n = 0;
  for (const row of rows) {
    const alt = `${row.name ?? table}${altSuffix}`;
    const blur = await blurOf(row.url);
    const [asset] = await sql.unsafe(
      `INSERT INTO media_assets (storage, public_id, url_publica, tipo, alt, blurhash)
       VALUES ('cloudinary', $1, $2, 'imagen', $3, $4) RETURNING id`,
      [publicIdFromUrl(row.url), row.url, alt, blur],
    );
    await sql.unsafe(`UPDATE ${table} SET ${assetCol} = $1 WHERE id = $2`, [asset.id, row.id]);
    n++;
  }
  return { total: rows.length, hechas: n };
}

console.log("🌌 Backfill media_assets — inicio\n");
let totalAssets = 0;
try {
  for (const { t, name, banner } of TABLES) {
    try {
      const img = await migrarColumna(t, name, "imagen_url", "imagen_asset_id", "");
      let banRes = { hechas: 0 };
      if (banner) {
        banRes = await migrarColumna(t, name, "banner_url", "banner_asset_id", " (banner)");
      }
      totalAssets += img.hechas + banRes.hechas;
      console.log(`  ✅ ${t.padEnd(20)} imagen:${img.hechas}${banner ? `  banner:${banRes.hechas}` : ""}`);
    } catch (e) {
      console.log(`  ⚠️  ${t.padEnd(20)} ${String(e.message).slice(0, 70)}`);
    }
  }
  console.log(`\n✨ Listo. Assets creados: ${totalAssets}`);
} finally {
  await sql.end();
}
