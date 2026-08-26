/**
 * Migración Frente C (mapa): crea el tipo tipo_locacion, las tablas regiones y
 * locaciones, añade geometría a naciones y engancha los triggers de búsqueda y
 * de actualizado_en. Idempotente.
 *
 * Uso:  node --env-file=.env.local scripts/migrate-mapa.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 15 });

try {
  // 1) Enum tipo_locacion
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_locacion') THEN
        CREATE TYPE tipo_locacion AS ENUM ('ciudad','mazmorra','interes','batalla');
      END IF;
    END $$;
  `);
  console.log("  ✅ tipo tipo_locacion");

  // 2) Geometría en naciones
  await sql.unsafe(`ALTER TABLE naciones ADD COLUMN IF NOT EXISTS poligono jsonb`);
  await sql.unsafe(`ALTER TABLE naciones ADD COLUMN IF NOT EXISTS centro_x double precision`);
  await sql.unsafe(`ALTER TABLE naciones ADD COLUMN IF NOT EXISTS centro_y double precision`);
  await sql.unsafe(`ALTER TABLE naciones ADD COLUMN IF NOT EXISTS color varchar`);
  console.log("  ✅ naciones: geometría");

  // 3) Tabla regiones
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS regiones (
      id serial PRIMARY KEY,
      nacion_id integer,
      nombre varchar NOT NULL,
      subtitulo varchar,
      descripcion text,
      historia text,
      poligono jsonb,
      centro_x double precision,
      centro_y double precision,
      color varchar,
      imagen_url varchar,
      banner_url varchar,
      estado_publicacion estado_publicacion NOT NULL DEFAULT 'borrador',
      publicado_primera_vez_en timestamptz,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now(),
      eliminado_en timestamptz
    )
  `);
  console.log("  ✅ tabla regiones");

  // 4) Tabla locaciones
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS locaciones (
      id serial PRIMARY KEY,
      region_id integer,
      nacion_id integer,
      tipo tipo_locacion NOT NULL DEFAULT 'interes',
      nombre varchar NOT NULL,
      subtitulo varchar,
      descripcion text,
      historia text,
      x double precision,
      y double precision,
      imagen_url varchar,
      banner_url varchar,
      evento_id integer,
      estado_publicacion estado_publicacion NOT NULL DEFAULT 'borrador',
      publicado_primera_vez_en timestamptz,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now(),
      eliminado_en timestamptz
    )
  `);
  console.log("  ✅ tabla locaciones");

  // 5) Triggers de búsqueda + actualizado_en (la función search_index_sync ya existe)
  for (const [tabla, tipo] of [["regiones", "regiones"], ["locaciones", "locaciones"]]) {
    await sql.unsafe(`DROP TRIGGER IF EXISTS trg_search_${tipo} ON ${tabla}`);
    await sql.unsafe(
      `CREATE TRIGGER trg_search_${tipo}
       AFTER INSERT OR UPDATE OR DELETE ON ${tabla}
       FOR EACH ROW EXECUTE FUNCTION search_index_sync('${tipo}', '${tipo}')`,
    );
    await sql.unsafe(`DROP TRIGGER IF EXISTS trg_${tabla}_actualizado ON ${tabla}`);
    await sql.unsafe(
      `CREATE TRIGGER trg_${tabla}_actualizado BEFORE UPDATE ON ${tabla}
       FOR EACH ROW EXECUTE FUNCTION set_actualizado_en()`,
    );
    console.log(`  ✅ triggers en ${tabla}`);
  }

  console.log("\n✨ Migración del mapa completada.");
} finally {
  await sql.end();
}
