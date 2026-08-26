/**
 * Frente E — Conectividad. Prepara la base para el sistema de relaciones
 * bidireccionales. Hace cuatro cosas, en este orden y de forma idempotente:
 *
 *   1. Comprueba que no haya filas huérfanas antes de tocar nada. Si las hay,
 *      aborta sin escribir: añadir una clave foránea sobre datos rotos falla
 *      a medias y deja la migración en un estado difícil de deshacer.
 *   2. Unifica `personaje_organizacion` dentro de `org_jerarquia`, que ya era
 *      la tabla más rica. Familias y gremio ya funcionaban así; organizaciones
 *      era la excepción y obligaba a deduplicar miembros en la ficha pública.
 *   3. Crea `vinculo`, la tabla genérica de aristas ficha↔ficha.
 *   4. Añade las claves foráneas que faltaban y los índices de las columnas
 *      de relación, que hasta ahora se recorrían sin índice.
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "", { prepare: false, connect_timeout: 15 });

/** [tabla, columna, tabla referida, acción al borrar] */
const FKS = [
  ["bestia_drop", "bestia_id", "bestias", "CASCADE"],
  ["bestia_drop", "mineral_id", "minerales", "CASCADE"],
  ["bestia_nacion", "bestia_id", "bestias", "CASCADE"],
  ["bestia_nacion", "nacion_id", "naciones", "CASCADE"],
  ["bestia_region", "bestia_id", "bestias", "CASCADE"],
  ["bestia_region", "region_id", "regiones", "CASCADE"],
  ["bestia_relacion", "bestia_id", "bestias", "CASCADE"],
  ["bestia_relacion", "relacionada_id", "bestias", "CASCADE"],
  ["mineral_artefacto", "mineral_id", "minerales", "CASCADE"],
  ["mineral_artefacto", "artefacto_id", "armas_artefactos", "CASCADE"],
  ["mineral_uso", "mineral_id", "minerales", "CASCADE"],
  ["nacion_diplomacia", "nacion_id", "naciones", "CASCADE"],
  ["nacion_diplomacia", "otra_nacion_id", "naciones", "CASCADE"],
  ["entidad_elemento", "elemento_id", "elementos", "CASCADE"],
  ["personaje_evento", "personaje_id", "personajes", "CASCADE"],
  ["personaje_evento", "timeline_evento_id", "timeline_eventos", "CASCADE"],
  ["personaje_objeto", "personaje_id", "personajes", "CASCADE"],
  ["personaje_objeto", "arma_artefacto_id", "armas_artefactos", "CASCADE"],
  ["familia_rangos", "familia_id", "familias", "CASCADE"],
  ["familia_jerarquia", "rango_id", "familia_rangos", "SET NULL"],
  ["razas", "raza_padre_id", "razas", "SET NULL"],
  ["minerales", "valor_moneda_id", "sistema_monetario", "SET NULL"],
  ["regiones", "nacion_id", "naciones", "SET NULL"],
  ["locaciones", "nacion_id", "naciones", "SET NULL"],
  ["locaciones", "region_id", "regiones", "SET NULL"],
  ["locaciones", "evento_id", "timeline_eventos", "SET NULL"],
  ["personajes", "lugar_nacimiento_nacion_id", "naciones", "SET NULL"],
  ["personajes", "lugar_nacimiento_region_id", "regiones", "SET NULL"],
  ["personajes", "lugar_nacimiento_locacion_id", "locaciones", "SET NULL"],
  ["armas_artefactos", "imagen_asset_id", "media_assets", "SET NULL"],
  ["bestias", "imagen_asset_id", "media_assets", "SET NULL"],
  ["canciones", "imagen_asset_id", "media_assets", "SET NULL"],
  ["conceptos", "imagen_asset_id", "media_assets", "SET NULL"],
  ["familias", "imagen_asset_id", "media_assets", "SET NULL"],
  ["gremio", "imagen_asset_id", "media_assets", "SET NULL"],
  ["locaciones", "imagen_asset_id", "media_assets", "SET NULL"],
  ["lord_demonio", "imagen_asset_id", "media_assets", "SET NULL"],
  ["magia_fundamentos", "imagen_asset_id", "media_assets", "SET NULL"],
  ["minerales", "imagen_asset_id", "media_assets", "SET NULL"],
  ["misiones", "imagen_asset_id", "media_assets", "SET NULL"],
  ["naciones", "imagen_asset_id", "media_assets", "SET NULL"],
  ["organizaciones", "imagen_asset_id", "media_assets", "SET NULL"],
  ["paginas_lore", "imagen_asset_id", "media_assets", "SET NULL"],
  ["personajes", "imagen_asset_id", "media_assets", "SET NULL"],
  ["razas", "imagen_asset_id", "media_assets", "SET NULL"],
  ["regiones", "imagen_asset_id", "media_assets", "SET NULL"],
  ["sistema_monetario", "imagen_asset_id", "media_assets", "SET NULL"],
  ["bestias", "banner_asset_id", "media_assets", "SET NULL"],
  ["familias", "banner_asset_id", "media_assets", "SET NULL"],
  ["gremio", "banner_asset_id", "media_assets", "SET NULL"],
  ["locaciones", "banner_asset_id", "media_assets", "SET NULL"],
  ["lord_demonio", "banner_asset_id", "media_assets", "SET NULL"],
  ["minerales", "banner_asset_id", "media_assets", "SET NULL"],
  ["naciones", "banner_asset_id", "media_assets", "SET NULL"],
  ["organizaciones", "banner_asset_id", "media_assets", "SET NULL"],
  ["paginas_lore", "banner_asset_id", "media_assets", "SET NULL"],
  ["personajes", "banner_asset_id", "media_assets", "SET NULL"],
  ["razas", "banner_asset_id", "media_assets", "SET NULL"],
  ["regiones", "banner_asset_id", "media_assets", "SET NULL"],
];

