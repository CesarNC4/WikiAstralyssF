import postgres from "postgres";
import dns from "node:dns/promises";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.log("❌ DATABASE_URL no está definida en .env.local");
  process.exit(1);
}
const m = url.match(/postgres(?:\.[^:]+)?:([^@]+)@/);
const password = m ? decodeURIComponent(m[1]) : "";
const ref = "xjalihfqzitkxlskxyih";

console.log("== 1) ¿Resuelve la API REST de Supabase? (debería: es lo que usa el navegador) ==");
try {
  const r = await dns.lookup(`${ref}.supabase.co`);
  console.log("   OK:", `${ref}.supabase.co`, "->", r.address);
} catch (e) {
  console.log("   FALLO:", e.code, "(sin internet o DNS bloqueado)");
}

console.log("\n== 2) Probando conexiones Postgres (Drizzle) ==");
const candidates = [
  { label: "Transaction pooler aws-0/6543", host: `aws-0-us-east-1.pooler.supabase.co`, port: 6543, user: `postgres.${ref}` },
  { label: "Transaction pooler aws-1/6543", host: `aws-1-us-east-1.pooler.supabase.co`, port: 6543, user: `postgres.${ref}` },
  { label: "Session pooler aws-0/5432", host: `aws-0-us-east-1.pooler.supabase.co`, port: 5432, user: `postgres.${ref}` },
  { label: "Conexión directa/5432", host: `db.${ref}.supabase.co`, port: 5432, user: `postgres` },
];

let ganador = null;
for (const c of candidates) {
  const conn = `postgresql://${c.user}:${encodeURIComponent(password)}@${c.host}:${c.port}/postgres`;
  try {
    const sql = postgres(conn, { prepare: false, connect_timeout: 8 });
    const rows = await sql`select count(*)::int as n from personajes`;
    console.log(`   ✅ ${c.label}  → personajes = ${rows[0].n}`);
    ganador = c;
    await sql.end();
    break;
  } catch (e) {
    console.log(`   ✗ ${c.label}: ${e.code ?? ""} ${String(e.message).slice(0, 50)}`);
  }
}

console.log("\n== RESULTADO ==");
if (ganador) {
  console.log(`✅ Usa este host en .env.local: ${ganador.host}:${ganador.port}`);
  console.log(`   DATABASE_URL="postgresql://${ganador.user}:[TU-PASSWORD]@${ganador.host}:${ganador.port}/postgres"`);
} else {
  console.log("❌ Ninguna conexión Postgres funcionó.");
  console.log("   Causas típicas: contraseña incorrecta, o tu red no permite estos puertos/IPv6.");
  console.log("   👉 Pega en el chat la salida completa de este script y decidimos el siguiente paso.");
}
