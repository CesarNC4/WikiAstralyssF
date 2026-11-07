/**
 * Lectura del lore para Claude (docs/area-ia.md, Fase 2). SOLO LEE: no hay
 * ninguna escritura en este archivo.
 *
 *     pnpm --silent lore <orden> [argumentos]      (pnpm --silent lore ayuda)
 *
 * Usa las mismas definiciones que la web (registro de relaciones, moldes del
 * panel, calendario) gracias a `registrar.mjs`. La salida de `ficha` está en el
 * formato de las propuestas (docs/propuestas-formato.md): una ficha leída sirve
 * de punto de partida para proponer cambios sobre ella.
 */
import { and, asc, eq, getTableColumns, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { textosFecha } from "@/lib/fechas";
import { rolesDe } from "@/lib/fechas/roles";
import { ESTADISTICAS, EXTRAS_JERARQUIA, TITULO_ESTADISTICAS, lineaDeFila, listasDe } from "@/lib/propuestas/listas";
import { extrasDeMiembros, leerLista } from "@/lib/propuestas/listasDb";
import { moldeDe, entidadesConMolde, type CampoMolde } from "@/lib/propuestas/moldes";
import { etiquetas, leerFilas } from "@/lib/relaciones/consultas";
import { bloquesDe } from "@/lib/relaciones/registro";
import { ENTIDAD_INFO, infoDe } from "@/lib/relaciones/tablas";
import { getCalendario, leerFechasDe } from "@/lib/queries/fechas";
import { camposOcultos } from "@/lib/queries/visibilidad";
import { leerFoto } from "./revision/foto";
import { ordenRevisar, ordenTextos } from "./revision/orden";

type Cols = Record<string, PgColumn>;
type Fila = Record<string, unknown>;
const cols = (t: PgTable) => getTableColumns(t) as unknown as Cols;

const AYUDA = `Lectura del lore (solo lectura).

  resumen                      Cuántas fichas hay de cada tipo, por estado
  buscar <texto>               Fichas cuyo nombre contiene el texto (todas las secciones)
  lista <tipo> [estado]        Las fichas de un tipo: #id, nombre y estado
  ficha <tipo> <id|nombre>     Una ficha completa en formato de propuesta
  menciones <texto>            Dónde se menciona un texto: campos, secciones de lore y notas
  campos <tipo>                El molde: campos, opciones, conexiones y fechas posibles
  catalogo <campo>             Las opciones de un catálogo
  revisar [tema]               Audita la coherencia de la wiki o de un tema; deja el informe en lore/revisiones/
  textos [tipo]                Cuánto texto hay por tipo, o los textos de un tipo

<tipo>: personajes, naciones, regiones, locaciones, organizaciones, familias,
gremio, razas, bestias, minerales, conceptos, magia, artefactos, demonios,
misiones, timeline, lore, capitulos, actos, arcos, hojas, hilos, canciones…
(vale el singular o el principio: "personaje", "nac").`;

// ── Utilidades ─────────────────────────────────────────────────────────────

const sinAcentos = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Igualdad tolerante a mayúsculas y acentos, en SQL. */
const contiene = (col: PgColumn | SQL, texto: string) =>
  sql`extensions.unaccent(lower(${col}::text)) like extensions.unaccent(lower(${"%" + texto + "%"}))`;

/** Tablas de entidad que se pueden leer (las de `ENTIDAD_INFO` y las del molde). */
function tablaDe(entidad: string): PgTable | undefined {
  if (ENTIDAD_INFO[entidad]) return ENTIDAD_INFO[entidad].tabla;
  if (entidad === "hojas") return s.tramaHojas;
  if (entidad === "hilos") return s.hiloNarrativo;
  return undefined;
}

function resolverTipo(arg: string | undefined): string {
  if (!arg) throw new Error("Falta el tipo de ficha. Mira `pnpm --silent lore ayuda`.");
  const todos = [...new Set([...Object.keys(ENTIDAD_INFO), ...entidadesConMolde()])].filter((k) => tablaDe(k));
  const a = sinAcentos(arg);
  const exacto = todos.find((k) => k === a || sinAcentos(moldeDe(k)?.singular ?? "") === a);
  if (exacto) return exacto;
  const prefijo = todos.filter((k) => k.startsWith(a) || sinAcentos(moldeDe(k)?.singular ?? "").startsWith(a));
  if (prefijo.length === 1) return prefijo[0];
  throw new Error(`Tipo "${arg}" ${prefijo.length ? `ambiguo: ${prefijo.join(", ")}` : "desconocido"}.`);
}

/** Columna del nombre, estado y papelera de una entidad. */
function metaDe(entidad: string) {
  const t = tablaDe(entidad)!;
  const c = cols(t);
  const info = infoDe(entidad);
  const label = info?.label ?? moldeDe(entidad)?.nombre ?? "nombre";
  return {
    t,
    c,
    label: c[label] ?? c.nombre ?? c.titulo,
    estado: (info?.estadoSql ?? c.estadoPublicacion) as PgColumn | undefined,
    vivo: c.eliminadoEn ? isNull(c.eliminadoEn) : undefined,
  };
}

function texto(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

const vacio = (v: unknown) => v == null || texto(v) === "" || (Array.isArray(v) && v.length === 0);

// ── Órdenes ────────────────────────────────────────────────────────────────

async function resumen() {
  console.log("Fichas por tipo (sin contar la papelera):\n");
  for (const entidad of Object.keys(ENTIDAD_INFO)) {
    const m = metaDe(entidad);
    if (!m.estado) {
      const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(m.t).where(m.vivo);
      console.log(`  ${entidad.padEnd(16)} ${r.n}`);
      continue;
    }
    const filas = await db
      .select({ estado: sql<string>`${m.estado}`, n: sql<number>`count(*)::int` })
      .from(m.t)
      .where(m.vivo)
      .groupBy(sql`1`);
    const total = filas.reduce((a, f) => a + f.n, 0);
    const partes = filas.map((f) => `${f.n} ${f.estado}`).join(", ");
    console.log(`  ${entidad.padEnd(16)} ${String(total).padStart(4)}   ${partes}`);
  }
}

async function buscar(q: string) {
  if (!q) throw new Error("Falta el texto a buscar.");
  let total = 0;
  for (const entidad of Object.keys(ENTIDAD_INFO)) {
    const m = metaDe(entidad);
    const filas = await db
      .select({ id: m.c.id, nombre: m.label, ...(m.estado ? { estado: sql<string>`${m.estado}` } : {}) })
      .from(m.t)
      .where(and(contiene(m.label, q), m.vivo))
      .orderBy(asc(m.label))
      .limit(30);
    for (const f of filas as Fila[]) {
      total++;
      console.log(`  ${entidad.padEnd(16)} #${String(f.id).padEnd(5)} ${f.nombre}${f.estado && f.estado !== "publicado" ? `  [${f.estado}]` : ""}`);
    }
  }
  if (!total) console.log(`  Nada con "${q}" en el nombre. Prueba \`menciones ${q}\` para buscar dentro de las fichas.`);
}

async function lista(entidad: string, estado?: string) {
  const m = metaDe(entidad);
  const filtros = [m.vivo, estado && m.estado ? sql`${m.estado} = ${estado}` : undefined].filter(Boolean) as SQL[];
  const filas = await db
    .select({ id: m.c.id, nombre: m.label, ...(m.estado ? { estado: sql<string>`${m.estado}` } : {}) })
    .from(m.t)
    .where(filtros.length ? and(...filtros) : undefined)
    .orderBy(asc(m.label));
  console.log(`${filas.length} fichas de ${entidad}${estado ? ` (${estado})` : ""}:\n`);
  for (const f of filas as Fila[]) console.log(`  #${String(f.id).padEnd(5)} ${f.nombre}${f.estado && f.estado !== "publicado" ? `  [${f.estado}]` : ""}`);
}

async function resolverId(entidad: string, arg: string | undefined): Promise<number> {
  if (!arg) throw new Error("Falta el id o el nombre de la ficha.");
  if (/^#?\d+$/.test(arg)) return Number(arg.replace("#", ""));
  const m = metaDe(entidad);
  const filas = (await db
    .select({ id: m.c.id, nombre: m.label })
    .from(m.t)
    .where(and(contiene(m.label, arg), m.vivo))
    .limit(20)) as Fila[];
  const exactas = filas.filter((f) => sinAcentos(String(f.nombre)) === sinAcentos(arg));
  const elegidas = exactas.length ? exactas : filas;
  if (elegidas.length === 1) return Number(elegidas[0].id);
  if (!elegidas.length) throw new Error(`No hay ninguna ficha de ${entidad} llamada "${arg}".`);
  throw new Error(`"${arg}" es ambiguo:\n${elegidas.map((f) => `  #${f.id} ${f.nombre}`).join("\n")}`);
}

/** Valor de un campo "ficha" (clave foránea): el nombre de la otra ficha. */
async function nombreDeRef(campo: CampoMolde, v: unknown): Promise<string> {
  if (!campo.ref || v == null) return texto(v);
  const e = (await etiquetas(campo.ref, [Number(v)])).get(Number(v));
  return e ? e.label : `#${v}`;
}

async function ficha(entidad: string, arg: string | undefined) {
  const id = await resolverId(entidad, arg);
  const m = metaDe(entidad);
  const [fila] = (await db.select().from(m.t).where(eq(m.c.id, id))) as Fila[];
  if (!fila) throw new Error(`No existe ${entidad} #${id}.`);
  const molde = moldeDe(entidad);
  const nombreCol = molde?.nombre ?? infoDe(entidad)?.label ?? "nombre";
  const estado = m.estado
    ? ((await db.select({ e: sql<string>`${m.estado}` }).from(m.t).where(eq(m.c.id, id)))[0]?.e ?? "")
    : "";
  const ocultos = await camposOcultos(entidad, id);

  const singular = molde?.singular ?? entidad;
  const papelera = fila.eliminadoEn ? " · EN LA PAPELERA" : "";
  console.log(`## ${singular} #${id}: ${fila[nombreCol]}${estado ? ` · ${estado}` : ""}${papelera}`);
  // Fecha local ("sv-SE" da AAAA-MM-DD): con toISOString, de noche salía la de mañana (UTC).
  console.log(`<!-- leído de la wiki el ${new Date().toLocaleDateString("sv-SE")} -->\n`);

  const campos = (molde?.campos ?? []).filter((c) => c.name !== nombreCol);
  const vacios: string[] = [];
  const largos: [CampoMolde, string][] = [];
  for (const c of campos) {
    const v = fila[c.name];
    if (vacio(v)) {
      vacios.push(c.label);
      continue;
    }
    const valor = c.tipo === "ficha" ? await nombreDeRef(c, v) : texto(v);
    const candado = ocultos.has(c.name) ? " 🔒" : "";
    if (c.tipo === "largo") largos.push([c, valor + candado]);
    else console.log(`- ${c.label}: ${valor}${candado}`);
  }
  for (const [c, valor] of largos) console.log(`\n### ${c.label}\n${valor}`);

  // Conexiones: todas las del registro, desde el lado de esta ficha.
  const conexiones: string[] = [];
  for (const b of bloquesDe(entidad)) {
    const filas = await leerFilas(b.relId, b.lado, id);
    for (const f of filas) {
      const extra = Object.entries(f.campos)
        .filter(([, v]) => v && v !== "false")
        .map(([k, v]) => `${b.campos.find((c) => c.name === k)?.label ?? k}: ${v === "true" ? "sí" : v}`);
      // Rango, facción y apodo de un miembro viven en la tabla del grupo.
      const defsExtra = EXTRAS_JERARQUIA[b.relId];
      if (defsExtra) {
        const extras = (await extrasDeMiembros(b.relId, b.lado === "a" ? id : f.objetivoId)).get(f.id) ?? {};
        for (const e of defsExtra) if (extras[e.name]) extra.push(`${e.label}: ${extras[e.name]}`);
      }
      const tipo = f.objetivoTipo && f.objetivoTipo !== b.objetivo ? `${f.objetivoTipo} ` : "";
      const est = f.estado && f.estado !== "publicado" ? ` [${f.estado}]` : "";
      conexiones.push(`- ${b.titulo}: ${tipo}${f.label}${extra.length ? ` (${extra.join("; ")})` : ""}${est}${f.oculto ? " 🔒" : ""}`);
    }
  }
  if (conexiones.length) console.log(`\n### Conexiones\n${conexiones.join("\n")}`);

  // Fechas.
  const roles = rolesDe(entidad);
  if (roles.length) {
    const [cal, fechas] = await Promise.all([getCalendario(), leerFechasDe(entidad, id)]);
    const lineas = roles.flatMap((r) => {
      const f = fechas[r.rol];
      if (!f) return [];
      const t = textosFecha(cal, f.fecha);
      return [`- ${r.etiqueta}: ${t.eras} (absoluto: ${t.absoluto})${f.importante ? " ★ importante" : ""}${f.oculto ? " 🔒" : ""}`];
    });
    if (lineas.length) console.log(`\n### Fechas\n${lineas.join("\n")}`);
    const sin = roles.filter((r) => !fechas[r.rol]).map((r) => r.etiqueta);
    if (sin.length) vacios.push(...sin.map((x) => `fecha de ${x.toLowerCase()}`));
  }

  // Las filas propias de la ficha: habilidades, rangos, árbol, secciones, fragmentos…
  for (const def of listasDe(entidad)) {
    const filas = await leerLista(entidad, def.clase, id);
    if (!filas.length) continue;
    if (def.clase === "secciones") {
      for (const f of filas) console.log(`\n### Sección: ${f.nombre || "(sin título)"} (Tipo: ${f.valores.tipo})${f.oculto ? " 🔒" : ""}\n${f.texto ?? ""}`);
      continue;
    }
    console.log(`\n### ${def.titulo}\n${filas.map((f) => lineaDeFila(def, f)).join("\n")}`);
  }

  if (entidad === "personajes") {
    const [st] = await db.select().from(s.estadisticas).where(eq(s.estadisticas.personajeId, id));
    const lineas = st ? ESTADISTICAS.filter((e) => (st as Fila)[e.name] != null).map((e) => `- ${e.label}: ${(st as Fila)[e.name]}`) : [];
    if (lineas.length) console.log(`\n### ${TITULO_ESTADISTICAS}${ocultos.has("estadisticas") ? " 🔒" : ""}\n${lineas.join("\n")}`);
  }

  const notas = await db
    .select({ contenido: s.notaPrivada.contenido })
    .from(s.notaPrivada)
    .where(and(eq(s.notaPrivada.entidadTipo, entidad), eq(s.notaPrivada.entidadId, id)));
  if (notas.length) console.log(`\n### Notas de autor\n${notas.map((n) => n.contenido.trim()).join("\n\n")}`);

  if (vacios.length) console.log(`\n<!-- vacío: ${vacios.join(", ")} -->`);
  if (!molde) console.log(`\n<!-- ${entidad} no tiene molde: solo se listan conexiones, fechas y notas -->`);
}

async function menciones(q: string) {
  if (!q) throw new Error("Falta el texto a buscar.");
  const corta = (t: string) => {
    const i = sinAcentos(t).indexOf(sinAcentos(q));
    const ini = Math.max(0, i - 60);
    return (ini > 0 ? "…" : "") + t.slice(ini, i + q.length + 60).replace(/\s+/g, " ") + (i + q.length + 60 < t.length ? "…" : "");
  };
  // La misma foto de la revisión: campos, secciones de lore y notas, sin tope de resultados.
  const { fichas } = await leerFoto();
  let total = 0;
  for (const f of fichas) {
    if (f.enPapelera) continue;
    for (const t of f.textos) {
      if (!sinAcentos(t.texto).includes(sinAcentos(q))) continue;
      total++;
      console.log(`  ${f.entidad} #${f.id} ${f.nombre} · ${t.rotulo}: ${corta(t.texto)}`);
    }
  }
  if (!total) console.log(`  "${q}" no aparece en ningún texto.`);
}

/** Opciones de varios catálogos de golpe (y los elementos, que tienen tabla propia). */
async function opciones(campos: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const normales = campos.filter((c) => c !== "elementos");
  if (normales.length) {
    const filas = await db
      .select({ campo: s.catalogos.campo, valor: s.catalogos.valor, grupo: s.catalogos.grupo })
      .from(s.catalogos)
      .where(inArray(s.catalogos.campo, normales))
      .orderBy(asc(s.catalogos.orden), asc(s.catalogos.valor));
    for (const f of filas) out.set(f.campo, [...(out.get(f.campo) ?? []), f.grupo ? `${f.valor} (${f.grupo})` : f.valor]);
  }
  if (campos.includes("elementos")) {
    const els = await db.select({ nombre: s.elementos.nombre, familia: s.elementos.familia }).from(s.elementos).where(isNull(s.elementos.eliminadoEn)).orderBy(asc(s.elementos.nombre));
    out.set("elementos", els.map((e) => (e.familia ? `${e.nombre} (${e.familia})` : e.nombre)));
  }
  return out;
}

async function campos(entidad: string) {
  const molde = moldeDe(entidad);
  if (!molde) throw new Error(`${entidad} no tiene molde.`);
  const bloques = bloquesDe(entidad);
  const cats = [
    ...molde.campos.map((c) => c.catalogo),
    ...bloques.flatMap((b) => b.campos.map((c) => c.catalogo)),
    ...listasDe(entidad).flatMap((l) => l.campos.map((c) => c.catalogo)),
  ].filter(Boolean) as string[];
  const ops = await opciones([...new Set(cats)]);
  const lista = (c: { catalogo?: string; opciones?: string[] }) => {
    const v = c.catalogo ? ops.get(c.catalogo) : c.opciones;
    return v?.length ? `: ${v.join(" · ")}` : c.catalogo ? " (catálogo vacío)" : "";
  };

  console.log(`## Molde: ${molde.singular} (${entidad})`);
  let seccion = "";
  for (const c of molde.campos) {
    if (c.seccion !== seccion) console.log(`\n### ${(seccion = c.seccion)}`);
    const tipo = c.tipo === "ficha" ? `ficha de ${c.ref}` : c.tipo;
    console.log(`- ${c.label} [${tipo}]${lista(c)}${c.hint ? `  — ${c.hint}` : ""}`);
  }
  if (bloques.length) {
    console.log("\n### Conexiones posibles (título del bloque → con qué)");
    for (const b of bloques) {
      const extra = [...b.campos.map((c) => `${c.label}${c.tipo === "select" ? lista(c) : ""}`), ...(EXTRAS_JERARQUIA[b.relId] ?? []).map((c) => c.label)].join("; ");
      console.log(`- ${b.titulo} → ${b.objetivo}${b.unico ? " (solo una)" : ""}${extra ? `  [${extra}]` : ""}`);
    }
  }
  const roles = rolesDe(entidad);
  if (roles.length) console.log(`\n### Fechas posibles\n- ${roles.map((r) => r.etiqueta).join("\n- ")}`);

  const listas = listasDe(entidad);
  if (listas.length || entidad === "personajes") console.log("\n### Listas propias (`### <Título>` y una línea por fila; ver docs/propuestas-formato.md)");
  for (const l of listas) {
    const extras = l.campos.map((c) => (c.catalogo || c.opciones ? `${c.label}${lista(c)}` : c.label)).join("; ");
    const forma = l.clase === "secciones" ? `${l.titulo}: <título> (Tipo: …)` : l.titulo;
    console.log(`- ${forma}${extras ? `  [${extras}]` : ""}${l.texto ? `  + texto: ${l.texto}` : ""}${l.ocultable ? "" : "  (no admite 🔒)"}`);
  }
  if (entidad === "personajes") console.log(`- ${TITULO_ESTADISTICAS} (🔒 en el encabezado oculta todas): ${ESTADISTICAS.map((e) => e.label).join(", ")}`);
}

async function catalogo(campo: string) {
  if (!campo) {
    const filas = await db
      .select({ campo: s.catalogos.campo, n: sql<number>`count(*)::int` })
      .from(s.catalogos)
      .groupBy(s.catalogos.campo)
      .orderBy(asc(s.catalogos.campo));
    console.log("Catálogos:\n" + filas.map((f) => `  ${f.campo} (${f.n})`).join("\n") + "\n  elementos (tabla propia)");
    return;
  }
  const v = (await opciones([campo])).get(campo);
  console.log(v?.length ? v.map((x) => `  ${x}`).join("\n") : `El catálogo "${campo}" no existe o está vacío.`);
}

// ── Entrada ────────────────────────────────────────────────────────────────

// Cortar la salida (`| head`) no es un error: se sale sin la traza de EPIPE.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});

const [orden, ...args] = process.argv.slice(2);
try {
  switch (orden) {
    case "resumen":
      await resumen();
      break;
    case "buscar":
      await buscar(args.join(" "));
      break;
    case "lista":
      await lista(resolverTipo(args[0]), args[1]);
      break;
    case "ficha":
      await ficha(resolverTipo(args[0]), args.slice(1).join(" "));
      break;
    case "menciones":
      await menciones(args.join(" "));
      break;
    case "campos":
      await campos(resolverTipo(args[0]));
      break;
    case "catalogo":
      await catalogo(args[0]);
      break;
    case "revisar":
      await ordenRevisar(args);
      break;
    case "textos":
      await ordenTextos(args[0] ? resolverTipo(args[0]) : undefined);
      break;
    default:
      console.log(AYUDA);
  }
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  process.exit();
}
