/**
 * Limpieza de los datos de prueba (docs/area-ia.md, "Antes de la Fase 4").
 * DESTRUCTIVA y sin respaldo: el autor lo decidió así (2026-11-02).
 *
 * Va DESPUÉS de desplegar el código que ya no lee `personaje_narrativa`.
 *
 *  1. Personajes: se quedan con su nombre y su estado. Todo lo demás de la
 *     fila vuelve a NULL (o a su valor por defecto), y se borran sus
 *     estadísticas, habilidades, relaciones, conexiones (tablas N:M, vínculos,
 *     miembros de organizaciones, familia y gremio, el POV de los actos),
 *     fechas, imágenes de galería, notas y campos ocultos. Donde otra ficha los
 *     apunta (dueño de un artefacto, quien encarga una misión, narrador), la
 *     referencia queda vacía. Sus imágenes quedan sin uso en `media_assets` y
 *     las borra de Cloudinary la purga automática del siguiente guardado.
 *  2. Se borra la única canción (#5) con sus vínculos.
 *  3. Se retiran `personaje_narrativa` y `personaje_narrativa_hito`.
 *  4. Textos con HTML (pegado de Word o del editor viejo) pasan a markdown, que
 *     es lo que entiende la web: mismo texto, sin el código.
 *  5. Las viñetas escritas a mano ("•") pasan a listas de markdown.
 *  6. SYLVATERRA: se vacían los campos de relleno que el autor señaló.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-limpieza-prueba.ts            (ENSAYO)
 *     node --env-file=.env.local scripts/migrations/migrate-limpieza-prueba.ts --aplicar
 *
 * El ensayo hace todo dentro de una transacción que revierte al final y deja el
 * detalle (antes y después de cada texto) en `lore/limpieza-ensayo.md`, fuera
 * de git. Idempotente: repetirla no encuentra nada que limpiar.
 */
import { writeFileSync } from "node:fs";
import postgres from "postgres";

const APLICAR = process.argv.includes("--aplicar");
const INFORME = "lore/limpieza-ensayo.md";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 1, onnotice: () => {} });

type Tx = postgres.TransactionSql;
const informe: string[] = [];
const log = (linea: string) => {
  console.log(linea);
  informe.push(linea);
};

// ── 1. Personajes ────────────────────────────────────────────────────────────

/** Lo único que se queda de cada personaje. */
const SE_QUEDAN = ["id", "nombre", "estado_publicacion", "publicado_primera_vez_en", "creado_en", "actualizado_en", "eliminado_en"];

/**
 * Cada clave foránea que apunta a `personajes`, y qué se hace con ella. Si la
 * base tiene una que no está aquí, no se toca nada: habría que decidirla antes.
 */
const FK_PERSONAJES: Record<string, "borrar" | "vaciar" | "retirar"> = {
  "estadisticas.personaje_id": "borrar",
  "habilidades.personaje_id": "borrar",
  "relaciones.personaje_id": "borrar",
  "relaciones.personaje_relacionado_id": "borrar",
  "personaje_evento.personaje_id": "borrar",
  "personaje_objeto.personaje_id": "borrar",
  "personaje_nacion.personaje_id": "borrar",
  "personaje_raza.personaje_id": "borrar",
  "hoja_personaje.personaje_id": "borrar",
  "org_jerarquia.personaje_id": "borrar",
  "org_historial.personaje_id": "borrar",
  "familia_jerarquia.personaje_id": "borrar",
  "familia_arbol.personaje_id": "borrar",
  "gremio_jerarquia.personaje_id": "borrar",
  "gremio_historial.personaje_id": "borrar",
  "armas_artefactos.propietario_id": "vaciar",
  "misiones.personaje_id": "vaciar",
  "capitulos.narrador_personaje_id": "vaciar",
  "acto_fragmento.personaje_id": "vaciar",
  "personaje_narrativa.personaje_id": "retirar",
};

async function fksHacia(tx: Tx, tabla: string) {
  return tx<{ tabla: string; columna: string }[]>`
    select c.conrelid::regclass::text as tabla, a.attname as columna
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
     where c.contype = 'f' and c.confrelid = ${tabla}::regclass`;
}

/** Tablas polimórficas: las que guardan `entidad_tipo` (salvo el buscador, que lleva su trigger). */
async function polimorficas(tx: Tx): Promise<string[]> {
  const filas = await tx<{ t: string }[]>`
    select table_name as t from information_schema.columns
     where table_schema = 'public' and column_name = 'entidad_tipo' and table_name <> 'search_index'
     order by 1`;
  return filas.map((f) => f.t);
}

