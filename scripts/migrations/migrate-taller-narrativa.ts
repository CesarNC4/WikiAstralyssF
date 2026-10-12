/**
 * Taller · Fase 2 — Modelo narrativo.
 * Ver docs/taller-del-autor.md §3, §4 y §7, y docs/taller-plan.md (Fase 2).
 *
 *  1. `catalogos.meta` (jsonb) y `{ numerado: false }` en Prólogo, Interludio y
 *     Epílogo del catálogo `capitulo_tipo`.
 *  2. Tablas `estructura_plantilla` y `estructura_fase`.
 *  3. Capítulos: `orden` (posición en su libro) y `plantilla_id`.
 *  4. Actos: `fase_id`, `notas_privadas`, `discord_url`; orden contiguo por
 *     capítulo y nombres sin el "Acto I:" que ahora se calcula solo.
 *  5. Hilos: `acto_apertura_id` / `acto_cierre_id`. Eventos: `acto_id`.
 *  6. Se elimina `capitulo_personaje`: los personajes del capítulo salen de sus
 *     actos. Aborta si la tabla tuviera filas.
 *  7. Renumera los capítulos con la regla nueva.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-taller-narrativa.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-taller-narrativa.ts --aplicar
 *
 * Idempotente.
 */
import postgres from "postgres";
import { numerarCapitulos, quitarPrefijoActo } from "../../lib/narrativa/numeracion.ts";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 3 });

type Tx = postgres.TransactionSql;

const avisos: string[] = [];

/** Los que el autor dio como ejemplo de "no cuentan" al cerrar la spec. */
const NO_NUMERADOS = ["Prólogo", "Interludio", "Epílogo"];

/** Clave foránea con el nombre de convención del proyecto, si no existe ya. */
async function fk(tx: Tx, tabla: string, col: string, destino: string, accion: "restrict" | "set null" | "cascade") {
  const nombre = `${tabla}_${col}_fk`;
  const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from pg_constraint where conname = ${nombre}`;
  if (n === 0) {
    await tx.unsafe(`alter table "${tabla}" add constraint "${nombre}" foreign key ("${col}") references "${destino}"(id) on delete ${accion}`);
  }
  await tx.unsafe(`create index if not exists "${tabla}_${col}_idx" on "${tabla}" ("${col}")`);
}

async function catalogoMeta(tx: Tx) {
  await tx.unsafe(`alter table catalogos add column if not exists meta jsonb`);
  const r = await tx`
    update catalogos set meta = coalesce(meta, '{}'::jsonb) || '{"numerado": false}'::jsonb
     where campo = 'capitulo_tipo' and valor in ${tx(NO_NUMERADOS)}
       and coalesce((meta->>'numerado')::boolean, true) = true
    returning valor`;
  console.log(`✅ 1/7 catalogos.meta; sin número: ${r.length ? r.map((x) => x.valor).join(", ") : "(ya estaba)"}.`);
  avisos.push(`Los tipos de capítulo sin número son ${NO_NUMERADOS.join(", ")}. Flashback, Especial, Extra y el resto sí numeran; cámbialo en el catálogo si no es así.`);
}

async function estructura(tx: Tx) {
  await tx.unsafe(`
    create table if not exists estructura_plantilla (
      id serial primary key,
      nombre varchar not null,
      descripcion text,
      predeterminada boolean not null default false,
      orden integer not null default 0
    )`);
  // Como mucho una predeterminada.
  await tx.unsafe(`
    create unique index if not exists estructura_plantilla_predeterminada_uq
      on estructura_plantilla (predeterminada) where predeterminada`);
  await tx.unsafe(`
    create table if not exists estructura_fase (
      id serial primary key,
      plantilla_id integer not null references estructura_plantilla(id) on delete cascade,
      orden integer not null default 0,
      nombre varchar not null,
      abreviatura varchar,
      color varchar,
      guia text
    )`);
  await tx.unsafe(`create index if not exists estructura_fase_plantilla_idx on estructura_fase (plantilla_id)`);
  console.log("✅ 2/7 Plantillas y fases de estructura.");
}

async function capitulos(tx: Tx) {
  await tx.unsafe(`alter table capitulos add column if not exists orden integer not null default 0`);
  await tx.unsafe(`alter table capitulos add column if not exists plantilla_id integer`);
  // RESTRICT: no se borra una plantilla que use algún capítulo.
  await fk(tx, "capitulos", "plantilla_id", "estructura_plantilla", "restrict");

  // Orden inicial: el que ya tenían por número dentro de cada libro.
  const caps = await tx<{ id: number; libro: string | null; numero: string }[]>`
    select id, libro, numero from capitulos order by libro nulls first, id`;
  const num = (t: string) => Number(t.match(/-?\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  const porLibro = new Map<string, (typeof caps)[number][]>();
  for (const c of caps) {
    const k = c.libro ?? "";
    if (!porLibro.has(k)) porLibro.set(k, []);
    porLibro.get(k)!.push(c);
  }
  for (const lista of porLibro.values()) {
    lista.sort((a, b) => num(a.numero) - num(b.numero) || a.id - b.id);
    for (const [i, c] of lista.entries()) await tx`update capitulos set orden = ${i} where id = ${c.id}`;
  }
  console.log(`✅ 3/7 Capítulos: orden y plantilla (${caps.length} capítulos, aún sin plantilla).`);
  if (caps.length) avisos.push(`Los ${caps.length} capítulos existentes quedan sin plantilla (excepción temporal): elígela en el taller.`);
}

async function actos(tx: Tx) {
  await tx.unsafe(`alter table actos add column if not exists fase_id integer`);
  await tx.unsafe(`alter table actos add column if not exists notas_privadas text`);
  await tx.unsafe(`alter table actos add column if not exists discord_url varchar`);
  await fk(tx, "actos", "fase_id", "estructura_fase", "restrict");

  const filas = await tx<{ id: number; nombre: string; capitulo_id: number | null; numero_orden: number | null }[]>`
    select id, nombre, capitulo_id, numero_orden from actos order by capitulo_id, numero_orden nulls last, id`;

  // Orden contiguo 0, 1, 2… por capítulo (incluidos los de la papelera, que
  // conservan su sitio por si se restauran).
  const porCap = new Map<number | null, (typeof filas)[number][]>();
  for (const a of filas) {
    if (!porCap.has(a.capitulo_id)) porCap.set(a.capitulo_id, []);
    porCap.get(a.capitulo_id)!.push(a);
  }
  for (const lista of porCap.values())
    for (const [i, a] of lista.entries())
      if (a.numero_orden !== i) await tx`update actos set numero_orden = ${i} where id = ${a.id}`;

  let renombrados = 0;
  for (const a of filas) {
    const limpio = quitarPrefijoActo(a.nombre);
    if (limpio !== a.nombre) {
      await tx`update actos set nombre = ${limpio} where id = ${a.id}`;
      console.log(`   · «${a.nombre}» → «${limpio}»`);
      renombrados++;
    }
  }
  console.log(`✅ 4/7 Actos: fase, notas, Discord; ${renombrados} nombres sin prefijo.`);
}

async function hilosYEventos(tx: Tx) {
  await tx.unsafe(`alter table hilo_narrativo add column if not exists acto_apertura_id integer`);
  await tx.unsafe(`alter table hilo_narrativo add column if not exists acto_cierre_id integer`);
  await fk(tx, "hilo_narrativo", "acto_apertura_id", "actos", "set null");
  await fk(tx, "hilo_narrativo", "acto_cierre_id", "actos", "set null");
  await tx.unsafe(`alter table timeline_eventos add column if not exists acto_id integer`);
  await fk(tx, "timeline_eventos", "acto_id", "actos", "set null");
  console.log("✅ 5/7 Hilos (acto de apertura y cierre) y eventos (acto opcional).");
}

async function quitarCapituloPersonaje(tx: Tx) {
  const [{ existe }] = await tx<{ existe: boolean }[]>`select to_regclass('public.capitulo_personaje') is not null as existe`;
  if (!existe) {
    console.log("✅ 6/7 capitulo_personaje ya no existe.");
    return;
  }
  const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from capitulo_personaje`;
  if (n > 0) throw new Error(`capitulo_personaje tiene ${n} filas: no se borra. Revisa antes qué hacer con ellas.`);
  await tx.unsafe(`drop table capitulo_personaje`);
  console.log("✅ 6/7 capitulo_personaje eliminada (estaba vacía).");
}

