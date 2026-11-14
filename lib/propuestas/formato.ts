import { entidadesConMolde, moldeDe, rotuloDe, seccionCorta, type CampoMolde, type Molde } from "./moldes";
import { TITULO_ESTADISTICAS, listasDe, type ListaDef } from "./listas";
import { normalizar, type BloqueRaro, type DatoCrudo, type EstadoFicha, type FichaCruda, type PropuestaCruda, type Subcampo, type SueltoCrudo } from "./tipos";

/**
 * Lee un archivo de propuestas (docs/propuestas-formato.md) sin mirar la base: de
 * Markdown a datos sueltos, cada uno con sus líneas exactas para poder quitarlo
 * luego del archivo. Puro y client-safe. Lo que no entiende no se pierde: sale como
 * dato o bloque "desconocido" y se queda en el archivo hasta que el autor decida.
 */

const CANDADO = /\s*🔒\s*$/u;
const ESTRELLA = /\s*★(\s*importante)?\s*$/iu;
const OPCION_NUEVA = /\s*\(opci[oó]n nueva\)\s*$/i;
const ANADIR = /\s*\(a[nñ]adir\)\s*$/i;
const COMENTARIO = /^\s*<!--.*-->\s*$/;
const ESTADOS: string[] = ["borrador", "publicado", "oculto"];

const esBloque = (l: string) => /^##(?!#)\s/.test(l);
const esSeccion = (l: string) => /^###(?!#)\s/.test(l);

function datoBase(clase: DatoCrudo["clase"], raw: string, seccion: string | null, rotulo: string, valor: string): DatoCrudo {
  return { clase, raw, seccion, rotulo, valor, oculto: false, anadir: false, vaciar: false, opcionNueva: false, importante: false };
}

/** Quita el 🔒 del final y dice si lo llevaba. */
function sinCandado(t: string): [string, boolean] {
  return CANDADO.test(t) ? [t.replace(CANDADO, ""), true] : [t, false];
}

/**
 * Busca el campo de un rótulo. Algunos se repiten en una misma ficha ("Longevidad" es
 * un desplegable y un atributo en las razas). Con la sección detrás, «Longevidad
 * (Atributos)», no hay duda; sin ella, decide cómo viene escrito el valor.
 */
function campoPorRotulo(molde: Molde, rotulo: string, opts: { encabezado?: boolean; valor?: string } = {}): CampoMolde | undefined {
  const n = normalizar(rotulo);
  const posibles = molde.campos.filter((c) => normalizar(c.label) === n);
  if (!posibles.length) {
    // Un rótulo que ya lleva paréntesis propio («Valor (cantidad)») ha salido arriba.
    const conSeccion = rotulo.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
    if (!conSeccion) return undefined;
    const [base, sec] = [normalizar(conSeccion[1]), normalizar(conSeccion[2])];
    return molde.campos.find((c) => normalizar(c.label) === base && normalizar(seccionCorta(c.seccion)) === sec);
  }
  if (posibles.length === 1) return posibles[0];
  if (opts.encabezado) return posibles.find((c) => c.tipo === "largo") ?? posibles[0];
  const esNumero = /^-?\d+([.,]\d+)?$/.test((opts.valor ?? "").trim());
  return (esNumero ? posibles.find((c) => c.tipo === "numero") : posibles.find((c) => c.tipo !== "numero" && c.tipo !== "largo")) ?? posibles[0];
}

/** «Relación», «Título o apodo»: el rótulo de un dato empieza en mayúscula y es corto. */
const ROTULO_SUBCAMPO = /^\p{Lu}[^:]*$/u;
const esRotulo = (s: string) => ROTULO_SUBCAMPO.test(s) && s.split(/\s+/).length <= 4;

/**
 * El paréntesis de datos de una fila: "Rol: X; Rango: Y", o "sin ficha". Un trozo que no
 * empieza por «Rótulo:» sigue al dato anterior: así una descripción puede llevar «;».
 */
function leerSubcampos(interior: string): { subcampos: Subcampo[]; sinFicha: boolean } | null {
  const subcampos: Subcampo[] = [];
  let sinFicha = false;
  for (const parte of interior.split(/;\s*/)) {
    const t = parte.trim();
    if (!t) continue;
    if (normalizar(t) === "sin ficha") {
      sinFicha = true;
      continue;
    }
    const i = t.indexOf(":");
    const rotulo = i > 0 ? t.slice(0, i).trim() : "";
    if (!esRotulo(rotulo)) {
      const previo = subcampos.at(-1);
      if (!previo) return null;
      previo.valor = `${previo.valor}; ${t}`;
      continue;
    }
    subcampos.push({ label: rotulo, valor: t.slice(i + 1).replace(OPCION_NUEVA, "").trim() });
  }
  return subcampos.length || sinFicha ? { subcampos, sinFicha } : null;
}