async function personajes(tx: Tx) {
  log("## 1. Personajes\n");
  const desconocidas = (await fksHacia(tx, "personajes")).filter((f) => !FK_PERSONAJES[`${f.tabla}.${f.columna}`]);
  if (desconocidas.length) {
    throw new Error(`Claves foráneas a personajes sin decidir: ${desconocidas.map((f) => `${f.tabla}.${f.columna}`).join(", ")}. No se toca nada.`);
  }

  // La fila del personaje: todo lo que no se queda, a NULL o a su valor por defecto.
  const columnas = await tx<{ c: string; nulo: string; defecto: string | null }[]>`
    select column_name as c, is_nullable as nulo, column_default as defecto
      from information_schema.columns
     where table_schema = 'public' and table_name = 'personajes'
     order by ordinal_position`;
  const vaciar = columnas.filter((c) => !SE_QUEDAN.includes(c.c));
  const imposibles = vaciar.filter((c) => c.nulo === "NO" && c.defecto === null);
  if (imposibles.length) throw new Error(`Columnas de personajes sin NULL ni valor por defecto: ${imposibles.map((c) => c.c).join(", ")}.`);
  const condicion = vaciar.map((c) => `"${c.c}" is distinct from ${c.defecto ?? "null"}`).join(" or ");
  const [antes] = await tx.unsafe<{ n: number; total: number; papelera: number }[]>(
    `select count(*) filter (where ${condicion})::int as n, count(*)::int as total, count(*) filter (where eliminado_en is not null)::int as papelera from personajes`,
  );
  const sets = vaciar.map((c) => `"${c.c}" = ${c.defecto === null ? "null" : "default"}`).join(", ");
  const r = await tx.unsafe(`update personajes set ${sets} where ${condicion}`);
  log(`- ${antes.total} personajes (${antes.papelera} en la papelera); ${r.count} tenían algo más que el nombre y el estado, y se vaciaron.`);
  log(`- Columnas vaciadas (${vaciar.length}): ${vaciar.map((c) => c.c).join(", ")}.`);

  // Lo que cuelga del personaje.
  log("\nConexiones y datos propios:\n");
  // Los nodos del árbol que se borran pueden ser padre o madre de otros.
  await tx`update familia_arbol set padre_id = null where padre_id in (select id from familia_arbol where personaje_id is not null)`;
  await tx`update familia_arbol set madre_id = null where madre_id in (select id from familia_arbol where personaje_id is not null)`;
  for (const [fk, accion] of Object.entries(FK_PERSONAJES)) {
    const [tabla, columna] = fk.split(".");
    if (accion === "retirar") continue;
    const q =
      accion === "borrar"
        ? `delete from ${tabla} where ${columna} is not null`
        : tabla === "capitulos"
          ? `update capitulos set narrador_personaje_id = null, narrador_tipo = null where narrador_personaje_id is not null`
          : `update ${tabla} set ${columna} = null where ${columna} is not null`;
    const res = await tx.unsafe(q);
    if (res.count) log(`- ${tabla}.${columna}: ${res.count} ${accion === "borrar" ? "filas borradas" : "referencias vaciadas"}.`);
  }
  const v = await tx`delete from vinculo where origen_tipo = 'personajes' or destino_tipo = 'personajes'`;
  if (v.count) log(`- vinculo: ${v.count} vínculos borrados (POV de actos, temas de personaje…).`);
  for (const t of await polimorficas(tx)) {
    const res = await tx.unsafe(`delete from ${t} where entidad_tipo = 'personajes'`);
    if (res.count) log(`- ${t}: ${res.count} filas borradas.`);
  }
  log("");
}

// ── 2. La canción ────────────────────────────────────────────────────────────

const CANCION = 5;

