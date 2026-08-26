/**
 * Frente E — Narrativa, canciones y elementos entran al admin.
 *
 * `capitulos`, `actos`, `trama_arcos`, `trama_hojas`, `hilo_narrativo`,
 * `canciones` y `elementos` existían en la base y ya alimentaban partes visibles
 * de la wiki —la sección "Capítulos en los que aparece" de cada personaje sale
 * de ahí—, pero no había ninguna pantalla para crearlos ni editarlos: sólo se
 * podían tocar por base de datos.
 *
 * El admin genérico sabe gestionar cualquier entidad que tenga estado de
 * publicación y columnas de auditoría. Esta migración se las añade, y con eso
 * heredan lista, alta, edición, papelera, acciones en lote, duplicado, galería y
 * panel de conexiones sin escribir una pantalla nueva.
 *
 * Idempotente.
 *
 * Uso:  node --env-file=.env.local scripts/migrations/migrate-narrativa-admin.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 15 });

/** Tablas que necesitan auditoría (papelera y ordenación por fecha). */
const AUDITORIA = [
  "capitulos",
  "actos",
  "trama_arcos",
  "trama_hojas",
  "hilo_narrativo",
  "canciones",
  "elementos",
];

/** Las que además no tenían estado de publicación propio. */
const PUBLICACION = ["trama_arcos", "trama_hojas", "hilo_narrativo", "elementos"];

try {
  for (const t of AUDITORIA) {
    await sql.unsafe(`alter table ${t} add column if not exists creado_en timestamptz not null default now()`);
    await sql.unsafe(`alter table ${t} add column if not exists actualizado_en timestamptz not null default now()`);
    await sql.unsafe(`alter table ${t} add column if not exists eliminado_en timestamptz`);
  }
  console.log(`✅ 1/4 Auditoría añadida a ${AUDITORIA.length} tablas.`);

  for (const t of PUBLICACION) {
    // Se crean en borrador a propósito: el material de trama suele llevar
    // spoilers, y publicarlo debe ser una decisión explícita del autor.
    await sql.unsafe(
      `alter table ${t} add column if not exists estado_publicacion estado_publicacion not null default 'borrador'`,
    );
    await sql.unsafe(`alter table ${t} add column if not exists publicado_primera_vez_en timestamptz`);
  }
  // El catálogo de elementos ya está en uso en las fichas: si se quedara en
  // borrador, la wiki dejaría de mostrar afinidades y debilidades.
  const elems = await sql.unsafe(
    `update elementos set estado_publicacion = 'publicado'
      where estado_publicacion = 'borrador' returning id`,
  );
  console.log(`✅ 2/4 Estado de publicación añadido a ${PUBLICACION.length} tablas (${elems.length} elementos marcados como publicados).`);

  // Se reutilizan la función y el nombre de disparador que ya usa el resto de
  // entidades (`set_actualizado_en` / `trg_<tabla>_actualizado`) en lugar de
  // crear una tercera función equivalente.
  let disparadores = 0;
  for (const t of AUDITORIA) {
    const nombre = `trg_${t}_actualizado`;
    await sql.unsafe(`drop trigger if exists ${nombre} on ${t}`);
    await sql.unsafe(
      `create trigger ${nombre} before update on ${t}
         for each row execute function set_actualizado_en()`,
    );
    disparadores++;
  }
  console.log(`✅ 3/4 ${disparadores} disparadores de \`actualizado_en\` en su sitio.`);

  // Capítulos y arcos tienen ficha pública, así que entran en el índice de
  // búsqueda como el resto. Importa doblemente porque el Atlas saca sus nodos de
  // `search_index`: sin esto, sus aristas se dibujarían contra el vacío.
  const BUSCABLES = [
    ["capitulos", "capitulos"],
    ["trama_arcos", "arcos"],
  ];
  for (const [tabla, tipo] of BUSCABLES) {
    await sql.unsafe(`drop trigger if exists trg_search_${tipo} on ${tabla}`);
    await sql.unsafe(
      `create trigger trg_search_${tipo}
         after insert or update or delete on ${tabla}
         for each row execute function search_index_sync('${tipo}', '${tipo}')`,
    );
    // Reindexa lo que ya existe disparando el trigger sin cambiar datos.
    await sql.unsafe(`update ${tabla} set actualizado_en = actualizado_en`);
  }
  console.log(`✅ 4/4 ${BUSCABLES.length} entidades enganchadas al buscador.`);

  const resumen = await sql.unsafe(`
    select table_name,
           count(*) filter (where column_name in ('creado_en','actualizado_en','eliminado_en'))::int auditoria,
           count(*) filter (where column_name = 'estado_publicacion')::int estado
      from information_schema.columns
     where table_schema = 'public' and table_name = any($1)
     group by table_name order by table_name`, [AUDITORIA]);
  console.log("\nEstado final:");
  for (const r of resumen) {
    console.log(`  ${r.table_name.padEnd(16)} auditoría ${r.auditoria}/3  estado ${r.estado}/1`);
  }
  console.log("\n🎉 Listo. Estas entidades ya pueden gestionarse desde el admin genérico.");
} finally {
  await sql.end();
}
