import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL ?? "", { prepare: false, connect_timeout: 15 });
try {
  await sql.unsafe(`ALTER TABLE personajes ADD COLUMN IF NOT EXISTS lugar_nacimiento_nacion_id integer`);
  await sql.unsafe(`ALTER TABLE personajes ADD COLUMN IF NOT EXISTS lugar_nacimiento_region_id integer`);
  await sql.unsafe(`ALTER TABLE personajes ADD COLUMN IF NOT EXISTS lugar_nacimiento_locacion_id integer`);
  console.log("✅ columnas lugar_nacimiento_(nacion|region|locacion)_id añadidas");
} finally { await sql.end(); }