async function cancion(tx: Tx) {
  log("## 2. La canción\n");
  const todas = await tx<{ id: number; titulo: string }[]>`select id, titulo from canciones`;
  if (!todas.length) {
    log("- Ya no hay canciones.\n");
    return;
  }
  if (todas.length !== 1 || todas[0].id !== CANCION) {
    throw new Error(`Se esperaba una sola canción, la #${CANCION}; hay: ${todas.map((c) => `#${c.id} ${c.titulo}`).join(", ")}. No se toca nada.`);
  }
  const fks = await fksHacia(tx, "canciones");
  if (fks.length) throw new Error(`Hay claves foráneas a canciones sin decidir: ${fks.map((f) => `${f.tabla}.${f.columna}`).join(", ")}.`);
  const v = await tx`delete from vinculo where (origen_tipo = 'canciones' and origen_id = ${CANCION}) or (destino_tipo = 'canciones' and destino_id = ${CANCION})`;
  let otras = 0;
  for (const t of await polimorficas(tx)) otras += (await tx.unsafe(`delete from ${t} where entidad_tipo = 'canciones' and entidad_id = $1`, [CANCION])).count;
  await tx`delete from canciones where id = ${CANCION}`;
  log(`- Borrada «${todas[0].titulo}» (#${CANCION}), con ${v.count} vínculos y ${otras} filas más (fechas, notas, galería). Su audio, si lo tenía, lo purga el panel.\n`);
}

// ── 3. personaje_narrativa ───────────────────────────────────────────────────

async function narrativa(tx: Tx) {
  log("## 3. personaje_narrativa\n");
  for (const t of ["personaje_narrativa_hito", "personaje_narrativa"]) {
    const [r] = await tx<{ ok: boolean }[]>`select to_regclass(${"public." + t}) is not null as ok`;
    if (!r.ok) {
      log(`- ${t}: ya retirada.`);
      continue;
    }
    const [n] = await tx.unsafe<{ n: number }[]>(`select count(*)::int as n from ${t}`);
    await tx.unsafe(`drop table ${t}`);
    log(`- ${t}: retirada (${n.n} filas).`);
  }
  log("");
}

// ── 4 y 5. HTML y viñetas ────────────────────────────────────────────────────

const NEGRITA = "\u0001";
const ITEM = "\u0002";
const CURSIVA = "\u0003";
const TABLA = "\u0004";

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&quot;": '"',
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&apos;": "'",
};

function decodificar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? e);
}

/** Negrita y cursiva a marcas; el resto de etiquetas en línea (span, font, a, o:p) fuera. */
function enLinea(s: string): string {
  return s
    .replace(/<(b|strong)\b[^>]*>/gi, NEGRITA)
    .replace(/<\/(b|strong)>/gi, NEGRITA)
    .replace(/<(i|em)\b[^>]*>/gi, CURSIVA)
    .replace(/<\/(i|em)>/gi, CURSIVA)
    .replace(/<\/?(span|font|a|o:p|u|sup|sub)\b[^>]*>/gi, "");
}

/** Las marcas de una línea, a markdown. Si quedan desparejadas, se quitan. */
function marcas(linea: string): string {
  let l = linea;
  for (const [m, md] of [
    [NEGRITA, "**"],
    [CURSIVA, "*"],
  ] as const) {
    // Dos marcas seguidas (cierre y apertura, o una vacía) se anulan: une los tramos que Word parte.
    l = l.replace(new RegExp(`${m}(\\s*)${m}`, "g"), "$1");
    if ((l.split(m).length - 1) % 2) {
      l = l.split(m).join("");
      continue;
    }
    l = l.replace(new RegExp(`${m}([^${m}]*)${m}`, "g"), (_, c: string) => {
      const t = c.trim();
      return t ? `${c.startsWith(" ") ? " " : ""}${md}${t}${md}${c.endsWith(" ") ? " " : ""}` : c;
    });
  }
  return l.replace(/ {2,}/g, " ").trim();
}

function celda(html: string): string {
  const t = decodificar(enLinea(html).replace(/<[^>]+>/g, " "));
  return marcas(t.replace(/\s+/g, " ")).replace(/\|/g, "/");
}

