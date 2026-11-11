/**
 * Verificador de lo oculto (docs/area-ia.md, Fase 4). SOLO LEE: recorre todo lo que
 * la base tiene marcado como oculto y comprueba, pidiendo las páginas como un
 * lector sin sesión, que no se escapa. Mira el HTML en bruto, que incluye los datos
 * que Next envía al navegador: lo que no se ve en pantalla pero viaja, también cuenta.
 *
 *     pnpm --silent verificar-ocultos [url]       (por defecto http://localhost:3000)
 *
 * Comprueba:
 *  - Campos ocultos y trozos `[[oculto]]…[[/oculto]]`: su texto no sale en la ficha,
 *    ni en los índices y páginas generales, ni en el buscador, ni en la vista previa
 *    de los enlaces, ni en el aviso de Discord; y la marca `[[oculto` tampoco sale nunca.
 *  - Conexiones ocultas: ninguna de las dos fichas enlaza a la otra, su nota no sale y
 *    no se dibujan en el Atlas.
 *  - Fechas ocultas: su texto no sale en la ficha y no están en la cronología.
 *
 * Sale con código 1 si algo se escapa. Con el servidor de desarrollo tarda: compila
 * cada página la primera vez que se pide.
 */
import { and, eq, getTableColumns, getTableName } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { avisoDe } from "@/lib/discord";
import { textosFecha } from "@/lib/fechas";
import { ENTITY_LIST } from "@/lib/entities";
import { getCalendario } from "@/lib/queries/fechas";
import { getOgFicha } from "@/lib/queries/og";
import { getMapaRelaciones } from "@/lib/queries/mapaRelaciones";
import { getSucesos } from "@/lib/queries/cronologia";
import { camposOcultos } from "@/lib/queries/visibilidad";
import { etiquetas } from "@/lib/relaciones/consultas";
import { RELACIONES } from "@/lib/relaciones/registro";
import { ENTIDAD_INFO, infoDe, tablaDe } from "@/lib/relaciones/tablas";
import { OCULTOS_POR_DEFECTO, censurarTexto } from "@/lib/visibilidad";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const PAGINAS_GENERALES = [
  "/",
  "/atlas",
  "/timeline",
  "/timeline/calendario",
  "/compendio",
  "/alturas",
  "/mapa",
  "/canciones",
  "/feed.xml",
  // Regiones y locaciones no tienen índice propio: se ven en el mapa.
  ...ENTITY_LIST.filter((e) => !e.sinSeccion && !["/regiones", "/locaciones"].includes(e.route)).map((e) => e.route),
];

type Fila = Record<string, unknown>;
const cols = (t: PgTable) => getTableColumns(t) as unknown as Record<string, PgColumn>;

// ── Las páginas ──────────────────────────────────────────────────────────────

const cache = new Map<string, Promise<string>>();
/** Una página tal y como le llega a un lector sin sesión. */
function pagina(ruta: string): Promise<string> {
  if (!cache.has(ruta)) {
    cache.set(
      ruta,
      fetch(BASE + ruta, { headers: { "cache-control": "no-cache" } }).then(async (r) => {
        if (!r.ok) throw new Error(`${ruta} → HTTP ${r.status}`);
        return r.text();
      }),
    );
  }
  return cache.get(ruta)!;
}

// ── El resultado ─────────────────────────────────────────────────────────────

const fugas: string[] = [];
const avisos: string[] = [];
let comprobaciones = 0;

function fuga(que: string, donde: string, texto?: string) {
  fugas.push(`✗ ${que}\n    en ${donde}${texto ? `: «${texto}»` : ""}`);
}

/**
 * Un trozo del secreto que se pueda buscar en el HTML: el tramo más largo sin
 * caracteres que el HTML o el JSON escapan (comillas, saltos, signos…).
 */
function aguja(texto: string): string | null {
  const tramos = texto.split(/[^\p{L}\p{N} .,;:—–-]+/u).map((t) => t.trim());
  const largo = tramos.sort((a, b) => b.length - a.length)[0] ?? "";
  return largo.length >= 4 ? largo.slice(0, 60) : null;
}