export interface FilaLeida {
  nombre: string;
  idFicha?: number;
  sinFicha: boolean;
  subcampos: Subcampo[];
  texto: string;
}

/** "Kael Varn #45 (Relación: Rival; Matiz: X): texto". El nombre puede llevar paréntesis propios. */
export function leerFila(linea: string, conTexto = false): FilaLeida {
  const t = linea.trim();
  let nombre = t;
  let texto = "";
  let subcampos: Subcampo[] = [];
  let sinFicha = false;
  let encontrado = false;

  for (let i = t.indexOf("("); i >= 0 && !encontrado; i = t.indexOf("(", i + 1)) {
    let prof = 0;
    let fin = -1;
    for (let j = i; j < t.length; j++) {
      if (t[j] === "(") prof++;
      if (t[j] === ")" && --prof === 0) {
        fin = j;
        break;
      }
    }
    if (fin < 0) break;
    const resto = t.slice(fin + 1).trim();
    if (resto && !resto.startsWith(":") && !/^\[[^\]]*\]$/.test(resto)) continue;
    const datos = leerSubcampos(t.slice(i + 1, fin));
    if (!datos) continue;
    encontrado = true;
    nombre = t.slice(0, i).trim();
    subcampos = datos.subcampos;
    sinFicha = datos.sinFicha;
    if (resto.startsWith(":")) texto = resto.slice(1).trim();
  }

  if (!encontrado && conTexto) {
    const i = t.indexOf(": ");
    if (i > 0) {
      nombre = t.slice(0, i).trim();
      texto = t.slice(i + 2).trim();
    }
  }

  // `pnpm lore ficha` escribe el estado de la otra ficha detrás: "Kael [borrador]".
  nombre = nombre.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
  const conId = nombre.match(/^(.*?)\s*#(\d+)$/);
  return { nombre: conId ? conId[1].trim() : nombre, idFicha: conId ? Number(conId[2]) : undefined, sinFicha, subcampos, texto };
}

function entidadDeTipo(tipo: string): string | null {
  const n = normalizar(tipo);
  return entidadesConMolde().find((e) => e === n || normalizar(moldeDe(e)!.singular) === n) ?? null;
}

/** Una línea de un campo: "- Rótulo: valor", antes de la primera sección o suelta. */
function datoDeLinea(molde: Molde, linea: string, seccion: string | null): DatoCrudo {
  const m = linea.match(/^-\s+(.+?):\s*(.*)$/);
  if (!m) return datoBase("desconocido", linea, seccion, "Línea sin entender", linea);
  const [conCandado, oculto] = sinCandado(m[2]);
  const opcionNueva = OPCION_NUEVA.test(conCandado);
  const valor = conCandado.replace(OPCION_NUEVA, "").trim();
  const campo = campoPorRotulo(molde, m[1], { valor });
  if (!campo) return datoBase("desconocido", linea, seccion, m[1], valor);
  const d = datoBase("campo", linea, seccion, rotuloDe(molde, campo), valor);
  d.campo = campo.name;
  d.oculto = oculto;
  d.opcionNueva = opcionNueva;
  d.vaciar = normalizar(valor) === "(vaciar)";
  return d;
}

/** "- Miembros: Kael (Rol: X) 🔒" o "- quitar Miembros: Kael". */
function datoDeConexion(linea: string, seccion: string | null): DatoCrudo {
  const m = linea.match(/^-\s+(quitar\s+)?(.+?):\s+(.+)$/);
  if (!m) return datoBase("desconocido", linea, seccion, "Conexión sin entender", linea);
  const [resto, oculto] = sinCandado(m[3]);
  const fila = leerFila(resto);
  const d = datoBase(m[1] ? "quitar" : "conexion", linea, seccion, m[2].trim(), resto);
  d.oculto = oculto;
  d.nombre = fila.nombre;
  d.idFicha = fila.idFicha;
  d.sinFicha = fila.sinFicha;
  d.subcampos = fila.subcampos;
  return d;
}

