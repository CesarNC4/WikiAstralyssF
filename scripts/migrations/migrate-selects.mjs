/**
 * Frente F — Reforma de los desplegables.
 *
 * Prepara la base para que las 20 fichas tengan sus listas completas:
 *  1. columnas nuevas de los desplegables que no existían,
 *  2. columnas que dejan de servir (`bestias.categoria`, `armas_artefactos.propietario_actual`),
 *  3. campos que pasan a admitir varios valores (terreno, hábitat, uso),
 *  4. el `tipo` de locación deja de ser un enum rígido de Postgres,
 *  5. y la migración de los valores ya guardados a su forma canónica.
 *
 * Uso:
 *     node --env-file=.env.local scripts/migrations/migrate-selects.mjs            (ENSAYO: no escribe)
 *     node --env-file=.env.local scripts/migrations/migrate-selects.mjs --aplicar  (escribe de verdad)
 *
 * El ensayo hace exactamente el mismo trabajo dentro de una transacción que se
 * revierte al final, así que lo que informa es lo que pasaría de verdad.
 * Idempotente: se puede correr las veces que haga falta.
 */
import postgres from "postgres";
import { CATALOGOS, CATALOGOS_AGRUPADOS } from "../../lib/catalogos.ts";
import { ELEMENTOS } from "../../lib/elementos.ts";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("❌ DATABASE_URL no definida.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, connect_timeout: 20, idle_timeout: 20, max: 3 });

const log = [];
const avisos = [];
const nota = (s) => { log.push(s); console.log(s); };
const aviso = (s) => { avisos.push(s); };

// ── Columnas nuevas ────────────────────────────────────────────────────────
// [tabla, columna, tipo]. Se crean con IF NOT EXISTS, así que repetir no duele.
const COLUMNAS = [
  ["elementos", "familia", "varchar"],

  ["regiones", "tipo", "varchar"],
  ["regiones", "clima", "varchar"],
  ["regiones", "terreno", "text[]"],
  ["regiones", "estado", "varchar"],

  ["locaciones", "estado", "varchar"],
  ["locaciones", "escala", "varchar"],

  ["razas", "estado", "varchar"],
  ["razas", "longevidad", "varchar"],
  ["razas", "rareza", "varchar"],

  ["bestias", "naturaleza", "varchar"],
  // `comportamiento` y `habitat` ya existen como texto largo descriptivo;
  // el desplegable va aparte para poder filtrar sin perder la prosa.
  ["bestias", "comportamiento_tipo", "varchar"],
  ["bestias", "biomas", "text[]"],

  ["minerales", "composicion", "varchar"],
  ["minerales", "estado", "varchar"],
  ["minerales", "estado_fisico", "varchar"],

  ["magia_fundamentos", "coste", "varchar"],
  ["magia_fundamentos", "legalidad", "varchar"],

  ["personajes", "estado_vital", "varchar"],
  ["personajes", "ocupacion_detalle", "varchar"],

  // El afecto es de cada lado: A puede sentir amor y B odio. Como la relación
  // se guarda en UNA fila y la otra ficha la lee invertida, hacen falta dos
  // columnas, no una.
  ["relaciones", "afecto", "varchar"],
  ["relaciones", "afecto_reciproco", "varchar"],

  ["organizaciones", "legalidad", "varchar"],
  ["familias", "estatus", "varchar"],

  ["misiones", "tamano_grupo", "varchar"],
  ["misiones", "ubicacion_nacion_id", "integer"],
  ["misiones", "ubicacion_region_id", "integer"],
  ["misiones", "ubicacion_locacion_id", "integer"],

  ["lord_demonio", "era", "varchar"],
  ["lord_demonio", "anio_lore", "integer"],
  ["timeline_eventos", "anio_lore", "integer"],

  ["conceptos", "destacado", "boolean not null default false"],

  ["armas_artefactos", "rareza", "varchar"],

  ["capitulos", "narrador_personaje_id", "integer"],
  ["capitulos", "narrador_tipo", "varchar"],

  ["canciones", "uso", "varchar"],
];

/** Claves foráneas de las referencias nuevas. */
const FKS = [
  ["misiones", "ubicacion_nacion_id", "naciones", "set null"],
  ["misiones", "ubicacion_region_id", "regiones", "set null"],
  ["misiones", "ubicacion_locacion_id", "locaciones", "set null"],
  ["capitulos", "narrador_personaje_id", "personajes", "set null"],
];

/** Columnas que se retiran. */
const A_BORRAR = [
  // La categoría de bestia (Común/Jefe/Legendaria/Divina) medía lo mismo que el
  // nivel de amenaza; en su lugar entra `naturaleza`.
  ["bestias", "categoria"],
  // Duplicaba el propietario, que ya es una referencia a ficha en las dos direcciones.
  ["armas_artefactos", "propietario_actual"],
  // La afinidad elemental pasa a `entidad_elemento` para admitir varias y para
  // que el elemento sepa quién lo usa.
  ["razas", "afinidad"],
  ["minerales", "elemento"],
];

/**
 * Valores ya guardados que cambian de forma. Solo entran aquí los que tienen
 * equivalente inequívoco; lo dudoso se vacía y se informa.
 */
const MIGRACIONES = [
  ["razas", "clasificacion", {
    ALTERADA: "Alteradas por el Maná",
    CORRUPTA: "Corruptas o Malditas",
    PRIMORDIAL: "Primordiales",
    ESPIRITUAL: "Espirituales o Místicas",
    ARTIFICIAL: "Artificiales",
  }],
  ["naciones", "gobierno", { Eruditos: "Consejo de eruditos" }],
  ["magia_fundamentos", "naturaleza", { Tecnica: "Técnica", "Tecnica Avanzada": "Técnica Avanzada" }],
  ["personajes", "nivel_de_consciencia", {
    D: "D (Latente)", C: "C (Despierto)", B: "B (Consciente)", A: "A (Pleno)", S: "S (Trascendente)",
  }],
  ["bestias", "nivel_amenaza", { Inofensiva: "E", Baja: "D", Media: "C", Alta: "B", Extrema: "S", Apocalíptica: "SSS" }],
  ["bestias", "tamano", {
    Diminuto: "Diminuto (menos de 0,5 m)",
    Pequeño: "Pequeño (0,5-1,5 m)",
    Mediano: "Mediano (1,5-3 m)",
    Grande: "Grande (3-8 m)",
    Colosal: "Colosal (20-100 m)",
  }],
  ["minerales", "tipo", { Naturales: "Natural", Arcanos: "Arcano", Disonantes: "Disonante", Sintéticos: "Sintético" }],
  ["misiones", "nivel_riesgo", { Grande: "B: Alto" }],
  ["canciones", "tipo_fuente", { YOUTUBE: "YouTube", LOCAL: "Local", SPOTIFY: "Spotify", SOUNDCLOUD: "SoundCloud" }],
  ["personajes", "ocupacion", { Escriba: "Erudito / Escriba" }],
  ["habilidades", "categoria", { TECNICA: "Técnica" }],
];

/**
 * Valores sin equivalente claro: se vacían y se listan al final, para que los
 * elijas tú al abrir la ficha. Es lo acordado: no adivinar por ti.
 */
const A_VACIAR = [
  ["minerales", "tipo", ["Mineral"]],
  ["misiones", "tipo", ["Pilas"]],
  ["personajes", "magia_principal_variante", ["De Sangre"]],
  ["actos", "estado", ["Pendiente"]],
];

/**
 * El esquema se lee una sola vez y se mantiene al día en memoria: preguntar a
 * `information_schema` por cada columna eran decenas de viajes a la base.
 */
let COLS = new Set();
let TABLAS = new Set();

async function cargarEsquema(tx) {
  const cols = await tx`select table_name, column_name from information_schema.columns
                        where table_schema = 'public'`;
  COLS = new Set(cols.map((r) => `${r.table_name}.${r.column_name}`));
  TABLAS = new Set(cols.map((r) => r.table_name));
}

const columnaExiste = (_tx, tabla, columna) => COLS.has(`${tabla}.${columna}`);
const tablaExiste = (_tx, tabla) => TABLAS.has(tabla);
const marcarColumna = (tabla, columna) => COLS.add(`${tabla}.${columna}`);
const olvidarColumna = (tabla, columna) => COLS.delete(`${tabla}.${columna}`);

/**
 * Siembra `catalogos` y `elementos` antes que nada: los pasos siguientes
 * comprueban valores contra esas listas, así que tienen que existir ya.
 * Aditivo: no borra lo que hayas añadido desde /admin/catalogos.
 */
/**
 * Catálogos que dejan de existir porque su contenido se unificó o se mudó.
 * Sus valores viven ahora en el catálogo compartido que se indica.
 */
const CATALOGOS_OBSOLETOS = {
  nacion_clima: "clima",
  nacion_terreno: "terreno",
  raza_dieta: "dieta",
  bestia_dieta: "dieta",
  mineral_rareza: "rareza",
  demonio_estado: "estado_vital",
  arbol_estado: "estado_vital",
  nacion_elemento: "tabla elementos",
  raza_afinidad: "tabla elementos",
  mineral_elemento: "tabla elementos",
  magia_variante: "tabla elementos",
  bestia_categoria: "bestia_naturaleza",
  arma_variante: "artefacto_variante",
};

/** Opciones sueltas que se retiran de un catálogo que por lo demás sigue igual. */
const VALORES_RETIRADOS = [
  // La legalidad sale del estado: una organización puede estar activa Y ser clandestina.
  ["org_estado", ["Clandestina", "En guerra"]],
  // Las letras sueltas se sustituyen por "A (Pleno)" y compañía.
  ["nivel_consciencia", ["D", "C", "B", "A", "S"]],
  // La amenaza pasa a escala de letras, como misiones.
  ["bestia_nivel_amenaza", ["Inofensiva", "Baja", "Media", "Alta", "Extrema", "Apocalíptica"]],
  // El tamaño gana referencia de altura.
  ["bestia_tamano", ["Diminuto", "Pequeño", "Mediano", "Grande", "Colosal"]],
  // La naturaleza de magia gana tildes.
  ["magia_naturaleza", ["Tecnica", "Tecnica Avanzada"]],
  // El tipo de mineral pasa a singular.
  ["mineral_tipo", ["Naturales", "Arcanos", "Disonantes", "Sintéticos"]],
];

async function sembrarCatalogos(tx) {
  // ── La restricción de unicidad no contaba el grupo ───────────────────────
  // Era UNIQUE(campo, valor), y eso impide que "Formal" exista a la vez como
  // subtipo de Mentor y de Aprendiz, o que "Ritual" sea variante de dos tipos
  // de artefacto. Pasa a contar el grupo.
  const [vieja] = await tx`select 1 from pg_constraint
                           where conrelid = 'catalogos'::regclass and conname = 'catalogos_campo_valor_key'`;
  if (vieja) {
    await tx.unsafe(`alter table catalogos drop constraint catalogos_campo_valor_key`);
    // Índice, no constraint: en Postgres dos NULL se consideran distintos, así
    // que la unicidad se apoya en coalesce para que los sin grupo sí choquen.
    await tx.unsafe(
      `create unique index if not exists catalogos_campo_grupo_valor_key
         on catalogos (campo, coalesce(grupo, ''), valor)`,
    );
    nota("→ catalogos: la unicidad pasa de (campo, valor) a (campo, grupo, valor)");
  }

  // ── Limpieza de lo que se unificó o se mudó ──────────────────────────────
  for (const [campo, destino] of Object.entries(CATALOGOS_OBSOLETOS)) {
    const r = await tx`delete from catalogos where campo = ${campo}`;
    if (r.count > 0) nota(`   catalogos: retirado '${campo}' (${r.count} opciones) → ahora en ${destino}`);
  }
  for (const [campo, valores] of VALORES_RETIRADOS) {
    const r = await tx`delete from catalogos where campo = ${campo} and valor in ${tx(valores)}`;
    if (r.count > 0) nota(`   catalogos: ${r.count} opción(es) retirada(s) de '${campo}'`);
  }
  // Los catálogos que pasan a tener grupo no pueden conservar sus filas sueltas.
  for (const campo of Object.keys(CATALOGOS_AGRUPADOS)) {
    const r = await tx`delete from catalogos where campo = ${campo} and grupo is null`;
    if (r.count > 0) nota(`   catalogos: '${campo}' pasa a estar agrupado, ${r.count} opción(es) sin grupo retiradas`);
  }

  const semilla = [];
  for (const [campo, valores] of Object.entries(CATALOGOS)) {
    valores.forEach((valor, i) => semilla.push({ campo, grupo: null, valor, orden: i }));
  }
  for (const [campo, grupos] of Object.entries(CATALOGOS_AGRUPADOS)) {
    for (const [grupo, valores] of Object.entries(grupos)) {
      valores.forEach((valor, i) => semilla.push({ campo, grupo, valor, orden: i }));
    }
  }

  // Por lotes: son ~450 opciones y una consulta por cada una tardaba minutos
  // contra la base remota. Se lee todo de golpe, se compara aquí y se escribe
  // en dos sentencias.
  const existentes = await tx`select id, campo, grupo, valor, orden from catalogos`;
  const clave = (c, g, v) => `${c} ${g ?? ""} ${v}`;
  const indice = new Map(existentes.map((r) => [clave(r.campo, r.grupo, r.valor), r]));

  const aInsertar = [];
  const aReordenar = [];
  for (const f of semilla) {
    const ya = indice.get(clave(f.campo, f.grupo, f.valor));
    if (!ya) aInsertar.push(f);
    else if (ya.orden !== f.orden) aReordenar.push({ id: ya.id, orden: f.orden });
  }

  if (aInsertar.length) {
    await tx`insert into catalogos ${tx(aInsertar, "campo", "grupo", "valor", "orden")}`;
  }
  if (aReordenar.length) {
    // Un solo UPDATE con una tabla de valores, en vez de uno por fila. Los dos
    // números salen de la base y del archivo, no de entrada de usuario.
    const valores = aReordenar.map((r) => `(${Number(r.id)}, ${Number(r.orden)})`).join(",");
    await tx.unsafe(
      `update catalogos c set orden = v.orden from (values ${valores}) as v(id, orden) where c.id = v.id`,
    );
  }
  nota(`→ Catálogos: ${aInsertar.length} opciones nuevas, ${aReordenar.length} reordenadas (de ${semilla.length} declaradas)`);

  // La columna `familia` puede no existir todavía la primera vez.
  if (!(await columnaExiste(tx, "elementos", "familia"))) {
    await tx.unsafe(`alter table "elementos" add column "familia" varchar`);
    marcarColumna("elementos", "familia");
  }
  let elemNuevos = 0;
  let elemRenombrados = 0;
  for (const [i, e] of ELEMENTOS.entries()) {
    const [ya] = await tx`select id, nombre, familia from elementos where slug = ${e.slug} limit 1`;
    if (!ya) {
      await tx`insert into elementos (slug, nombre, familia, color, icono, orden, estado_publicacion)
               values (${e.slug}, ${e.nombre}, ${e.familia}, ${e.color}, ${e.icono}, ${i}, 'publicado')`;
      elemNuevos++;
    } else {
      if (ya.nombre !== e.nombre) {
        nota(`   elementos: '${ya.nombre}' → '${e.nombre}' (los vínculos van por id, no se rompe ninguno)`);
        elemRenombrados++;
      }
      await tx`update elementos set nombre = ${e.nombre}, familia = ${e.familia}, orden = ${i} where id = ${ya.id}`;
    }
  }
  nota(`→ Elementos: ${elemNuevos} nuevos, ${elemRenombrados} renombrados, ${ELEMENTOS.length} en total`);
}

async function trabajo(tx) {
  await cargarEsquema(tx);
  await sembrarCatalogos(tx);

  // ── 1. Columnas nuevas ───────────────────────────────────────────────────
  let nuevas = 0;
  for (const [t, c, tipo] of COLUMNAS) {
    if (!(await tablaExiste(tx, t))) { aviso(`tabla ausente, se salta: ${t}`); continue; }
    if (await columnaExiste(tx, t, c)) continue;
    await tx.unsafe(`alter table "${t}" add column "${c}" ${tipo}`);
    marcarColumna(t, c);
    nuevas++;
    nota(`   + ${t}.${c} (${tipo})`);
  }
  nota(`→ Columnas nuevas: ${nuevas}`);

  // ── 2. Campos que pasan a admitir varios valores ─────────────────────────
  // naciones.terreno era un varchar; se convierte conservando el valor actual
  // como primer elemento de la lista.
  const [tipoTerreno] = await tx`select data_type from information_schema.columns
                                 where table_schema='public' and table_name='naciones' and column_name='terreno'`;
  if (tipoTerreno && tipoTerreno.data_type !== "ARRAY") {
    await tx.unsafe(`alter table "naciones" alter column "terreno" type text[]
                     using (case when "terreno" is null or "terreno" = '' then null else array["terreno"] end)`);
    nota("→ naciones.terreno: varchar → text[] (el valor actual queda como primer elemento)");
  }

  // ── 3. locaciones.tipo deja de ser un enum de Postgres ───────────────────
  const [tipoLoc] = await tx`select data_type, udt_name from information_schema.columns
                             where table_schema='public' and table_name='locaciones' and column_name='tipo'`;
  if (tipoLoc && tipoLoc.data_type === "USER-DEFINED") {
    // Se quita el default antes de cambiar el tipo: apunta al enum viejo.
    await tx.unsafe(`alter table "locaciones" alter column "tipo" drop default`);
    await tx.unsafe(`alter table "locaciones" alter column "tipo" type varchar using "tipo"::text`);
    await tx.unsafe(`alter table "locaciones" alter column "tipo" drop not null`);
    await tx.unsafe(`update "locaciones" set "tipo" = case "tipo"
                       when 'ciudad'   then 'Ciudad'
                       when 'mazmorra' then 'Mazmorra'
                       when 'interes'  then 'Punto de interés'
                       when 'batalla'  then 'Campo de batalla'
                       else "tipo" end`);
    nota("→ locaciones.tipo: enum tipo_locacion → varchar del catálogo (valores capitalizados)");
  }

  // ── 4. La afinidad elemental se muda a entidad_elemento ──────────────────
  // Así una raza o un mineral pueden tener varias, y la ficha del elemento lista
  // sola a quién le afecta.
  const mudanzas = [
    ["razas", "afinidad", "razas"],
    ["minerales", "elemento", "minerales"],
  ];
  for (const [tabla, columna, entidad] of mudanzas) {
    if (!(await columnaExiste(tx, tabla, columna))) continue;
    const filas = await tx.unsafe(
      `select id, "${columna}" as v from "${tabla}" where "${columna}" is not null and "${columna}" <> ''`,
    );
    let movidas = 0;
    for (const f of filas) {
      // "Anemo (Vento)" quedó unificado como "Vento"; se busca por los dos nombres.
      const [el] = await tx`select id from elementos
                            where nombre = ${f.v} or nombre = ${`Anemo (${f.v})`} or slug = ${String(f.v).toLowerCase()}
                            limit 1`;
      if (!el) { aviso(`${tabla} #${f.id}: elemento '${f.v}' no existe en la tabla elementos, no se muda`); continue; }
      await tx`insert into entidad_elemento (entidad_tipo, entidad_id, elemento_id, relacion, orden)
               values (${entidad}, ${f.id}, ${el.id}, 'afinidad', 0)
               on conflict on constraint entidad_elemento_unico do nothing`;
      movidas++;
    }
    if (movidas) nota(`→ ${tabla}.${columna}: ${movidas} afinidad(es) movidas a entidad_elemento`);
  }

  // ── 4b. Columnas demasiado estrechas para las opciones nuevas ────────────
  // `razas.clasificacion` era varchar(20) y "Espirituales o Místicas" son 23
  // caracteres. Se quita el límite en las columnas que guardan opciones de
  // catálogo: el catálogo ya es quien controla qué se puede escribir.
  const ESTRECHAS = [
    ["razas", "clasificacion"],
    ["capitulos", "libro"],
    ["misiones", "rango_minimo"],
  ];
  for (const [t, c] of ESTRECHAS) {
    if (!columnaExiste(tx, t, c)) continue;
    const [col] = await tx`select character_maximum_length as len from information_schema.columns
                           where table_schema='public' and table_name=${t} and column_name=${c}`;
    if (!col || col.len === null) continue;
    await tx.unsafe(`alter table "${t}" alter column "${c}" type varchar`);
    nota(`→ ${t}.${c}: varchar(${col.len}) → varchar sin límite`);
  }

  // ── 4c. Los desplegables tienen que poder quedarse vacíos ────────────────
  // `misiones.tipo` era NOT NULL, así que vaciar un valor sin equivalente
  // reventaba. Un campo de catálogo sin elegir es un estado legítimo: significa
  // "todavía no lo he decidido", y el panel lo marca como ficha incompleta.
  const OPCIONALES = [
    ["misiones", "tipo"],
    ["minerales", "tipo"],
    ["conceptos", "categoria"],
    ["familias", "origen"],
    ["lord_demonio", "dominio"],
    ["personajes", "ocupacion"],
    ["actos", "estado"],
  ];
  for (const [t, c] of OPCIONALES) {
    if (!columnaExiste(tx, t, c)) continue;
    const [col] = await tx`select is_nullable from information_schema.columns
                           where table_schema='public' and table_name=${t} and column_name=${c}`;
    if (!col || col.is_nullable === "YES") continue;
    await tx.unsafe(`alter table "${t}" alter column "${c}" drop not null`);
    nota(`→ ${t}.${c}: deja de ser obligatoria (un desplegable puede estar sin elegir)`);
  }

  // ── 5. Migración de valores ──────────────────────────────────────────────
  let cambiados = 0;
  for (const [t, c, mapa] of MIGRACIONES) {
    if (!(await columnaExiste(tx, t, c))) continue;
    for (const [viejo, nuevo] of Object.entries(mapa)) {
      const r = await tx.unsafe(`update "${t}" set "${c}" = $1 where "${c}" = $2`, [nuevo, viejo]);
      if (r.count > 0) { nota(`   ${t}.${c}: ${r.count}x '${viejo}' → '${nuevo}'`); cambiados += r.count; }
    }
  }
  nota(`→ Valores migrados: ${cambiados}`);

  // ── 6. Valores sin equivalente: se vacían y se informan ──────────────────
  let vaciados = 0;
  for (const [t, c, valores] of A_VACIAR) {
    if (!(await columnaExiste(tx, t, c))) continue;
    for (const v of valores) {
      const filas = await tx.unsafe(`select id from "${t}" where "${c}" = $1`, [v]);
      if (filas.length === 0) continue;
      await tx.unsafe(`update "${t}" set "${c}" = null where "${c}" = $1`, [v]);
      vaciados += filas.length;
      aviso(`ELEGIR: ${t} #${filas.map((x) => x.id).join(", ")} tenía ${c}='${v}' (sin equivalente, campo vaciado)`);
    }
  }
  nota(`→ Valores vaciados por no tener equivalente: ${vaciados}`);

  // ── 6b. El subtipo de relación ahora depende del tipo ────────────────────
  // "Amigo" era un subtipo válido para cualquier relación; ahora cada tipo
  // tiene los suyos, así que las combinaciones imposibles se vacían.
  const rels = await tx`select id_rr, tipo_relacion, subtipo_relacion from relaciones
                        where subtipo_relacion is not null and subtipo_relacion <> ''`;
  for (const r of rels) {
    const [ok] = await tx`select 1 from catalogos
                          where campo = 'subtipo_relacion'
                            and grupo = ${r.tipo_relacion}
                            and valor = ${r.subtipo_relacion}
                          limit 1`;
    if (ok) continue;
    await tx`update relaciones set subtipo_relacion = null where id_rr = ${r.id_rr}`;
    aviso(
      `ELEGIR: relación #${r.id_rr} era '${r.tipo_relacion} / ${r.subtipo_relacion}'` +
        ` y ese subtipo ya no pertenece a ese tipo (campo vaciado)`,
    );
  }

  // ── 7. Casos con destino propio ──────────────────────────────────────────
  // "Ex Princesa" no es una ocupación de la lista sino un matiz: pasa al campo
  // de detalle, que existe justo para eso.
  const exOcup = await tx`select id, ocupacion from personajes
                          where ocupacion is not null and ocupacion <> ''
                            and ocupacion not in (select valor from catalogos where campo = 'ocupacion')`;
  for (const p of exOcup) {
    await tx`update personajes set ocupacion_detalle = ${p.ocupacion}, ocupacion = null where id = ${p.id}`;
    aviso(`ELEGIR: personaje #${p.id} tenía ocupación '${p.ocupacion}' → movida a 'detalle', elige la ocupación`);
  }
  if (exOcup.length) nota(`→ Ocupaciones movidas a detalle libre: ${exOcup.length}`);

  // "Fuego Verde" describe el poder del lord, no su dominio.
  const lords = await tx`select id, dominio, poder_especial from lord_demonio
                         where dominio is not null and dominio <> ''
                           and dominio not in ('Destrucción', 'Distorsión', 'Control', 'Aberración')`;
  for (const l of lords) {
    const poder = [l.poder_especial, l.dominio].filter(Boolean).join("\n\n");
    await tx`update lord_demonio set poder_especial = ${poder}, dominio = null where id = ${l.id}`;
    aviso(`ELEGIR: lord #${l.id} tenía dominio '${l.dominio}' → añadido a poder especial, elige el dominio`);
  }
  if (lords.length) nota(`→ Dominios movidos a poder especial: ${lords.length}`);

  // "Consolidacion_Economica" mezclaba de dónde viene la familia con dónde está.
  const fams = await tx`select id, origen from familias
                        where origen is not null and origen <> ''
                          and origen not in (select valor from catalogos where campo = 'familia_origen')`;
  for (const f of fams) {
    if (/econom/i.test(f.origen)) {
      await tx`update familias set origen = 'Mercante', estatus = 'Consolidada' where id = ${f.id}`;
      nota(`   familias #${f.id}: '${f.origen}' → origen 'Mercante' + estatus 'Consolidada'`);
    } else {
      await tx`update familias set origen = null where id = ${f.id}`;
      aviso(`ELEGIR: familia #${f.id} tenía origen '${f.origen}' (sin equivalente, campo vaciado)`);
    }
  }

  // "Conceptos Clave" no era una categoría: era una marca de destacado.
  const cps = await tx`select id from conceptos where categoria = 'Conceptos Clave'`;
  if (cps.length) {
    await tx`update conceptos set destacado = true, categoria = null where categoria = 'Conceptos Clave'`;
    nota(`→ Conceptos con 'Conceptos Clave': ${cps.length} marcados como destacados, categoría a elegir`);
    aviso(`ELEGIR: conceptos #${cps.map((c) => c.id).join(", ")} quedaron sin categoría (eran 'Conceptos Clave')`);
  }

  // La era del lord venía como texto ("-500 años"): se separa el año numérico.
  const eras = await tx`select id, era_aparicion from lord_demonio
                        where era_aparicion is not null and era_aparicion <> ''`;
  for (const e of eras) {
    const m = String(e.era_aparicion).match(/-?\d+/);
    if (m) {
      await tx`update lord_demonio set anio_lore = ${Number(m[0])} where id = ${e.id}`;
      nota(`   lord_demonio #${e.id}: era '${e.era_aparicion}' → año ${Number(m[0])}`);
    }
  }

  // La ubicación de una misión era texto suelto; si coincide con una ficha, se enlaza.
  const mis = await tx`select id, ubicacion from misiones where ubicacion is not null and ubicacion <> ''`;
  for (const m of mis) {
    const [nac] = await tx`select id from naciones where lower(nombre) = lower(${m.ubicacion}) limit 1`;
    if (nac) {
      await tx`update misiones set ubicacion_nacion_id = ${nac.id} where id = ${m.id}`;
      nota(`   misiones #${m.id}: ubicación '${m.ubicacion}' → enlazada a la nación #${nac.id}`);
      continue;
    }
    const [reg] = await tx`select id from regiones where lower(nombre) = lower(${m.ubicacion}) limit 1`;
    if (reg) {
      await tx`update misiones set ubicacion_region_id = ${reg.id} where id = ${m.id}`;
      nota(`   misiones #${m.id}: ubicación '${m.ubicacion}' → enlazada a la región #${reg.id}`);
      continue;
    }
    const [loc] = await tx`select id from locaciones where lower(nombre) = lower(${m.ubicacion}) limit 1`;
    if (loc) {
      await tx`update misiones set ubicacion_locacion_id = ${loc.id} where id = ${m.id}`;
      nota(`   misiones #${m.id}: ubicación '${m.ubicacion}' → enlazada a la locación #${loc.id}`);
    }
  }

  // ── 8. Columnas que se retiran ───────────────────────────────────────────
  for (const [t, c] of A_BORRAR) {
    if (!(await columnaExiste(tx, t, c))) continue;
    const [{ n }] = await tx.unsafe(`select count(*)::int as n from "${t}" where "${c}" is not null`);
    await tx.unsafe(`alter table "${t}" drop column "${c}"`);
    olvidarColumna(t, c);
    nota(`→ Retirada ${t}.${c} (tenía ${n} fila(s) con dato)`);
  }

  // ── 9. Claves foráneas de las referencias nuevas ─────────────────────────
  for (const [t, c, destino, accion] of FKS) {
    if (!(await columnaExiste(tx, t, c))) continue;
    const ya = await tx`select 1
                          from information_schema.table_constraints tc
                          join information_schema.key_column_usage kcu
                            on kcu.constraint_name = tc.constraint_name
                         where tc.constraint_type = 'FOREIGN KEY'
                           and tc.table_schema = 'public'
                           and tc.table_name = ${t}
                           and kcu.column_name = ${c}`;
    if (ya.length) continue;
    await tx.unsafe(
      `alter table "${t}" add constraint "${t}_${c}_fk"
       foreign key ("${c}") references "${destino}"(id) on delete ${accion}`,
    );
    await tx.unsafe(`create index if not exists "${t}_${c}_idx" on "${t}" ("${c}")`);
    nota(`→ FK ${t}.${c} → ${destino}.id (on delete ${accion})`);
  }
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
      if (e?.message !== CENTINELA) throw e;
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