async function buscarEn(rutas: string[], secreto: string, que: string) {
  const a = aguja(secreto);
  if (!a) {
    avisos.push(`· ${que}: el valor («${secreto}») es demasiado corto para buscarlo con seguridad.`);
    return;
  }
  for (const ruta of rutas) {
    comprobaciones++;
    const html = await pagina(ruta).catch((e: Error) => {
      avisos.push(`· No se pudo pedir ${e.message}`);
      return "";
    });
    if (!html.includes(a)) continue;
    // Un texto corto ("Duque", "Motivación") puede estar ahí por otra razón: se avisa, no se acusa.
    if (a.length >= 12) fuga(que, ruta, a);
    else avisos.push(`· ${que}: «${a}» sale en ${ruta}. Es corto y puede ser casualidad: míralo a mano.`);
  }
}

/**
 * El texto de un secreto no está en el buscador. En la entrada de su propia ficha no puede salir nunca. En las
 * demás rige lo mismo que en las páginas generales: un valor corto («Elemental», un título) puede estar ahí por
 * otra razón, así que se avisa en vez de acusar.
 */
async function buscarEnIndice(secreto: string, que: string, propia?: { entidad: string; id: number }) {
  const a = aguja(secreto);
  if (!a) return;
  comprobaciones++;
  const filas = await db
    .select({ tipo: s.searchIndex.entidadTipo, id: s.searchIndex.entidadId, sub: s.searchIndex.subtitulo, res: s.searchIndex.resumen })
    .from(s.searchIndex);
  for (const f of filas) {
    if (!f.sub?.includes(a) && !f.res?.includes(a)) continue;
    const esPropia = propia !== undefined && f.tipo === propia.entidad && Number(f.id) === propia.id;
    if (esPropia || a.length >= 12) fuga(que, `el buscador (${f.tipo} #${f.id})`, a);
    else avisos.push(`· ${que}: «${a}» sale en el buscador (${f.tipo} #${f.id}). Es corto y puede ser casualidad: míralo a mano.`);
  }
}

/**
 * El aviso de Discord de la ficha no lleva el secreto. Se mira aunque la ficha no esté
 * publicada: es lo que saldría el día que se publique.
 */
async function buscarEnAviso(entidad: string, id: number, secreto: string, que: string) {
  const a = aguja(secreto);
  if (!a) return;
  comprobaciones++;
  const aviso = await avisoDe(entidad, id).catch((e: Error) => {
    avisos.push(`· ${que}: no se pudo preparar el aviso de Discord (${e.message}).`);
    return null;
  });
  if (aviso && JSON.stringify(aviso).includes(a)) fuga(que, "el aviso de Discord", a);
}

/** La ruta pública de una ficha, si la tiene y es pública. */
async function rutaPublica(entidad: string, id: number): Promise<string | null> {
  const e = (await etiquetas(entidad, [id])).get(id);
  if (!e || (e.estado !== null && e.estado !== "publicado")) return null;
  if (entidad === "gremio") return "/gremio";
  if (entidad === "lore") {
    const [f] = await db.select({ slug: s.paginasLore.slug }).from(s.paginasLore).where(eq(s.paginasLore.id, id)).limit(1);
    return f ? `/lore/${f.slug}` : null;
  }
  return e.ruta;
}

// ── 1. Campos ocultos ────────────────────────────────────────────────────────