async function renumerar(tx: Tx) {
  const tipos = await tx<{ valor: string }[]>`
    select valor from catalogos where campo = 'capitulo_tipo' and (meta->>'numerado')::boolean = false`;
  const caps = await tx<{ id: number; libro: string | null; tipo: string | null; orden: number; numero: string; titulo: string }[]>`
    select id, libro, tipo, orden, numero, titulo from capitulos where eliminado_en is null`;
  const rotulos = numerarCapitulos(caps, new Set(tipos.map((t) => t.valor)));
  for (const c of caps) {
    const nuevo = rotulos.get(c.id)!;
    if (nuevo !== c.numero) {
      await tx`update capitulos set numero = ${nuevo} where id = ${c.id}`;
      console.log(`   · «${c.titulo}» (${c.tipo ?? "sin tipo"}): «${c.numero}» → «${nuevo}»`);
    }
  }
  console.log("✅ 7/7 Capítulos renumerados.");
}

async function trabajo(tx: Tx) {
  await catalogoMeta(tx);
  await estructura(tx);
  await capitulos(tx);
  await actos(tx);
  await hilosYEventos(tx);
  await quitarCapituloPersonaje(tx);
  await renumerar(tx);
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

  console.log("");
  if (avisos.length) {
    console.log(`⚠️  ${avisos.length} cosa(s) que tienes que saber:`);
    for (const a of avisos) console.log(`   · ${a}`);
    console.log("");
  }
  console.log(
    APLICAR
      ? "✅ Aplicado."
      : "✅ Ensayo terminado y revertido. La base está intacta.\n   Para aplicarlo de verdad: añade --aplicar",
  );
} finally {
  await sql.end();
}
