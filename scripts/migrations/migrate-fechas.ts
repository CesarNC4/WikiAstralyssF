/**
 * Taller · Fase 1 — Sistema de fechas del lore.
 *
 * Crea el calendario, las eras y la fecha estructurada (`fecha_lore`), y copia a
 * esta última las fechas que hasta ahora se escribían a mano en texto libre.
 * Ver docs/taller-del-autor.md §13 y §15, y docs/taller-plan.md (Fase 1).
 *
 *  1. Tablas `calendario_segmento`, `calendario_dia_semana`, `era`, `fecha_lore`.
 *  2. Calendario inicial (12 meses de 30 días, semana de 7) si no hay ninguno.
 *  3. Eras sembradas desde el catálogo `era`, solo con el nombre: los años de
 *     inicio y las abreviaturas se ponen en el taller (Universo > Calendario).
 *  4. Conversión de los textos viejos a `fecha_lore`. **No toca las columnas
 *     viejas**: se retiran en una fase posterior, cuando nada las lea.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-fechas.ts            (ENSAYO: no escribe)
 *     node --env-file=.env.local scripts/migrations/migrate-fechas.ts --aplicar  (escribe de verdad)
 *
 * El ensayo hace el mismo trabajo dentro de una transacción que se revierte al
 * final, así que lo que informa es lo que pasaría de verdad. Idempotente: lo ya
 * convertido no se vuelve a escribir.
 */
import postgres from "postgres";
import { interpretarFechaTexto, type FechaTexto } from "../../lib/fechas/index.ts";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 3 });

type Tx = postgres.TransactionSql;

const avisos: string[] = [];

/** Una fecha a convertir: de dónde sale y qué texto tenía. */
interface Origen {
  entidadTipo: string;
  entidadId: number;
  rol: string;
  etiqueta: string;
  /** Texto original, para el informe. */
  texto: string;
  fecha: FechaTexto | null;
}

async function crearTablas(tx: Tx) {
  await tx.unsafe(`
    create table if not exists calendario_segmento (
      id serial primary key,
      orden integer not null default 0,
      nombre varchar not null,
      dias integer not null check (dias > 0),
      tipo varchar not null default 'mes' check (tipo in ('mes', 'intercalar'))
    )`);
  await tx.unsafe(`
    create table if not exists calendario_dia_semana (
      id serial primary key,
      orden integer not null default 0,
      nombre varchar not null
    )`);
  await tx.unsafe(`
    create table if not exists era (
      id serial primary key,
      orden integer not null default 0,
      nombre varchar not null,
      abreviatura varchar,
      anio_inicio integer
    )`);
  // Los segmentos se referencian con RESTRICT: borrar un mes en uso dejaría
  // fechas apuntando a la nada. El taller avisa de cuántas lo usan.
  await tx.unsafe(`
    create table if not exists fecha_lore (
      id serial primary key,
      entidad_tipo varchar not null,
      entidad_id integer not null,
      rol varchar not null default 'principal',
      ini_anio integer not null,
      ini_segmento_id integer references calendario_segmento(id) on delete restrict,
      ini_dia integer,
      fin_anio integer,
      fin_segmento_id integer references calendario_segmento(id) on delete restrict,
      fin_dia integer,
      aproximada boolean not null default false,
      importante boolean not null default false,
      clave_ini bigint not null,
      clave_fin bigint not null
    )`);
  await tx.unsafe(
    `create unique index if not exists fecha_lore_entidad_rol_uq on fecha_lore (entidad_tipo, entidad_id, rol)`,
  );
  await tx.unsafe(`create index if not exists fecha_lore_clave_idx on fecha_lore (clave_ini)`);
  console.log("✅ 1/4 Tablas del calendario, eras y fecha_lore en su sitio.");
}