async function camposMarcados(): Promise<{ entidad: string; id: number; campo: string; valor: unknown }[]> {
  const marcas = await db
    .select({ entidad: s.campoVisibilidad.entidadTipo, id: s.campoVisibilidad.entidadId, campo: s.campoVisibilidad.campo })
    .from(s.campoVisibilidad)
    .where(eq(s.campoVisibilidad.visible, false));
  const out: { entidad: string; id: number; campo: string; valor: unknown }[] = [];
  const leerFila = async (entidad: string, id: number): Promise<Fila | undefined> => {
    const info = infoDe(entidad);
    if (!info) return undefined;
    const [f] = (await db.select().from(info.tabla).where(eq(cols(info.tabla).id, id)).limit(1)) as Fila[];
    return f;
  };
  for (const m of marcas) {
    const fila = await leerFila(m.entidad, m.id);
    if (fila) out.push({ ...m, valor: fila[m.campo] });
  }
  // Los que nacen ocultos no tienen marca: hay que mirar los que tienen valor.
  for (const [entidad, campos] of Object.entries(OCULTOS_POR_DEFECTO)) {
    const info = infoDe(entidad)!;
    const filas = (await db.select().from(info.tabla)) as Fila[];
    for (const f of filas) {
      for (const campo of campos) {
        if (!f[campo]) continue;
        const ocultos = await camposOcultos(entidad, f.id as number);
        if (ocultos.has(campo)) out.push({ entidad, id: f.id as number, campo, valor: f[campo] });
      }
    }
  }
  return out;
}

async function verificarCampos() {
  const marcados = await camposMarcados();
  console.log(`Campos ocultos: ${marcados.length}`);
  for (const m of marcados) {
    const que = `Campo oculto ${m.entidad} #${m.id} · ${m.campo}`;
    if (typeof m.valor !== "string" || !m.valor.trim()) continue;
    const ruta = await rutaPublica(m.entidad, m.id);
    // Un trozo de un texto largo puede repetirse en otra parte sin que sea una fuga; un
    // valor corto de lista (un género, un tipo) se repite por fuerza en otras fichas.
    const generales = m.valor.length >= 12 ? PAGINAS_GENERALES : [];
    await buscarEn([...(ruta ? [ruta] : []), ...generales], m.valor, que);
    await buscarEnIndice(m.valor, que, { entidad: m.entidad, id: m.id });
    // La vista previa de los enlaces.
    comprobaciones++;
    const og = await getOgFicha(m.entidad, m.id).catch(() => null);
    const a = aguja(m.valor);
    if (og && a && og.subtitulo?.includes(a)) fuga(que, "la vista previa de los enlaces", a);
    await buscarEnAviso(m.entidad, m.id, m.valor, que);
  }
}

// ── 2. Trozos ocultos ────────────────────────────────────────────────────────

const TROZO = /\[\[oculto\]\]([\s\S]*?)(?:\[\[\/oculto\]\]|$)/gi;
const DUENO: [string, string][] = [
  ["personaje_id", "personajes"],
  ["organizacion_id", "organizaciones"],
  ["familia_id", "familias"],
  ["gremio_id", "gremio"],
  ["pagina_id", "lore"],
];

async function verificarTrozos() {
  const pg = (globalThis as unknown as { __astralysSql: { unsafe: (q: string) => Promise<Fila[]> } }).__astralysSql;
  const columnas = (await pg.unsafe(`
    select c.table_name as t, c.column_name as c
      from information_schema.columns c
      join information_schema.tables x using (table_schema, table_name)
     where c.table_schema = 'public' and x.table_type = 'BASE TABLE'
       and c.data_type in ('text', 'character varying')
       and c.table_name not in ('search_index', 'nota_privada', 'trama_hojas', 'hilo_narrativo')
       and c.table_name not like 'respaldo%'`)) as { t: string; c: string }[];
  const entidadDe = new Map(Object.entries(ENTIDAD_INFO).map(([k, v]) => [getTableName(v.tabla), k]));
  let n = 0;
  let repetidos = 0;
  for (const { t, c } of columnas) {
    const filas = await pg.unsafe(`select to_jsonb(x) as fila, "${c}" as v from "${t}" x where "${c}" ilike '%[[oculto]]%'`);
    for (const f of filas) {
      const fila = f.fila as Fila;
      const entidad = entidadDe.get(t);
      let ruta: string | null = null;
      if (entidad) ruta = await rutaPublica(entidad, fila.id as number);
      for (const [col, dueno] of DUENO) if (!ruta && fila[col]) ruta = await rutaPublica(dueno, fila[col] as number);
      // Lo que el mismo campo deja a la vista. Si un trozo oculto dice exactamente algo que
      // también se ve (un texto que enseña una lista de nombres entera pero oculta a quién
      // corresponde cada uno), encontrar ese texto fuera no demuestra ninguna fuga.
      const aLaVista = censurarTexto(String(f.v));
      for (const m of String(f.v).matchAll(TROZO)) {
        n++;
        const a = aguja(m[1]);
        if (a && aLaVista.includes(a)) {
          repetidos++;
          continue;
        }
        const que = `Trozo oculto en ${t}.${c}`;
        await buscarEn([...(ruta ? [ruta] : []), ...PAGINAS_GENERALES], m[1], que);
        await buscarEnIndice(m[1], que, entidad ? { entidad, id: fila.id as number } : undefined);
        if (entidad) await buscarEnAviso(entidad, fila.id as number, m[1], que);
      }
    }
  }
  console.log(`Trozos ocultos: ${n}${repetidos ? ` (${repetidos} dicen algo que el mismo campo ya deja a la vista: no se buscan)` : ""}`);
}

