/**
 * Comprueba que los catálogos cuadran con la base de datos.
 *
 * Tres cosas que solo se notarían en tiempo de ejecución, y tarde:
 *  1. que la columna donde dice el código que se usa un catálogo exista de verdad,
 *  2. que cada desplegable declarado en el admin tenga opciones (los que estaban
 *     vacíos decían "Sin opciones" al abrirlos y no había forma de saberlo sin mirar),
 *  3. que ninguna ficha guarde un valor que su catálogo ya no reconoce.
 *
 * Uso:  node --env-file=.env.local scripts/verificar-catalogos.mjs
 * Sale con código 1 si algo no cuadra, así que sirve en un hook o en CI.
 */
import fs from "node:fs";
import postgres from "postgres";
import { USOS_DE_CATALOGO } from "../lib/admin/catalogosMeta.ts";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

let fallos = 0;
let avisos = 0;
const mal = (m) => { console.log("  MAL   " + m); fallos++; };
const ojo = (m) => { console.log("  OJO   " + m); avisos++; };

// Columnas reales.
const filas = await sql`select table_name t, column_name c from information_schema.columns where table_schema='public'`;
const cols = {};
for (const { t, c } of filas) (cols[t] ??= new Set()).add(c);

// Catálogos que existen en la base.
const enBase = await sql`select campo, count(*)::int n from catalogos group by campo`;
const conteo = Object.fromEntries(enBase.map((r) => [r.campo, r.n]));

// ── 1. Las columnas declaradas existen ─────────────────────────────────────
console.log("== columnas donde se usa cada catálogo ==");
let comprobadas = 0;
for (const [campo, usos] of Object.entries(USOS_DE_CATALOGO)) {
  for (const [tabla, columna] of usos) {
    comprobadas++;
    if (!cols[tabla]) { mal(`${campo}: la tabla "${tabla}" no existe`); continue; }
    if (!cols[tabla].has(columna)) mal(`${campo}: ${tabla}.${columna} NO existe`);
  }
}
console.log(`  ${comprobadas} columnas comprobadas`);

// ── 2. Ningún desplegable del admin se queda vacío ─────────────────────────
console.log("== desplegables declarados en el admin ==");
const fieldsSrc = fs.readFileSync("lib/admin/fields.ts", "utf8");
const declarados = new Set([...fieldsSrc.matchAll(/catalogCampo: "([\w_]+)"/g)].map((m) => m[1]));
const registroSrc = fs.readFileSync("lib/relaciones/registro.ts", "utf8");
for (const m of registroSrc.matchAll(/catalogo: "([\w_]+)"/g)) declarados.add(m[1]);

for (const campo of [...declarados].sort()) {
  if (!conteo[campo]) mal(`el desplegable "${campo}" existe en el admin pero NO tiene opciones en la base`);
}
console.log(`  ${declarados.size} desplegables comprobados`);

/**
 * Catálogos cuyo valor guardado es una CLAVE en minúsculas y no la etiqueta.
 *
 * En estos dos el valor de la base se eligió antes de que existiera el catálogo
 * ("texto", "afinidad") y migrarlo no aportaba nada, así que la comparación va
 * sin distinguir mayúsculas. Sin esta excepción el verificador avisaría de algo
 * correcto, y un verificador que grita en falso deja de leerse.
 */
const CLAVE_EN_MINUSCULAS = new Set(["lore_seccion_tipo", "vinculo_entidad_elemento"]);

// ── 3. Valores guardados que su catálogo ya no reconoce ────────────────────
console.log("== valores fuera de catálogo ==");
let revisadas = 0;
for (const [campo, usos] of Object.entries(USOS_DE_CATALOGO)) {
  if (!conteo[campo]) continue;
  for (const [tabla, columna] of usos) {
    if (!cols[tabla]?.has(columna)) continue;
    revisadas++;
    const insensible = CLAVE_EN_MINUSCULAS.has(campo);
    const huerfanos = await sql.unsafe(
      `select distinct t."${columna}"::text as v, count(*)::int as n
         from "${tabla}" t
        where t."${columna}" is not null
          and t."${columna}"::text <> ''
          and not exists (
            select 1 from catalogos c
             where c.campo = $1
               and ${insensible ? `lower(c.valor) = lower(t."${columna}"::text)` : `c.valor = t."${columna}"::text`}
          )
        group by 1 order by 2 desc limit 5`,
      [campo],
    );
    for (const h of huerfanos) {
      ojo(`${tabla}.${columna}: ${h.n} ficha(s) con "${h.v}", que no está en el catálogo "${campo}"`);
    }
  }
}
console.log(`  ${revisadas} columnas revisadas`);

await sql.end();

if (avisos > 0) {
  console.log(
    `\n${avisos} valor(es) fuera de catálogo. No rompen nada, pero el desplegable los muestra en blanco:` +
      "\n   arréglalos desde la ficha o añade la opción en /admin/catalogos.",
  );
}
console.log(fallos === 0 ? "\n✅ Catálogos y base de datos coherentes." : `\n❌ ${fallos} incoherencias.`);
process.exit(fallos ? 1 : 0);