/** Índices para recorrer una relación por cualquiera de sus dos extremos. */
const INDICES = [
  ["bestia_drop", "bestia_id"],
  ["bestia_drop", "mineral_id"],
  ["bestia_nacion", "bestia_id"],
  ["bestia_nacion", "nacion_id"],
  ["bestia_region", "bestia_id"],
  ["bestia_region", "region_id"],
  ["bestia_relacion", "bestia_id"],
  ["bestia_relacion", "relacionada_id"],
  ["mineral_artefacto", "mineral_id"],
  ["mineral_artefacto", "artefacto_id"],
  ["mineral_uso", "mineral_id"],
  ["nacion_diplomacia", "nacion_id"],
  ["nacion_diplomacia", "otra_nacion_id"],
  ["nacion_raza", "nacion_id"],
  ["nacion_raza", "raza_id"],
  ["nacion_organizacion", "nacion_id"],
  ["nacion_organizacion", "organizacion_id"],
  ["personaje_nacion", "personaje_id"],
  ["personaje_nacion", "nacion_id"],
  ["personaje_raza", "personaje_id"],
  ["personaje_raza", "raza_id"],
  ["personaje_evento", "personaje_id"],
  ["personaje_evento", "timeline_evento_id"],
  ["personaje_objeto", "personaje_id"],
  ["personaje_objeto", "arma_artefacto_id"],
  ["capitulo_personaje", "personaje_id"],
  ["capitulo_personaje", "capitulo_id"],
  ["org_jerarquia", "organizacion_id"],
  ["org_jerarquia", "personaje_id"],
  ["familia_jerarquia", "familia_id"],
  ["familia_jerarquia", "personaje_id"],
  ["familia_arbol", "familia_id"],
  ["familia_arbol", "personaje_id"],
  ["gremio_jerarquia", "gremio_id"],
  ["gremio_jerarquia", "personaje_id"],
  ["entidad_elemento", "elemento_id"],
];

/** Evita fallar si una columna aún no existe en esta base. */
async function hayColumna(tabla, columna) {
  const r = await sql.unsafe(
    `select 1 from information_schema.columns
      where table_schema = 'public' and table_name = '${tabla}' and column_name = '${columna}'`,
  );
  return r.length > 0;
}

