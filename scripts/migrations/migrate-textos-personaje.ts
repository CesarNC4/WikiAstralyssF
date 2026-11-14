/**
 * Quita el límite de 255 caracteres a los campos de texto largo del personaje que aún lo
 * tenían en la base: Filosofía, Circuito Forte, Essentia, Zenithra, Bendición y Segundo
 * despertar (2026-11-14).
 *
 * El formulario y la bandeja de propuestas los tratan como texto largo, pero sus columnas
 * eran `varchar(255)`: un texto más largo hacía fallar el guardado de la ficha entera.
 * Pasan a `text`, como los demás textos largos (Historia, Motivación, Miedos…). Solo
 * amplía: no cambia ni recorta ningún dato.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-textos-personaje.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-textos-personaje.ts --aplicar
 *
 * Idempotente.
 */
import postgres from "postgres";

const APLICAR = process.argv.includes("--aplicar");
const COLUMNAS = ["filosofia", "circuito_forte", "essentia", "zenithra", "bendicion", "segundo_despertar"];

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 1, onnotice: () => {} });

type Tx = postgres.TransactionSql;

async function columnas(tx: Tx) {
  return tx<{ columna: string; tipo: string; limite: number | null }[]>`
    select column_name as columna, data_type as tipo, character_maximum_length as limite
      from information_schema.columns
     where table_schema = 'public' and table_name = 'personajes' and column_name in ${tx(COLUMNAS)}
     order by column_name`;
}

async function trabajo(tx: Tx) {
  const antes = await columnas(tx);
  if (antes.length !== COLUMNAS.length) throw new Error(`Faltan columnas: hay ${antes.length} de ${COLUMNAS.length}.`);
  // Huella de los valores, para comprobar que no cambia ninguno.
  const huella = async () => {
    const [h] = await tx<{ h: string }[]>`
      select md5(string_agg(concat_ws('|', id, filosofia, circuito_forte, essentia, zenithra, bendicion, segundo_despertar), ',' order by id)) as h
        from personajes`;
    return h.h;
  };
  const h0 = await huella();

  const conLimite = antes.filter((c) => c.limite != null);
  for (const c of conLimite) await tx.unsafe(`alter table personajes alter column "${c.columna}" type text`);
  console.log(`✅ Pasan a texto sin límite: ${conLimite.map((c) => `${c.columna} (antes ${c.tipo} ${c.limite})`).join(", ") || "ninguna (ya lo estaban)"}.`);

  const despues = await columnas(tx);
  const h1 = await huella();
  console.log(`\n   Ahora: ${despues.map((c) => `${c.columna} ${c.tipo}${c.limite ? ` ${c.limite}` : ""}`).join(" · ")}`);
  console.log(`   Valores: ${h0 === h1 ? "idénticos" : "¡CAMBIARON!"}`);
  if (h0 !== h1 || despues.some((c) => c.limite != null)) throw new Error("La comprobación no cuadra: no se aplica.");
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