/** "- Nacimiento: Año -34 ★ 🔒". */
function datoDeFecha(linea: string, seccion: string | null): DatoCrudo {
  const m = linea.match(/^-\s+(.+?):\s*(.*)$/);
  if (!m) return datoBase("desconocido", linea, seccion, "Fecha sin entender", linea);
  const [conCandado, oculto] = sinCandado(m[2]);
  const importante = ESTRELLA.test(conCandado);
  const valor = conCandado.replace(ESTRELLA, "").trim();
  const d = datoBase("fecha", linea, seccion, m[1].trim(), valor);
  d.oculto = oculto;
  d.importante = importante;
  d.vaciar = normalizar(valor) === "(vaciar)";
  return d;
}

/** "- Nombre (Campo: valor): texto 🔒" dentro de una lista, o "- quitar Nombre". */
function datoDeLista(def: ListaDef, linea: string, seccion: string | null): DatoCrudo {
  const m = linea.match(/^-\s+(quitar\s+)?(.*)$/);
  if (!m) return datoBase("desconocido", linea, seccion, "Línea sin entender", linea);
  const [resto, oculto] = sinCandado(m[2]);
  const fila = leerFila(resto, Boolean(def.texto));
  const d = datoBase(m[1] ? "quitar-lista" : "lista", linea, seccion, def.titulo, fila.texto);
  d.oculto = oculto;
  d.lista = def.clase;
  d.nombre = fila.nombre;
  d.idFicha = fila.idFicha;
  d.sinFicha = fila.sinFicha;
  d.subcampos = fila.subcampos;
  return d;
}