// ── 3. Conexiones ocultas ────────────────────────────────────────────────────

interface Oculta {
  relId: string;
  fila: number;
  a: { entidad: string; id: number };
  b: { entidad: string; id: number };
  textos: string[];
}

async function conexionesOcultas(): Promise<Oculta[]> {
  const out: Oculta[] = [];
  for (const rel of RELACIONES) {
    const def = tablaDe(rel.id);
    if (rel.medio !== "tabla" || !def) continue;
    const c = cols(def.tabla);
    const filtros = [eq(c.oculto, true)];
    if (def.filtroA) filtros.push(eq(c[def.filtroA.col], def.filtroA.valor));
    const filas = (await db.select().from(def.tabla).where(and(...filtros))) as Fila[];
    for (const f of filas) {
      const a = f[def.colA] as number | null;
      const b = f[def.colB] as number | null;
      if (!a || !b) continue;
      out.push({
        relId: rel.id,
        fila: f[def.pk] as number,
        a: { entidad: rel.a.entidad, id: a },
        b: { entidad: rel.b.entidad, id: b },
        textos: rel.campos.map((k) => f[k.name]).filter((v): v is string => typeof v === "string" && v.length > 0),
      });
    }
  }
  const vinculos = await db.select().from(s.vinculo).where(eq(s.vinculo.oculto, true));
  for (const v of vinculos) {
    const rel = RELACIONES.find((r) => r.medio === "vinculo" && (r.relacion ?? r.id) === v.relacion);
    out.push({
      relId: rel?.id ?? String(v.relacion),
      fila: v.id,
      a: { entidad: v.origenTipo, id: v.origenId },
      b: { entidad: v.destinoTipo, id: v.destinoId },
      textos: [v.tipo, v.nota].filter((x): x is string => !!x),
    });
  }
  // Referencias: la columna se oculta como un campo de la ficha.
  const marcas = await db.select().from(s.campoVisibilidad).where(eq(s.campoVisibilidad.visible, false));
  for (const m of marcas) {
    const rel = RELACIONES.find((r) => r.medio === "referencia" && r.a.entidad === m.entidadTipo && r.columna === m.campo);
    const info = rel && infoDe(rel.a.entidad);
    if (!rel || !info) continue;
    const [f] = (await db.select().from(info.tabla).where(eq(cols(info.tabla).id, m.entidadId)).limit(1)) as Fila[];
    const destino = f?.[m.campo] as number | null | undefined;
    if (!destino) continue;
    out.push({ relId: rel.id, fila: m.entidadId, a: { entidad: rel.a.entidad, id: m.entidadId }, b: { entidad: rel.b.entidad, id: destino }, textos: [] });
  }
  return out;
}

