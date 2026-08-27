/**
 * Siembra la tabla `catalogos` y la tabla `elementos` desde `lib/catalogos.ts`
 * y `lib/elementos.ts`.
 *
 * Uso:  node --env-file=.env.local scripts/seed-catalogos.ts
 *
 * ADITIVO a propósito. Antes era un espejo estricto que borraba de la base todo
 * lo que no estuviera en el archivo; con la pantalla /admin/catalogos eso
 * destruiría el trabajo hecho desde el panel. Ahora:
 *  - inserta lo que falta,
 *  - corrige el orden de lo que ya existe (para que el archivo mande en cómo se
 *    ordenan los desplegables),
 *  - y NO borra nada.
 *
 * Idempotente: se puede correr las veces que haga falta.
 */
import postgres from "postgres";
import { CATALOGOS, CATALOGOS_AGRUPADOS } from "../lib/catalogos.ts";
import { ELEMENTOS } from "../lib/elementos.ts";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 15 });

type Fila = { campo: string; grupo: string | null; valor: string; orden: number };
const semilla: Fila[] = [];
for (const [campo, valores] of Object.entries(CATALOGOS)) {
  (valores as readonly string[]).forEach((valor, i) => semilla.push({ campo, grupo: null, valor, orden: i }));
}
for (const [campo, grupos] of Object.entries(CATALOGOS_AGRUPADOS)) {
  for (const [grupo, valores] of Object.entries(grupos as Record<string, readonly string[]>)) {
    valores.forEach((valor, i) => semilla.push({ campo, grupo, valor, orden: i }));
  }
}

try {
  const antes = Number((await sql`SELECT count(*)::int AS n FROM catalogos`)[0].n);

  let insertados = 0;
  let reordenados = 0;

  await sql.begin(async (tx) => {
    for (const f of semilla) {
      // `grupo` puede ser NULL, así que la comparación va con IS NOT DISTINCT FROM.
      const [ya] = await tx`
        SELECT id, orden FROM catalogos
        WHERE campo = ${f.campo} AND valor = ${f.valor}
          AND grupo IS NOT DISTINCT FROM ${f.grupo}
        LIMIT 1`;
      if (!ya) {
        await tx`INSERT INTO catalogos (campo, grupo, valor, orden)
                 VALUES (${f.campo}, ${f.grupo}, ${f.valor}, ${f.orden})`;
        insertados++;
      } else if (ya.orden !== f.orden) {
        await tx`UPDATE catalogos SET orden = ${f.orden} WHERE id = ${ya.id}`;
        reordenados++;
      }
    }
  });

  // Elementos: su propia tabla, con familia, color e icono.
  let elemNuevos = 0;
  let elemActualizados = 0;
  await sql.begin(async (tx) => {
    for (const [i, e] of ELEMENTOS.entries()) {
      const [ya] = await tx`SELECT id, nombre, familia FROM elementos WHERE slug = ${e.slug} LIMIT 1`;
      if (!ya) {
        await tx`INSERT INTO elementos (slug, nombre, familia, color, icono, orden, estado_publicacion)
                 VALUES (${e.slug}, ${e.nombre}, ${e.familia}, ${e.color}, ${e.icono}, ${i}, 'publicado')`;
        elemNuevos++;
      } else if (ya.nombre !== e.nombre || ya.familia !== e.familia) {
        // Renombrar respeta los vínculos: se hace por slug, no por nombre.
        await tx`UPDATE elementos SET nombre = ${e.nombre}, familia = ${e.familia}, orden = ${i} WHERE id = ${ya.id}`;
        elemActualizados++;
      } else {
        await tx`UPDATE elementos SET orden = ${i} WHERE id = ${ya.id}`;
      }
    }
  });

  const despues = Number((await sql`SELECT count(*)::int AS n FROM catalogos`)[0].n);
  const resumen = await sql`SELECT campo, count(*)::int AS n FROM catalogos GROUP BY campo ORDER BY campo`;

  console.log("✅ Catálogos sembrados (aditivo, no se borró nada).");
  console.log(`   filas: ${antes} → ${despues}   (${insertados} nuevas, ${reordenados} reordenadas)`);
  console.log(`   elementos: ${elemNuevos} nuevos, ${elemActualizados} actualizados`);
  console.log("");
  for (const r of resumen) console.log(`   ${String(r.campo).padEnd(26)} ${r.n}`);
} finally {
  await sql.end();
}