function leerFicha(cabecera: string, lineas: string[], raw: string): FichaCruda | BloqueRaro {
  let t = cabecera.replace(/^##\s+/, "").trim();
  const conModo = t.match(/^(.*\S)\s+·\s+([^·]*)$/);
  if (conModo) t = conModo[1];
  const m = t.match(/^(.+?)(?:\s+#(\d+))?:\s*(.+)$/);
  if (!m) return { raw, motivo: "No se entiende la cabecera: debería ser «## Tipo: Nombre · nueva» o «## Tipo #id: Nombre · cambios»." };
  const entidad = entidadDeTipo(m[1]);
  if (!entidad) return { raw, motivo: `No hay ningún tipo de ficha llamado «${m[1]}».` };
  const molde = moldeDe(entidad)!;
  const ficha: FichaCruda = {
    raw,
    tipo: m[1],
    entidad,
    id: m[2] ? Number(m[2]) : null,
    nombre: m[3].trim(),
    modo: m[2] ? "cambios" : "nueva",
    estado: null,
    datos: [],
  };

  const listas = listasDe(entidad);
  // Con `as`: se reasignan dentro de `abrirSeccion`, y TS no lo ve desde el bucle de abajo.
  let seccion = null as string | null;
  let tipoSeccion = "simple" as "simple" | "conexiones" | "fechas" | "estadisticas" | "lista" | "bloque";
  let lista = undefined as ListaDef | undefined;
  let cuerpo: string[] = [];
  /** El dato que se está llenando con las líneas de un encabezado. */
  let abierto = null as DatoCrudo | null;

  const cerrar = () => {
    if (!abierto) return;
    // Los comentarios de línea no son contenido (`pnpm lore ficha` los deja al final).
    const texto = cuerpo.filter((l) => !COMENTARIO.test(l));
    while (texto.length && !texto[texto.length - 1].trim()) texto.pop();
    while (texto.length && !texto[0].trim()) texto.shift();
    const crudas = [...cuerpo];
    while (crudas.length && (!crudas[crudas.length - 1].trim() || COMENTARIO.test(crudas[crudas.length - 1]))) crudas.pop();
    abierto.raw = [abierto.raw, ...crudas].join("\n");
    abierto.valor = texto.join("\n");
    ficha.datos.push(abierto);
    abierto = null;
    cuerpo = [];
  };

  const abrirSeccion = (linea: string) => {
    cerrar();
    seccion = linea;
    lista = undefined;
    const [titulo, oculto] = sinCandado(linea.replace(/^###\s+/, "").trim());
    const n = normalizar(titulo);

    if (n === "conexiones") return void (tipoSeccion = "conexiones");
    if (n === "fechas") return void (tipoSeccion = "fechas");

    const deLista = listas.find((l) => normalizar(l.titulo) === n);
    if (deLista && deLista.clase !== "secciones") {
      tipoSeccion = "lista";
      lista = deLista;
      return;
    }

    tipoSeccion = "bloque";
    if (n === "notas de autor") {
      abierto = datoBase("nota", linea, null, "Notas de autor", "");
      return;
    }
    if (n.startsWith(normalizar(TITULO_ESTADISTICAS))) {
      tipoSeccion = "estadisticas";
      abierto = datoBase("estadisticas", linea, null, TITULO_ESTADISTICAS, "");
      abierto.oculto = oculto;
      abierto.subcampos = [];
      return;
    }
    const sec = titulo.match(/^secci[oó]n:\s*(.+)$/i);
    const defSec = listas.find((l) => l.clase === "secciones");
    if (sec && defSec) {
      const fila = leerFila(sec[1]);
      abierto = datoBase("lista", linea, null, defSec.titulo, "");
      abierto.lista = "secciones";
      abierto.nombre = fila.nombre;
      abierto.subcampos = fila.subcampos;
      abierto.oculto = oculto;
      return;
    }
    const anadir = ANADIR.test(titulo);
    const rotulo = titulo.replace(ANADIR, "").trim();
    const campo = campoPorRotulo(molde, rotulo, { encabezado: true });
    abierto = datoBase(campo ? "campo" : "desconocido", linea, null, campo ? rotuloDe(molde, campo) : rotulo, "");
    abierto.campo = campo?.name;
    abierto.oculto = oculto;
    abierto.anadir = anadir;
  };

  for (const linea of lineas) {
    if (esSeccion(linea)) {
      abrirSeccion(linea);
      continue;
    }
    if (tipoSeccion === "bloque") {
      cuerpo.push(linea);
      continue;
    }
    if (!linea.trim() || COMENTARIO.test(linea)) continue;

    if (tipoSeccion === "simple") {
      const quitarSeccion = linea.match(/^-\s+quitar\s+secci[oó]n:\s*(.+)$/i);
      const defSeccion = listas.find((l) => l.clase === "secciones");
      if (quitarSeccion && defSeccion) {
        const d = datoBase("quitar-lista", linea, null, defSeccion.titulo, "");
        d.lista = "secciones";
        d.nombre = quitarSeccion[1].trim();
        ficha.datos.push(d);
        continue;
      }
      const estado = linea.match(/^-\s+estado:\s*(.+?)\s*$/i);
      if (estado && ESTADOS.includes(normalizar(estado[1]))) ficha.estado = normalizar(estado[1]) as EstadoFicha;
      else ficha.datos.push(datoDeLinea(molde, linea, null));
    } else if (tipoSeccion === "conexiones") {
      ficha.datos.push(datoDeConexion(linea, seccion));
    } else if (tipoSeccion === "fechas") {
      ficha.datos.push(datoDeFecha(linea, seccion));
    } else if (tipoSeccion === "lista" && lista) {
      ficha.datos.push(datoDeLista(lista, linea, seccion));
    } else if (tipoSeccion === "estadisticas" && abierto) {
      const m2 = linea.match(/^-\s+(.+?):\s*(.*)$/);
      if (m2) abierto.subcampos!.push({ label: m2[1].trim(), valor: m2[2].trim() });
      cuerpo.push(linea);
    }
  }
  cerrar();
  return ficha;
}

export function leerPropuesta(texto: string): PropuestaCruda {
  const lineas = texto.replace(/\r\n?/g, "\n").split("\n");
  const inicios = lineas.flatMap((l, i) => (esBloque(l) ? [i] : []));
  const fichas: FichaCruda[] = [];
  const sueltos: SueltoCrudo[] = [];
  const raros: BloqueRaro[] = [];

  inicios.forEach((ini, n) => {
    let fin = inicios[n + 1] ?? lineas.length;
    // Lo que queda entre dos bloques (el comentario de procedencia) no es de ninguno.
    while (fin > ini + 1 && (!lineas[fin - 1].trim() || COMENTARIO.test(lineas[fin - 1]))) fin--;
    const raw = lineas.slice(ini, fin).join("\n");
    const cuerpo = lineas.slice(ini + 1, fin);

    const suelto = lineas[ini].match(/^##\s+suelto:\s*(.+)$/i);
    if (suelto) {
      sueltos.push({ raw, titulo: suelto[1].trim(), texto: cuerpo.join("\n").trim() });
      return;
    }
    const ficha = leerFicha(lineas[ini], cuerpo, raw);
    if ("motivo" in ficha) raros.push(ficha);
    else fichas.push(ficha);
  });

  return { fichas, sueltos, raros };
}