function tablaAMarkdown(html: string): string {
  const filas = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((f) =>
    [...f[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => celda(c[1])),
  );
  if (!filas.length) return "";
  const ancho = Math.max(...filas.map((f) => f.length));
  const fila = (f: string[]) => `| ${Array.from({ length: ancho }, (_, i) => f[i] ?? "").join(" | ")} |`;
  return [fila(filas[0]), `|${" --- |".repeat(ancho)}`, ...filas.slice(1).map(fila)].join("\n");
}

/** Une las líneas en bloques de markdown: párrafos separados por línea en blanco y listas seguidas. */
function componer(lineas: string[], tablas: string[]): string {
  const bloques: { texto: string; item: boolean }[] = [];
  for (const cruda of lineas) {
    let l = cruda.replace(/[ \u00a0]+/g, " ").trim();
    if (!l) continue;
    const t = new RegExp(`^${TABLA}(\\d+)${TABLA}$`).exec(l);
    if (t) {
      if (tablas[Number(t[1])]) bloques.push({ texto: tablas[Number(t[1])], item: false });
      continue;
    }
    let item = false;
    if (l.startsWith(ITEM)) {
      item = true;
      l = l.slice(1).trim();
    }
    if (/^•\s*/.test(l)) {
      item = true;
      l = l.replace(/^•\s*/, "");
    } else if (/^[-*]\s+/.test(l)) {
      item = true;
      l = l.replace(/^[-*]\s+/, "");
    }
    l = marcas(l);
    if (!l) continue;
    bloques.push({ texto: item ? `- ${l}` : l, item });
  }
  return bloques.map((b, i) => (i === 0 ? "" : bloques[i - 1].item && b.item ? "\n" : "\n\n") + b.texto).join("");
}

function htmlAMarkdown(original: string): string {
  let s = original
    .replace(/\\&quot;/g, "&quot;")
    .replace(/\\"/g, '"') // comillas escapadas del pegado de Word
    .replace(/\\[nrt]/g, " ") // \n, \r y \t escritos como texto
    .replace(/[\r\n\t]+/g, " ") // en HTML, los saltos reales también son espacio
    .replace(/<!--[\s\S]*?-->/g, "");
  const tablas: string[] = [];
  s = s.replace(/<table\b[\s\S]*?<\/table>/gi, (t) => {
    tablas.push(tablaAMarkdown(t));
    return `\n${TABLA}${tablas.length - 1}${TABLA}\n`;
  });
  s = enLinea(s)
    .replace(/<li\b[^>]*>/gi, `\n${ITEM}`)
    .replace(/<\/?(p|div|br|ul|ol|li|h[1-6]|blockquote|section|article|thead|tbody|tr|td|th)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return componer(decodificar(s).split("\n"), tablas);
}

/** Viñetas "•" a principio de línea, a lista de markdown. */
function vinetas(s: string): string {
  return s
    .split(/\r?\n/)
    .map((l) => l.replace(/^[ \t]*•[ \t]*/, "- "))
    .join("\n");
}

/** Lo que no se recorre: lo que ya se vació o se borró, y lo que no es prosa de una ficha. */
const SIN_TEXTOS = new Set(["personajes", "canciones", "search_index", "media_assets", "catalogos"]);

async function textos(tx: Tx) {
  const columnas = await tx<{ t: string; c: string }[]>`
    select c.table_name as t, c.column_name as c
      from information_schema.columns c
      join information_schema.tables x using (table_schema, table_name)
     where c.table_schema = 'public' and x.table_type = 'BASE TABLE'
       and c.data_type in ('text', 'character varying')
       and c.table_name not like 'respaldo%'
       and c.column_name not like '%url%'
     order by 1, 2`;
  const nombreDe = new Map<string, string | null>();
  async function rotulo(t: string): Promise<string | null> {
    if (!nombreDe.has(t)) {
      const [r] = await tx<{ c: string | null }[]>`
        select column_name as c from information_schema.columns
         where table_schema = 'public' and table_name = ${t} and column_name in ('nombre', 'titulo')
         order by column_name = 'nombre' desc limit 1`;
      nombreDe.set(t, r?.c ?? null);
    }
    return nombreDe.get(t) ?? null;
  }

  const html: string[] = [];
  const listas: string[] = [];
  let nHtml = 0;
  let nListas = 0;
  for (const { t, c } of columnas) {
    if (SIN_TEXTOS.has(t)) continue;
    const [pk] = await tx<{ c: string }[]>`
      select a.attname as c from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
       where i.indrelid = ${t}::regclass and i.indisprimary`;
    if (!pk) continue;
    const nom = await rotulo(t);
    const filas = await tx.unsafe<{ id: number; nombre: string | null; v: string }[]>(
      `select "${pk.c}" as id, ${nom ? `"${nom}"::text` : "null"} as nombre, "${c}" as v from ${t}
        where "${c}" ~ '<[a-zA-Z/][^>]*>' or "${c}" ~ E'(^|\\n)[ \\t]*•' order by 1`,
    );
    for (const f of filas) {
      const conHtml = /<[a-zA-Z/][^>]*>/.test(f.v);
      const nuevo = conHtml ? htmlAMarkdown(f.v) : vinetas(f.v);
      if (nuevo === f.v) continue;
      await tx.unsafe(`update ${t} set "${c}" = $1 where "${pk.c}" = $2`, [nuevo || null, f.id]);
      const titulo = `${t} #${f.id}${f.nombre ? ` ${f.nombre}` : ""} · ${c}`;
      if (conHtml) {
        nHtml++;
        html.push(
          `### ${titulo}\n\nAntes (${f.v.length} caracteres, primeros 400):\n\n\`\`\`html\n${f.v.slice(0, 400)}\n\`\`\`\n\nDespués (${nuevo.length} caracteres${nuevo ? "" : ", queda vacío"}):\n\n\`\`\`markdown\n${nuevo}\n\`\`\`\n`,
        );
      } else {
        nListas++;
        const n = f.v.split(/\r?\n/).filter((l) => /^[ \t]*•/.test(l)).length;
        listas.push(`- ${titulo}: ${n} viñetas`);
      }
    }
  }
  log(`## 4. HTML a markdown\n\n- ${nHtml} textos convertidos (el detalle, al final).\n`);
  log(`## 5. Viñetas a listas\n\n- ${nListas} textos más:\n${listas.join("\n")}\n`);
  return html;
}

// ── 6. SYLVATERRA ────────────────────────────────────────────────────────────

/** Los rellenos que señaló el autor, tal cual están: si alguno cambió, ese no se toca. */
const RELLENO: Record<string, string | number> = {
  recursos_naturales: "aba",
  descripcion: "Nación de la sabiduria",
  historia: "Mucho conocimiento",
  estado_actual: "En crisis.",
  estructura: "Pura mente",
  idioma: "Ukanastruka Nikas Truka",
  poblacion: "50000000 Millones",
  poder_militar_nivel: 36,
  poder_economico_nivel: 33,
  poder_politico_nivel: 92,
  poder_magico_nivel: 83,
  poder_tecnologico_nivel: 24,
};

async function sylvaterra(tx: Tx) {
  log("## 6. SYLVATERRA\n");
  const [n] = await tx.unsafe<Record<string, unknown>[]>(
    `select nombre, ${Object.keys(RELLENO).map((c) => `"${c}"`).join(", ")} from naciones where id = 1`,
  );
  if (!n || String(n.nombre).toUpperCase() !== "SYLVATERRA") {
    log("- La nación #1 no es SYLVATERRA: no se toca.\n");
    return;
  }
  const vaciados: string[] = [];
  for (const [c, esperado] of Object.entries(RELLENO)) {
    if (n[c] === null) continue;
    if (String(n[c]).trim() !== String(esperado)) {
      log(`- ${c}: cambió («${String(n[c]).slice(0, 60)}»), se deja.`);
      continue;
    }
    await tx.unsafe(`update naciones set "${c}" = null where id = 1`);
    vaciados.push(c);
  }
  log(vaciados.length ? `- Vaciados: ${vaciados.join(", ")}.\n` : "- Nada que vaciar.\n");
}

// ── Entrada ──────────────────────────────────────────────────────────────────

async function trabajo(tx: Tx) {
  await personajes(tx);
  await cancion(tx);
  await narrativa(tx);
  const html = await textos(tx);
  await sylvaterra(tx);

  // Como lib/media/purga.ts: un asset está en uso si lo cita la galería o alguna columna *_asset_id.
  const cols = await tx<{ t: string; c: string }[]>`
    select table_name as t, column_name as c from information_schema.columns
     where table_schema = 'public' and column_name in ('imagen_asset_id', 'banner_asset_id', 'audio_asset_id')`;
  const usados = ["select asset_id as id from entidad_media", ...cols.map((x) => `select "${x.c}" from ${x.t}`)].join(" union ");
  const [huerfanos] = await tx.unsafe<{ n: number }[]>(
    `select count(*)::int as n from media_assets a where a.id not in (select id from (${usados}) u where id is not null)`,
  );
  log(`Imágenes y audios que quedan sin uso (los borra de Cloudinary la purga del siguiente guardado del panel): ${huerfanos.n}.\n`);
  return html;
}

try {
  console.log(APLICAR ? "⚙️  APLICANDO cambios a la base…\n" : "🔍 ENSAYO (no se escribe nada; todo se revierte al final)\n");
  informe.push(`# ${APLICAR ? "Limpieza aplicada" : "Ensayo de la limpieza"} · ${new Date().toLocaleString("sv-SE")}\n`);
  let html: string[] = [];
  if (APLICAR) {
    await sql.begin(async (tx) => {
      html = await trabajo(tx);
    });
  } else {
    const CENTINELA = "__ensayo_terminado__";
    try {
      await sql.begin(async (tx) => {
        html = await trabajo(tx);
        throw new Error(CENTINELA);
      });
    } catch (e) {
      if ((e as Error)?.message !== CENTINELA) throw e;
    }
  }
  writeFileSync(INFORME, `${informe.join("\n")}\n---\n\n# Detalle del HTML convertido\n\n${html.join("\n")}`);
  console.log(
    APLICAR
      ? `\n✅ Aplicado. Detalle en ${INFORME}.`
      : `\n✅ Ensayo terminado y revertido. La base está intacta.\n   Detalle en ${INFORME}. Para aplicarlo de verdad: añade --aplicar`,
  );
} finally {
  await sql.end();
}
