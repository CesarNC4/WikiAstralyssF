/**
 * Reconstrucción del lore: configura el calendario definitivo que eligió el autor
 * (2026-11-04). Doce lunas numeradas de 30 días, los cinco Días de Ceniza al final del
 * año, sin semana, y las cuatro eras contadas hacia delante.
 *
 * Solo toca la configuración del calendario y recalcula las claves de `fecha_lore`. No
 * cambia ninguna fecha: el año 0 del eje sigue siendo el inicio del rol.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-calendario-astralys.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-calendario-astralys.ts --aplicar
 *
 * Idempotente.
 */
import postgres from "postgres";
import { claves } from "../../lib/fechas/calendario.ts";
import { formatoFecha } from "../../lib/fechas/formato.ts";
import type { Calendario, Fecha, TipoSegmento } from "../../lib/fechas/tipos.ts";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 1, onnotice: () => {} });

type Tx = postgres.TransactionSql;

const LUNAS = ["Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima", "Undécima", "Duodécima"];
const CENIZA = "los Días de Ceniza";

/** En orden. El inicio del rol, el año 0 del eje, cae en el Año 1013 de la Era Post-Ishkoria. */
const ERAS = [
  { nombre: "Era de Paz", abreviatura: "E.P.", anioInicio: -22613 },
  { nombre: "Era Pre-Ishkoria", abreviatura: "Pre-I.", anioInicio: -10213 },
  { nombre: "Era de Ishkoria", abreviatura: "E.I.", anioInicio: -1999 },
  { nombre: "Era Post-Ishkoria", abreviatura: "Post-I.", anioInicio: -1012 },
];

async function trabajo(tx: Tx) {
  // ── Lunas y días de ceniza ───────────────────────────────────────────────
  const meses = await tx<{ id: number }[]>`select id from calendario_segmento where tipo = 'mes' order by orden, id`;
  if (meses.length !== LUNAS.length) throw new Error(`Se esperaban ${LUNAS.length} meses y hay ${meses.length}.`);
  for (const [i, m] of meses.entries()) {
    await tx`update calendario_segmento set nombre = ${`la ${LUNAS[i]} Luna`}, dias = 30, orden = ${i} where id = ${m.id}`;
  }
  const [ceniza] = await tx<{ id: number }[]>`select id from calendario_segmento where tipo = 'intercalar' and nombre = ${CENIZA}`;
  if (ceniza) await tx`update calendario_segmento set dias = 5, orden = ${LUNAS.length} where id = ${ceniza.id}`;
  else await tx`insert into calendario_segmento (orden, nombre, dias, tipo) values (${LUNAS.length}, ${CENIZA}, 5, 'intercalar')`;
  console.log(`✅ 1/4 ${LUNAS.length} lunas y ${CENIZA}.`);

  // ── Sin semana ───────────────────────────────────────────────────────────
  const semana = await tx`delete from calendario_dia_semana returning id`;
  console.log(`✅ 2/4 Sin semana (${semana.length} días retirados).`);

  // ── Eras ─────────────────────────────────────────────────────────────────
  const eras = await tx<{ id: number; nombre: string }[]>`select id, nombre from era order by orden, id`;
  if (eras.length !== ERAS.length) throw new Error(`Se esperaban ${ERAS.length} eras y hay ${eras.length}.`);
  for (const [i, e] of ERAS.entries()) {
    await tx`update era set nombre = ${e.nombre}, abreviatura = ${e.abreviatura}, anio_inicio = ${e.anioInicio}, orden = ${i} where id = ${eras[i].id}`;
    console.log(`   · ${eras[i].nombre} → ${e.nombre}, desde el año ${e.anioInicio} del eje`);
  }
  console.log(`✅ 3/4 ${ERAS.length} eras.`);

  // ── Recalcular las claves ────────────────────────────────────────────────
  const segs = await tx<{ id: number; orden: number; nombre: string; dias: number; tipo: string }[]>`select id, orden, nombre, dias, tipo from calendario_segmento order by orden`;
  const erasNuevas = await tx<{ id: number; orden: number; nombre: string; abreviatura: string | null; anio_inicio: number | null }[]>`select id, orden, nombre, abreviatura, anio_inicio from era order by orden`;
  const cal: Calendario = {
    segmentos: segs.map((s) => ({ ...s, tipo: s.tipo as TipoSegmento })),
    diasSemana: [],
    eras: erasNuevas.map((e) => ({ id: e.id, orden: e.orden, nombre: e.nombre, abreviatura: e.abreviatura, anioInicio: e.anio_inicio })),
  };
  const fechas = await tx<{ id: number; ini_anio: number; ini_segmento_id: number | null; ini_dia: number | null; fin_anio: number | null; fin_segmento_id: number | null; fin_dia: number | null; aproximada: boolean; clave_ini: string; clave_fin: string }[]>`select * from fecha_lore`;
  let cambiadas = 0;
  const muestras: string[] = [];
  for (const f of fechas) {
    const fecha: Fecha = {
      ini: { anio: f.ini_anio, segmentoId: f.ini_segmento_id, dia: f.ini_dia },
      fin: f.fin_anio != null ? { anio: f.fin_anio, segmentoId: f.fin_segmento_id, dia: f.fin_dia } : null,
      aproximada: f.aproximada,
    };
    const k = claves(cal, fecha);
    if (k.ini !== Number(f.clave_ini) || k.fin !== Number(f.clave_fin)) {
      await tx`update fecha_lore set clave_ini = ${k.ini}, clave_fin = ${k.fin} where id = ${f.id}`;
      cambiadas++;
    }
    if ([-10000, -1999, -1000, -1, 0].includes(f.ini_anio) && muestras.length < 6) {
      muestras.push(`   · ${formatoFecha(cal, fecha, "absoluto")} → ${formatoFecha(cal, fecha, "eras")} · ${formatoFecha(cal, fecha, "relativo")}`);
    }
  }
  console.log(`✅ 4/4 ${cambiadas} de ${fechas.length} fechas recolocadas en el año de 365 días.`);
  console.log("\nCómo se leen algunas fechas actuales (sus años se rehacen en el bloque de historia):");
  for (const m of muestras) console.log(m);
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