async function sembrarCalendario(tx: Tx) {
  const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from calendario_segmento`;
  if (n > 0) {
    console.log(`✅ 2/4 Calendario ya configurado (${n} segmentos): no se toca.`);
  } else {
    for (let i = 1; i <= 12; i++) {
      await tx`insert into calendario_segmento (orden, nombre, dias, tipo) values (${i}, ${"Mes " + i}, 30, 'mes')`;
    }
    console.log("✅ 2/4 Calendario inicial: 12 meses de 30 días (se renombran en el taller).");
  }
  const [{ d }] = await tx<{ d: number }[]>`select count(*)::int as d from calendario_dia_semana`;
  if (d === 0) {
    for (let i = 1; i <= 7; i++) {
      await tx`insert into calendario_dia_semana (orden, nombre) values (${i}, ${"Día " + i})`;
    }
    console.log("   Semana inicial: 7 días.");
  }
}

async function sembrarEras(tx: Tx) {
  const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from era`;
  if (n > 0) {
    console.log(`✅ 3/4 Eras ya configuradas (${n}): no se tocan.`);
    return;
  }
  const delCatalogo = await tx<{ valor: string }[]>`
    select valor from catalogos where campo = 'era' order by orden, valor`;
  let orden = 0;
  for (const { valor } of delCatalogo) {
    await tx`insert into era (orden, nombre) values (${orden++}, ${valor})`;
  }
  console.log(`✅ 3/4 ${delCatalogo.length} eras sembradas desde el catálogo: ${delCatalogo.map((e) => e.valor).join(", ")}.`);
  avisos.push("Las eras no tienen año de inicio ni abreviatura: complétalos en el taller (Universo > Calendario).");
}

/** Reúne las fechas en texto de todas las tablas que las tienen. */
async function leerOrigenes(tx: Tx): Promise<Origen[]> {
  const out: Origen[] = [];

  const eventos = await tx<{ id: number; titulo: string; fecha_lore: string }[]>`
    select id, titulo, fecha_lore from timeline_eventos where eliminado_en is null`;
  for (const e of eventos)
    out.push({ entidadTipo: "timeline", entidadId: e.id, rol: "principal", etiqueta: `Evento «${e.titulo}»`, texto: e.fecha_lore, fecha: interpretarFechaTexto(e.fecha_lore) });

  // El acto guarda inicio y fin en dos textos; pasa a ser una sola fecha rango.
  const actos = await tx<{ id: number; nombre: string; ini: string | null; fin: string | null }[]>`
    select id, nombre, fecha_inicio_lore as ini, fecha_fin_lore as fin from actos
     where eliminado_en is null and (coalesce(fecha_inicio_lore, '') <> '' or coalesce(fecha_fin_lore, '') <> '')`;
  for (const a of actos) {
    const ini = interpretarFechaTexto(a.ini ?? a.fin);
    const fin = interpretarFechaTexto(a.fin ?? a.ini);
    let fecha: FechaTexto | null = null;
    if (ini && fin) {
      const finAnio = fin.finAnio ?? fin.iniAnio;
      fecha = finAnio >= ini.iniAnio
        ? { iniAnio: ini.iniAnio, finAnio: finAnio === ini.iniAnio ? null : finAnio, aproximada: ini.aproximada || fin.aproximada }
        : null;
    }
    out.push({ entidadTipo: "actos", entidadId: a.id, rol: "principal", etiqueta: `Acto «${a.nombre}»`, texto: `${a.ini ?? "—"} → ${a.fin ?? "—"}`, fecha });
  }

  const misiones = await tx<{ id: number; nombre: string; fecha_lore: string }[]>`
    select id, nombre, fecha_lore from misiones where eliminado_en is null and coalesce(fecha_lore, '') <> ''`;
  for (const m of misiones)
    out.push({ entidadTipo: "misiones", entidadId: m.id, rol: "principal", etiqueta: `Misión «${m.nombre}»`, texto: m.fecha_lore, fecha: interpretarFechaTexto(m.fecha_lore) });

  // `anio_lore` ya es un número: manda sobre el texto libre de `era_aparicion`.
  const demonios = await tx<{ id: number; nombre: string; era_aparicion: string | null; anio_lore: number | null }[]>`
    select id, nombre, era_aparicion, anio_lore from lord_demonio
     where eliminado_en is null and (coalesce(era_aparicion, '') <> '' or anio_lore is not null)`;
  for (const d of demonios)
    out.push({
      entidadTipo: "demonios", entidadId: d.id, rol: "aparicion", etiqueta: `Lord demonio «${d.nombre}»`,
      texto: d.anio_lore != null ? String(d.anio_lore) : (d.era_aparicion ?? ""),
      fecha: d.anio_lore != null ? { iniAnio: d.anio_lore, finAnio: null, aproximada: false } : interpretarFechaTexto(d.era_aparicion),
    });

  const orgs = await tx<{ id: number; nombre: string; fundacion: string }[]>`
    select id, nombre, fundacion from organizaciones where coalesce(fundacion, '') <> ''`;
  for (const o of orgs)
    out.push({ entidadTipo: "organizaciones", entidadId: o.id, rol: "fundacion", etiqueta: `Organización «${o.nombre}»`, texto: o.fundacion, fecha: interpretarFechaTexto(o.fundacion) });

  return out;
}

