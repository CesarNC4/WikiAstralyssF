/**
 * La huella de partida de cada ficha ya publicada (va después de `migrate-huellas.ts`).
 *
 * Sin ella, el primer aviso de un cambio en una ficha publicada antes del
 * 2026-11-11 no podría decir qué campos cambiaron. Toma lo que se ve ahora de
 * cada ficha publicada de los tipos con aviso y lo guarda en `discord_huella`. No
 * toca las fichas que ya tienen huella ni ningún otro dato.
 *
 * Uso (necesita el código de la web, por eso va con el registrador):
 *     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning \
 *          --import ./scripts/lore/registrar.mjs --env-file=.env.local scripts/migrations/sembrar-huellas.ts   (ENSAYO)
 *     … scripts/migrations/sembrar-huellas.ts --aplicar
 *
 * El ensayo lee y calcula todo, pero no escribe. Idempotente.
 */
import { getTableColumns } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordHuella } from "@/db/schema";
import { guardarHuella, leerHuella } from "@/lib/discord-huella";
import { TIPOS_CON_AVISO } from "@/lib/discord-tipos";
import { infoDe } from "@/lib/relaciones/tablas";

const APLICAR = process.argv.includes("--aplicar");
const A_LA_VEZ = 4;

console.log(APLICAR ? "⚙️  APLICANDO: se guardan las huellas…\n" : "🔍 ENSAYO (se calcula todo, no se escribe nada)\n");

// En el ensayo, la tabla puede no existir todavía (la crea migrate-huellas.ts).
const ya = new Set<string>();
try {
  for (const f of await db.select({ t: discordHuella.entidadTipo, id: discordHuella.entidadId }).from(discordHuella)) ya.add(`${f.t}:${f.id}`);
} catch (e) {
  if (APLICAR) throw e;
  console.log("   (discord_huella aún no existe: se calcula como si estuviera vacía)\n");
}
let total = 0;
let fallos = 0;

for (const { tipo } of TIPOS_CON_AVISO) {
  const info = infoDe(tipo);
  if (!info) continue;
  const c = getTableColumns(info.tabla) as unknown as Record<string, PgColumn>;
  const filas = (await db.select({ id: c.id, ...(c.estadoPublicacion ? { estado: c.estadoPublicacion } : {}), ...(c.eliminadoEn ? { borrado: c.eliminadoEn } : {}) }).from(info.tabla)) as {
    id: number;
    estado?: string | null;
    borrado?: Date | null;
  }[];
  // Publicadas y fuera de la papelera; el gremio no tiene estado: siempre a la vista.
  const ids = filas.filter((f) => (!c.estadoPublicacion || f.estado === "publicado") && !f.borrado).map((f) => f.id).filter((id) => !ya.has(`${tipo}:${id}`));
  let hechas = 0;
  for (let i = 0; i < ids.length; i += A_LA_VEZ) {
    await Promise.all(
      ids.slice(i, i + A_LA_VEZ).map(async (id) => {
        try {
          const l = await leerHuella(tipo, id);
          if (!l) return;
          if (APLICAR) await guardarHuella(tipo, id, l);
          hechas++;
        } catch (e) {
          fallos++;
          console.error(`   ❌ ${tipo} #${id}: ${(e as Error).message}`);
        }
      }),
    );
  }
  total += hechas;
  console.log(`   ${tipo}: ${hechas} de ${ids.length} fichas sin huella`);
}

console.log(`\n${APLICAR ? "✅ Guardadas" : "✅ Calculadas (sin guardar)"}: ${total} huellas · fallos: ${fallos}.`);
if (!APLICAR) console.log("   Para guardarlas de verdad: añade --aplicar");
process.exit(fallos ? 1 : 0);
