import fs from "node:fs";
import postgres from "postgres";

// Nombre real de tabla de cada variable Drizzle, leyendo el schema.
const varTabla = {};
for (const f of fs.readdirSync("db/schema")) {
  if (!f.endsWith(".ts") || f === "index.ts") continue;
  const src = fs.readFileSync("db/schema/" + f, "utf8");
  for (const m of src.matchAll(/export const (\w+)\s*=\s*pgTable\(\s*"([^"]+)"/g)) varTabla[m[1]] = m[2];
}

const camel = (c) => c.replace(/_([a-z])/g, (_, x) => x.toUpperCase());
const tablasSrc = fs.readFileSync("lib/relaciones/tablas.ts", "utf8");
const regSrc = fs.readFileSync("lib/relaciones/registro.ts", "utf8");

// Columnas reales por tabla.
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const filas = await sql`select table_name t, column_name c from information_schema.columns where table_schema='public'`;
const cols = {};
for (const { t, c } of filas) (cols[t] ??= new Set()).add(camel(c));
await sql.end();

let fallos = 0;
const mal = (m) => { console.log("  MAL  " + m); fallos++; };

// 1) Entradas de TABLAS_REL: comprobar cada columna citada.
console.log("== columnas de TABLAS_REL ==");
let comprobadas = 0;
const cuerpo = tablasSrc.slice(tablasSrc.indexOf("export const TABLAS_REL"));
for (const m of cuerpo.matchAll(/^\s{2}([\w:"'`${}\.]+?):\s*\{\s*tabla:\s*s\.(\w+),([^}]*)\}/gm)) {
  const [, id, tvar, resto] = m;
  const tabla = varTabla[tvar];
  if (!tabla) { mal(`${id}: variable s.${tvar} no es una pgTable conocida`); continue; }
  for (const c of resto.matchAll(/(colA|colB|pk|orden|colLibre):\s*"(\w+)"/g)) {
    comprobadas++;
    if (!cols[tabla]?.has(c[2])) mal(`${id}: ${tabla}.${c[2]} (${c[1]}) NO existe`);
  }
  for (const c of resto.matchAll(/filtroA:\s*\{\s*col:\s*"(\w+)"/g)) {
    comprobadas++;
    if (!cols[tabla]?.has(c[1])) mal(`${id}: ${tabla}.${c[1]} (filtroA) NO existe`);
  }
}
console.log(`  ${comprobadas} columnas comprobadas`);

// 2) jer() y el bucle de elementos, que no casan con el patrón de arriba.
console.log("== helpers (jerarquias y elementos) ==");
for (const [tvar, colA] of [["orgJerarquia","organizacionId"],["familiaJerarquia","familiaId"],["gremioJerarquia","gremioId"]]) {
  for (const c of [colA, "personajeId", "id", "orden", "nombre"]) {
    if (!cols[varTabla[tvar]]?.has(c)) mal(`${tvar}: falta ${c}`);
  }
}
for (const c of ["entidadId","elementoId","id","orden","entidadTipo","relacion"]) {
  if (!cols["entidad_elemento"]?.has(c)) mal(`entidad_elemento: falta ${c}`);
}

// 3) Campos declarados en el registro para relaciones medio:"tabla".
console.log("== campos del registro sobre tablas propias ==");
const mapaTabla = {};
for (const m of cuerpo.matchAll(/^\s{2}([\w_]+):\s*\{\s*tabla:\s*s\.(\w+)/gm)) mapaTabla[m[1]] = varTabla[m[2]];
Object.assign(mapaTabla, { org_jerarquia: "org_jerarquia", familia_jerarquia: "familia_jerarquia", gremio_jerarquia: "gremio_jerarquia" });
let campos = 0;
// Se trocea por las líneas `id:` porque los bloques del registro tienen
// anidamiento variable (hay declaraciones sueltas y otras generadas con .map).
for (const trozo of regSrc.split(/\n\s+id: /).slice(1)) {
  const id = trozo.match(/^[`"]([^`"\n]+)/)?.[1];
  if (!id) continue;
  const corte = trozo.indexOf("\n  },");
  const cuerpoRel = corte > 0 ? trozo.slice(0, corte) : trozo.slice(0, 1200);
  if (!cuerpoRel.includes('medio: "tabla"')) continue;
  const tabla = mapaTabla[id] ?? (id.includes("entidad_elemento") ? "entidad_elemento" : null);
  if (!tabla) { mal(`${id}: sin tabla mapeada`); continue; }
  for (const c of cuerpoRel.matchAll(/name: "(\w+)"/g)) {
    campos++;
    if (!cols[tabla]?.has(c[1])) mal(`${id}: campo "${c[1]}" NO existe en ${tabla}`);
  }
}

console.log(`  ${campos} campos comprobados`);


// 4) Referencias simples: la columna debe existir en la tabla del lado A.
console.log("== columnas de las referencias simples ==");
const infoTabla = {};
for (const m of tablasSrc.matchAll(/^  ([\w]+): \{ tabla: s\.(\w+)/gm)) infoTabla[m[1]] = varTabla[m[2]];
let refs = 0;
const bloqueRefs = regSrc.slice(regSrc.indexOf("Referencias simples"));
for (const m of bloqueRefs.matchAll(/\["([\w_]+)", "([\w]+)", "(\w+)", "([\w]+)"/g)) {
  const [, id, entA, columna] = m;
  refs++;
  const tabla = infoTabla[entA];
  if (!tabla) { mal(`${id}: entidad "${entA}" sin ENTIDAD_INFO`); continue; }
  if (!cols[tabla]?.has(columna)) mal(`${id}: ${tabla}.${columna} NO existe`);
}
console.log(`  ${refs} referencias comprobadas`);

console.log(fallos === 0 ? "\n✅ Registro y base de datos coherentes." : `\n❌ ${fallos} incoherencias.`);
process.exit(fallos ? 1 : 0);