async function convertir(tx: Tx) {
  const [{ dias }] = await tx<{ dias: number }[]>`select coalesce(sum(dias), 0)::int as dias from calendario_segmento`;
  const D = Math.max(1, dias);

  const origenes = await leerOrigenes(tx);
  let escritas = 0;
  let yaEstaban = 0;
  const noEntendidas: Origen[] = [];

  for (const o of origenes) {
    if (!o.fecha) {
      noEntendidas.push(o);
      continue;
    }
    const finAnio = o.fecha.finAnio;
    // Precisión de año: el tramo va del primer día del año inicial al último del final.
    const claveIni = o.fecha.iniAnio * D;
    const claveFin = (finAnio ?? o.fecha.iniAnio) * D + D - 1;
    const r = await tx`
      insert into fecha_lore (entidad_tipo, entidad_id, rol, ini_anio, fin_anio, aproximada, clave_ini, clave_fin)
      values (${o.entidadTipo}, ${o.entidadId}, ${o.rol}, ${o.fecha.iniAnio}, ${finAnio}, ${o.fecha.aproximada}, ${claveIni}, ${claveFin})
      on conflict (entidad_tipo, entidad_id, rol) do nothing`;
    if (r.count > 0) {
      escritas++;
      const rango = finAnio != null ? `${o.fecha.iniAnio} a ${finAnio}` : `${o.fecha.iniAnio}`;
      console.log(`   · ${o.etiqueta}: «${o.texto}» → ${rango}${o.fecha.aproximada ? " (aprox.)" : ""}`);
    } else {
      yaEstaban++;
    }
  }

  console.log(`✅ 4/4 ${escritas} fechas convertidas${yaEstaban ? `, ${yaEstaban} ya estaban` : ""}.`);
  for (const o of noEntendidas)
    avisos.push(`${o.etiqueta}: «${o.texto}» no es una fecha que se pueda convertir. Queda vacía; revísala a mano.`);

  // Los capítulos no se convierten: su fecha pasa a calcularse a partir de sus actos (§3).
  const caps = await tx<{ titulo: string; fecha_lore: string }[]>`
    select titulo, fecha_lore from capitulos where eliminado_en is null and coalesce(fecha_lore, '') <> ''`;
  if (caps.length)
    console.log(`   (Capítulos no convertidos a propósito, su rango saldrá de sus actos: ${caps.map((c) => `«${c.titulo}» ${c.fecha_lore}`).join(", ")}.)`);
}

async function trabajo(tx: Tx) {
  await crearTablas(tx);
  await sembrarCalendario(tx);
  await sembrarEras(tx);
  await convertir(tx);
}

try {
  console.log(APLICAR ? "⚙️  APLICANDO cambios a la base…\n" : "🔍 ENSAYO (no se escribe nada; todo se revierte al final)\n");

  if (APLICAR) {
    await sql.begin(trabajo);
  } else {
    // Mismo trabajo, misma transacción, pero se aborta a propósito.
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
    console.log(`⚠️  ${avisos.length} cosa(s) que tienes que decidir tú:`);
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
