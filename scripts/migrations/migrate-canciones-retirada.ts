/**
 * Canciones — Fase 6 de docs/fragmentos-y-musica.md (§4): limpieza. DESTRUCTIVA.
 *
 * Va después de desplegar las Fases 3–5, cuando el código ya no lee nada de lo
 * que se retira:
 *  1. Copia a `respaldo_canciones` (jsonb) todas las filas que se van a borrar.
 *  2. Borra las canciones de prueba (Poema, Prueba, Prueba 2: el autor confirmó
 *     que se pueden borrar) y sus vínculos genéricos. Su audio propio, si lo
 *     tenían, queda sin referencias en `media_assets` y lo borra de Cloudinary
 *     la purga automática en el siguiente guardado del panel.
 *  3. Retira las tablas viejas `acto_cancion`, `hoja_cancion` (sin uso desde
 *     antes del plan), `personaje_cancion` y `capitulo_cancion` (sin uso desde
 *     la Fase 3: esas relaciones van en `vinculo`).
 *  4. Retira el catálogo `cancion_fuente` (pregunta abierta 3, el autor dijo
 *     que sí): la fuente se deduce sola desde la Fase 3. La columna
 *     `canciones.tipo_fuente` se queda, como dato derivado.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-canciones-retirada.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-canciones-retirada.ts --aplicar
 *
 * Idempotente: repetirla no encuentra nada que borrar.
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

/** Las canciones de prueba, por id y título: si alguno no cuadra, no se borra nada. */
const PRUEBA: [number, string][] = [
  [2, "Poema"],
  [3, "Prueba"],
  [4, "Prueba 2"],
];

const TABLAS_VIEJAS = ["acto_cancion", "hoja_cancion", "personaje_cancion", "capitulo_cancion"];

async function existe(tx: Tx, tabla: string): Promise<boolean> {
  const [r] = await tx<{ ok: boolean }[]>`select to_regclass(${"public." + tabla}) is not null as ok`;
  return r.ok;
}

async function respaldar(tx: Tx, tabla: string, donde: string, params: unknown[] = []): Promise<number> {
  const filas = await tx.unsafe(`select to_jsonb(t) as fila from ${tabla} t ${donde}`, params as never[]);
  for (const f of filas) await tx`insert into respaldo_canciones (tabla, fila) values (${tabla}, ${f.fila})`;
  return filas.length;
}

async function trabajo(tx: Tx) {
  await tx.unsafe(`
    create table if not exists respaldo_canciones (
      id serial primary key,
      tabla varchar not null,
      fila jsonb not null,
      respaldado_en timestamp not null default now()
    )`);

  // 1–2. Canciones de prueba.
  const ids = PRUEBA.map(([id]) => id);
  const actuales = await tx<{ id: number; titulo: string }[]>`select id, titulo from canciones where id in ${tx(ids)}`;
  const raras = actuales.filter((c) => PRUEBA.find(([id]) => id === c.id)?.[1] !== c.titulo);
  if (raras.length) throw new Error(`Estas canciones no son las de prueba: ${raras.map((c) => `#${c.id} ${c.titulo}`).join(", ")}. No se borra nada.`);
  if (actuales.length) {
    const r1 = await respaldar(tx, "canciones", "where id = any($1)", [ids]);
    const r2 = await respaldar(tx, "vinculo", "where destino_tipo = 'canciones' and destino_id = any($1)", [ids]);
    const v = await tx`delete from vinculo where destino_tipo = 'canciones' and destino_id in ${tx(ids)}`;
    const c = await tx`delete from canciones where id in ${tx(ids)}`;
    console.log(`✅ Canciones de prueba: ${c.count} borradas y ${v.count} vínculos (respaldadas ${r1} + ${r2} filas).`);
  } else {
    console.log("·  Canciones de prueba: ya no están.");
  }

  // 3. Tablas viejas.
  for (const t of TABLAS_VIEJAS) {
    if (!(await existe(tx, t))) {
      console.log(`·  ${t}: ya retirada.`);
      continue;
    }
    const n = await respaldar(tx, t, "");
    await tx.unsafe(`drop table ${t}`);
    console.log(`✅ ${t}: retirada (${n} filas respaldadas).`);
  }

  // 4. Catálogo cancion_fuente.
  const nCat = await respaldar(tx, "catalogos", "where campo = 'cancion_fuente'");
  if (nCat) {
    await tx`delete from catalogos where campo = 'cancion_fuente'`;
    console.log(`✅ Catálogo cancion_fuente: ${nCat} opciones retiradas (respaldadas).`);
  } else {
    console.log("·  Catálogo cancion_fuente: ya retirado.");
  }

  const [quedan] = await tx<{ n: number }[]>`select count(*)::int as n from canciones`;
  const [huerfanos] = await tx<{ n: number }[]>`
    select count(*)::int as n from media_assets a
     where a.tipo = 'audio' and not exists (select 1 from canciones c where c.audio_asset_id = a.id)`;
  console.log(`\n   Canciones que quedan: ${quedan.n}. Audios sin canción (los purga el panel al guardar): ${huerfanos.n}.`);
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