try {
  // ── 1) Comprobación previa: nada de escribir sobre datos rotos ─────────────
  const huerfanos = [];
  for (const [t, c, ref] of FKS) {
    if (!(await hayColumna(t, c))) continue;
    const r = await sql.unsafe(
      `select count(*)::int n from "${t}" x
        where x."${c}" is not null
          and not exists (select 1 from "${ref}" r where r.id = x."${c}")`,
    );
    if (r[0].n > 0) huerfanos.push(`${t}.${c} -> ${ref}: ${r[0].n} filas apuntan a algo que no existe`);
  }
  if (huerfanos.length > 0) {
    console.error("❌ Hay filas huérfanas. No se ha tocado nada.");
    for (const h of huerfanos) console.error("   " + h);
    console.error("\nLimpia esas filas y vuelve a lanzar la migración.");
    process.exit(1);
  }
  console.log("✅ 1/4 Sin filas huérfanas: se puede añadir integridad con seguridad.");

  // ── 2) Unificar personaje_organizacion dentro de org_jerarquia ────────────
  const tieneTablaVieja = await sql.unsafe(
    `select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'personaje_organizacion'`,
  );
  if (tieneTablaVieja.length > 0) {
    for (const col of ["rol", "tipo", "descripcion"]) {
      await sql.unsafe(`alter table org_jerarquia add column if not exists ${col} varchar`);
    }
    // Miembro ya presente en la jerarquía: se completa sin pisar lo que hubiera.
    const fusionadas = await sql.unsafe(
      `update org_jerarquia j
          set rol = coalesce(j.rol, po.rol),
              tipo = coalesce(j.tipo, po.tipo),
              descripcion = coalesce(j.descripcion, po.descripcion)
         from personaje_organizacion po
        where j.organizacion_id = po.organizacion_id and j.personaje_id = po.personaje_id
        returning j.id`,
    );
    // Miembro que solo existía como pertenencia: entra al final de la jerarquía.
    const nuevas = await sql.unsafe(
      `insert into org_jerarquia (organizacion_id, personaje_id, rol, tipo, descripcion, orden)
       select po.organizacion_id, po.personaje_id, po.rol, po.tipo, po.descripcion,
              coalesce((select max(orden) from org_jerarquia j
                         where j.organizacion_id = po.organizacion_id), 0)
              + row_number() over (partition by po.organizacion_id order by po.id)
         from personaje_organizacion po
        where not exists (
          select 1 from org_jerarquia j
           where j.organizacion_id = po.organizacion_id and j.personaje_id = po.personaje_id)
       returning id`,
    );
    await sql.unsafe(`drop table personaje_organizacion`);
    console.log(
      `✅ 2/4 Organizaciones unificadas: ${fusionadas.length} miembros completados, ` +
        `${nuevas.length} añadidos a la jerarquía, tabla vieja eliminada.`,
    );
  } else {
    console.log("✅ 2/4 Organizaciones ya estaban unificadas.");
  }

  // ── 3) Tabla genérica de vínculos ficha↔ficha ─────────────────────────────
  // Una sola tabla en lugar de una por pareja: la mayoría de relaciones nuevas
  // solo necesitan qué tipo de vínculo es y una nota. Añadir una relación más
  // pasa a ser una entrada en el registro de código, sin migrar la base.
  // El destino es polimórfico y por eso no lleva clave foránea; la limpieza de
  // huérfanos va por código, igual que ya se hace con entidad_media.
  await sql.unsafe(`
    create table if not exists vinculo (
      id serial primary key,
      origen_tipo varchar not null,
      origen_id integer not null,
      destino_tipo varchar not null,
      destino_id integer not null,
      relacion varchar,
      tipo varchar,
      nota varchar,
      orden integer not null default 0,
      creado_en timestamp with time zone not null default now()
    )`);
  // Por si la tabla ya existía de una ejecución anterior sin esta columna.
  await sql.unsafe(`alter table vinculo add column if not exists tipo varchar`);
  await sql.unsafe(`create index if not exists vinculo_origen_idx on vinculo (origen_tipo, origen_id)`);
  await sql.unsafe(`create index if not exists vinculo_destino_idx on vinculo (destino_tipo, destino_id)`);
  await sql.unsafe(`create index if not exists vinculo_relacion_idx on vinculo (relacion)`);
  console.log("✅ 3/4 Tabla `vinculo` lista.");

  // ── 4) Claves foráneas e índices que faltaban ─────────────────────────────
  let fkNuevas = 0;
  let fkYa = 0;
  for (const [t, c, ref, accion] of FKS) {
    if (!(await hayColumna(t, c))) continue;
    // Se comprueba por columna, no por nombre: varias claves ya existen con un
    // nombre distinto al que generaríamos aquí.
    const ya = await sql.unsafe(
      `select 1
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on kcu.constraint_name = tc.constraint_name
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = 'public'
          and tc.table_name = '${t}'
          and kcu.column_name = '${c}'`,
    );
    if (ya.length > 0) { fkYa++; continue; }
    const nombre = `${t}_${c}_fkey`;
    await sql.unsafe(
      `alter table "${t}" add constraint "${nombre}"
         foreign key ("${c}") references "${ref}"(id) on delete ${accion}`,
    );
    fkNuevas++;
  }
  let idxNuevos = 0;
  for (const [t, c] of INDICES) {
    if (!(await hayColumna(t, c))) continue;
    await sql.unsafe(`create index if not exists "${t}_${c}_idx" on "${t}" ("${c}")`);
    idxNuevos++;
  }
  console.log(`✅ 4/4 Claves foráneas: ${fkNuevas} nuevas, ${fkYa} ya existían. Índices asegurados: ${idxNuevos}.`);

  const total = await sql.unsafe(
    `select count(*)::int n from information_schema.table_constraints
      where constraint_type = 'FOREIGN KEY' and table_schema = 'public'`,
  );
  console.log(`\n🎉 Listo. La base tiene ahora ${total[0].n} claves foráneas.`);
} finally {
  await sql.end();
}
