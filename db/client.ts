import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

/**
 * Cliente Drizzle (postgres-js) conectado al pooler de Supabase.
 * `prepare: false` es obligatorio con el pooler en transaction mode (PgBouncer).
 * Se cachea en globalThis para no abrir múltiples pools en dev (HMR).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // No lanzamos en import para permitir build sin DB; las queries fallarán claras.
  console.warn("[db] DATABASE_URL no está definida. Configúrala en .env.local.");
}

const globalForDb = globalThis as unknown as {
  __astralysSql?: ReturnType<typeof postgres>;
  __astralysSqlTx?: ReturnType<typeof postgres>;
};

/**
 * Sin pipelining (`max_pipeline: 0`). Con `prepare: false`, cada consulta con
 * parámetros se envía en dos tiempos: Parse+Describe, y el Bind cuando llegan los
 * tipos. Si postgres.js encola en la misma conexión una consulta así detrás de
 * otra, el pooler de Supabase en modo transacción puede soltar la conexión del
 * servidor entre medias, y la consulta se queda colgada esperando un Bind que va
 * a otra parte hasta que la mata el statement_timeout (2 min).
 *
 * Reproducido: con pipelining se colgaban consultas en la segunda ronda de una
 * mezcla con y sin parámetros; sin él, quince rondas limpias.
 *
 * Los tipos de postgres.js no declaran `max_pipeline`, aunque la librería lo lee
 * (está en su lista de opciones numéricas); por eso va en una variable con el
 * tipo ampliado en lugar de en el literal.
 *
 * Pero `max_pipeline: 0` rompe las transacciones: `sql.begin` solo reserva la
 * conexión si `sent.length < max_pipeline`, y con 0 eso nunca se cumple, así
 * que todo `db.transaction` fallaba con UNSAFE_TRANSACTION. Las transacciones
 * van por eso en un pool aparte con el pipelining normal: dentro de una
 * transacción el pooler mantiene fija la conexión del servidor hasta el commit,
 * y el cuelgue de arriba no puede darse.
 */
const opciones: postgres.Options<Record<string, never>> & { max_pipeline: number } = {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  max_pipeline: 0,
};

const sql = globalForDb.__astralysSql ?? postgres(connectionString ?? "postgresql://invalid", opciones);
const sqlTx =
  globalForDb.__astralysSqlTx ??
  postgres(connectionString ?? "postgresql://invalid", { prepare: false, max: 3, idle_timeout: 20 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__astralysSql = sql;
  globalForDb.__astralysSqlTx = sqlTx;
}

const dbTx = drizzle(sqlTx, { schema: { ...schema, ...relations } });

export const db = Object.assign(drizzle(sql, { schema: { ...schema, ...relations } }), {
  transaction: dbTx.transaction.bind(dbTx),
});