async function verificarConexiones() {
  const ocultas = await conexionesOcultas();
  console.log(`Conexiones ocultas: ${ocultas.length}`);
  if (ocultas.length === 0) return;
  // Si hay otra conexión visible entre las dos fichas, el enlace es legítimo.
  const atlas = await getMapaRelaciones({ publico: true });
  const dibujadas = new Set(atlas.aristas.map((x) => x.id));
  const hayVisible = (x: Oculta) => {
    const [p, q] = [`${x.a.entidad}:${x.a.id}`, `${x.b.entidad}:${x.b.id}`];
    return atlas.aristas.some((e) => (e.a === p && e.b === q) || (e.a === q && e.b === p));
  };
  for (const x of ocultas) {
    const que = `Conexión oculta ${x.relId} #${x.fila} (${x.a.entidad} #${x.a.id} ↔ ${x.b.entidad} #${x.b.id})`;
    comprobaciones++;
    if (dibujadas.has(`${x.relId}:${x.fila}`)) fuga(que, "el Atlas");
    const [ra, rb] = await Promise.all([rutaPublica(x.a.entidad, x.a.id), rutaPublica(x.b.entidad, x.b.id)]);
    const visible = hayVisible(x);
    for (const [ruta, otra] of [
      [ra, rb],
      [rb, ra],
    ] as const) {
      if (!ruta) continue;
      for (const t of x.textos) if (t.length >= 8) await buscarEn([ruta], t, `${que}, nota`);
      if (!otra || visible) continue;
      comprobaciones++;
      const html = await pagina(ruta).catch(() => "");
      if (html.includes(`href="${otra}"`)) fuga(que, ruta, `enlace a ${otra}`);
    }
  }
}

// ── 4. Fechas ocultas ────────────────────────────────────────────────────────

async function verificarFechas() {
  const ocultas = await db.select().from(s.fechaLore).where(eq(s.fechaLore.oculto, true));
  console.log(`Fechas ocultas: ${ocultas.length}`);
  if (ocultas.length === 0) return;
  const [cal, { sucesos }] = await Promise.all([getCalendario(), getSucesos({ publico: true })]);
  const claves = new Set(sucesos.map((x) => x.clave));
  for (const f of ocultas) {
    const que = `Fecha oculta ${f.entidadTipo} #${f.entidadId} · ${f.rol}`;
    comprobaciones++;
    if (claves.has(`${f.entidadTipo}:${f.entidadId}:${f.rol}`)) fuga(que, "la cronología");
    const ruta = f.entidadTipo in ENTIDAD_INFO ? await rutaPublica(f.entidadTipo, f.entidadId) : null;
    if (!ruta) continue;
    const t = textosFecha(
      cal,
      {
        ini: { anio: f.iniAnio, segmentoId: f.iniSegmentoId, dia: f.iniDia },
        fin: f.finAnio != null ? { anio: f.finAnio, segmentoId: f.finSegmentoId, dia: f.finDia } : null,
        aproximada: f.aproximada,
      },
    );
    comprobaciones++;
    const html = await pagina(ruta).catch(() => "");
    for (const texto of [t.eras, t.relativo, t.absoluto]) if (html.includes(texto)) fuga(que, ruta, texto);
  }
}

// ── 5. La marca de los trozos no sale nunca ──────────────────────────────────

async function verificarMarca() {
  for (const ruta of cache.keys()) {
    comprobaciones++;
    const html = await pagina(ruta).catch(() => "");
    if (html.toLowerCase().includes("[[oculto")) fuga("La marca [[oculto]] ha llegado al navegador", ruta);
  }
}

// ── Entrada ──────────────────────────────────────────────────────────────────

try {
  console.log(`Verificando lo oculto contra ${BASE}…\n`);
  await verificarCampos();
  await verificarTrozos();
  await verificarConexiones();
  await verificarFechas();
  await verificarMarca();

  console.log(`\n${comprobaciones} comprobaciones en ${cache.size} páginas.`);
  for (const a of avisos) console.log(a);
  if (fugas.length) {
    console.log(`\n${fugas.length} FUGAS:\n${fugas.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("\n✅ Nada oculto se escapa.");
  }
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  process.exit();
}
