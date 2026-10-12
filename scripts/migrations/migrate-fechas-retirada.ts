/**
 * Taller · Fase 6 — Retirada de las fechas en texto libre.
 * Ver docs/taller-plan.md (Fase 6, punto 4) y docs/taller-del-autor.md §15.
 *
 * Desde la Fase 1 las fechas viven en `fecha_lore`; desde la Fase 6 nada lee ya
 * las columnas de texto viejas. Este script las retira:
 *
 *  1. Copia cada valor no vacío a `respaldo_fechas_texto` (tabla, fila, columna,
 *     valor), para que nada se pierda: lo que la Fase 1 no supo convertir
 *     ("19 días", "Desconocido") queda ahí para revisarlo a mano.
 *  2. Copia también el catálogo `era`, que pasó a ser la tabla `era`.
 *  3. Borra las columnas y las opciones del catálogo.
 *
 * Destructiva: **solo después** de que el despliegue con las Fases 6 y 7 esté en
 * producción. El código anterior aún lee estas columnas y sus fichas fallarían.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-fechas-retirada.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-fechas-retirada.ts --aplicar
 *
 * Idempotente: lo ya retirado se salta.
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

/** Columnas que se retiran: [tabla, columna]. */
const COLUMNAS: [string, string][] = [
  ["timeline_eventos", "fecha_lore"],
  ["timeline_eventos", "era"],
  ["timeline_eventos", "anio_lore"],
  ["capitulos", "fecha_lore"],
  ["actos", "fecha_inicio_lore"],
  ["actos", "fecha_fin_lore"],
  ["misiones", "fecha_lore"],
  ["lord_demonio", "era_aparicion"],
  ["lord_demonio", "era"],
  ["lord_demonio", "anio_lore"],
  ["organizaciones", "fundacion"],
];

async function existe(tx: Tx, tabla: string, columna: string): Promise<boolean> {
  const [r] = await tx<{ n: number }[]>`
    select count(*)::int as n from information_schema.columns
     where table_schema = 'public' and table_name = ${tabla} and column_name = ${columna}`;
  return r.n > 0;
}

async function trabajo(tx: Tx) {
  await tx.unsafe(`
    create table if not exists respaldo_fechas_texto (
      id serial primary key,
      tabla varchar not null,
      fila_id integer not null,
      columna varchar not null,
      valor text not null,
      respaldado_en timestamptz not null default now(),
      unique (tabla, fila_id, columna)
    )`);
  console.log("✅ Tabla respaldo_fechas_texto lista.\n");

  let respaldados = 0;
  for (const [tabla, columna] of COLUMNAS) {
    if (!(await existe(tx, tabla, columna))) {
      console.log(`   · ${tabla}.${columna}: ya retirada.`);
      continue;
    }
    const filas = await tx.unsafe<{ id: number; valor: string }[]>(
      `select id, ${columna}::text as valor from ${tabla}
        where ${columna} is not null and trim(${columna}::text) not in ('', '—')`,
    );
    for (const f of filas) {
      await tx`
        insert into respaldo_fechas_texto (tabla, fila_id, columna, valor)
        values (${tabla}, ${f.id}, ${columna}, ${f.valor})
        on conflict (tabla, fila_id, columna) do update set valor = excluded.valor`;
    }
    respaldados += filas.length;
    await tx.unsafe(`alter table ${tabla} drop column ${columna}`);
    const muestra = filas.slice(0, 3).map((f) => `"${f.valor}"`).join(", ");
    console.log(`   · ${tabla}.${columna}: ${filas.length} valores respaldados${muestra ? ` (${muestra}${filas.length > 3 ? "…" : ""})` : ""}; columna retirada.`);
  }

  const eras = await tx<{ id: number; valor: string }[]>`select id, valor from catalogos where campo = 'era'`;
  for (const e of eras) {
    await tx`
      insert into respaldo_fechas_texto (tabla, fila_id, columna, valor)
      values ('catalogos', ${e.id}, 'era', ${e.valor})
      on conflict (tabla, fila_id, columna) do nothing`;
  }
  await tx`delete from catalogos where campo = 'era'`;
  console.log(`\n✅ Catálogo era: ${eras.length} opciones respaldadas y retiradas (las eras viven en la tabla era).`);
  console.log(`✅ ${respaldados + eras.length} valores en respaldo_fechas_texto.`);
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
      : "\n✅ Ensayo terminado y revertido. La base está intacta.\n   Para aplicarlo de verdad (solo con el despliegue nuevo en producción): añade --aplicar",
  );
} finally {
  await sql.end();
}
