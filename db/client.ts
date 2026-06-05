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
};

const sql =
  globalForDb.__astralysSql ??
  postgres(connectionString ?? "postgresql://invalid", {
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__astralysSql = sql;
}

export const db = drizzle(sql, { schema: { ...schema, ...relations } });
