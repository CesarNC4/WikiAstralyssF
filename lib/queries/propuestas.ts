import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { getEntidadConfig } from "@/lib/admin/fields";
import { getEntidadTable } from "@/lib/admin/tables";
import { rolesDe } from "@/lib/fechas/roles";
import { textosFecha } from "@/lib/fechas/formato";
import { leerFecha } from "@/lib/fechas/leer";
import type { Calendario } from "@/lib/fechas/tipos";
import { getCalendario, leerFechasDe } from "@/lib/queries/fechas";
import { contarFragmentosConFecha } from "@/lib/queries/narrativa";
import { camposOcultos } from "@/lib/queries/visibilidad";
import { leerPropuesta } from "@/lib/propuestas/formato";
import { ESTADISTICAS, EXTRAS_JERARQUIA, listasDe, type CampoLista, type ListaDef } from "@/lib/propuestas/listas";
import { cols, extrasDeMiembros, leerLista, type FilaLista } from "@/lib/propuestas/listasDb";
import { moldeDe } from "@/lib/propuestas/moldes";
import {
  hashTexto,
  normalizar,
  type Analisis,
  type Candidato,
  type DatoAnalizado,
  type DatoCrudo,
  type FichaAnalizada,
  type FichaCruda,
  type Objetivo,
  type OpcionCatalogo,
  type SubcampoAnalizado,
} from "@/lib/propuestas/tipos";
import { leerFilas } from "@/lib/relaciones/consultas";
import { bloquesDe, CUALQUIERA } from "@/lib/relaciones/registro";
import { ENTIDAD_INFO, infoDe, tablaDe as tablaDeRelacion } from "@/lib/relaciones/tablas";
import type { BloqueRelacion, FilaVinculo } from "@/lib/relaciones/tipos";
import { OCULTOS_POR_DEFECTO } from "@/lib/visibilidad";

/**
 * Analiza los archivos de propuestas contra la base (docs/area-ia.md, Fase 5): a qué
 * ficha apunta cada nombre, qué hay ahora frente a lo propuesto y qué falta por
 * resolver. Solo lee. Lo que no se entiende se queda como "desconocido", en el archivo.
 */

export function tablaEntidad(entidad: string) {
  return ENTIDAD_INFO[entidad]?.tabla ?? getEntidadTable(entidad);
}

/** `RefTarget` del admin a entidad del registro: las monedas son `economia`. */
export function entidadDeRef(ref: string | undefined): string | null {
  if (!ref) return null;
  return ref === "monedas" ? "economia" : ref;
}

export function textoDeValor(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

interface Entrada extends Candidato {
  nombres: string[];
}

/** Los nombres de cada entidad, cargados una vez por análisis. */
export class Directorio {
  private cache = new Map<string, Promise<Entrada[]>>();

  entradas(entidad: string): Promise<Entrada[]> {
    if (!this.cache.has(entidad)) this.cache.set(entidad, this.cargar(entidad));
    return this.cache.get(entidad)!;
  }

  private async cargar(entidad: string): Promise<Entrada[]> {
    const tabla = tablaEntidad(entidad);
    if (!tabla) return [];
    const c = cols(tabla);
    const info = infoDe(entidad);
    const nombreCol = moldeDe(entidad)?.nombre ?? info?.label ?? "nombre";
    if (!c[nombreCol]) return [];
    const sel: Record<string, (typeof c)[string]> = { id: c.id, nombre: c[nombreCol] };
    if (info?.detalle && c[info.detalle]) sel.detalle = c[info.detalle];
    if (c.estadoPublicacion) sel.estado = c.estadoPublicacion;
    if (c.surname) sel.surname = c.surname;
    const filas = (await db.select(sel).from(tabla).where(c.eliminadoEn ? isNull(c.eliminadoEn) : undefined).orderBy(asc(c[nombreCol]))) as Record<string, unknown>[];
    return filas.map((f) => {
      const nombre = String(f.nombre ?? "");
      return {
        id: Number(f.id),
        entidad,
        label: nombre,
        detalle: f.detalle == null ? null : String(f.detalle),
        estado: f.estado == null ? null : String(f.estado),
        // Un personaje se puede citar por su nombre o por su nombre y apellido.
        nombres: [normalizar(nombre), ...(f.surname ? [normalizar(`${nombre} ${f.surname}`)] : [])],
      };
    });
  }

  async porId(entidad: string, id: number): Promise<Candidato | null> {
    return (await this.entradas(entidad)).find((e) => e.id === id) ?? null;
  }

  /** Las que se llaman exactamente así y, si no hay, las que se parecen. */
  async buscar(entidad: string, nombre: string): Promise<{ exactas: Candidato[]; parecidas: Candidato[] }> {
    const n = normalizar(nombre);
    const entradas = entidad === CUALQUIERA ? (await Promise.all(Object.keys(ENTIDAD_INFO).map((e) => this.entradas(e)))).flat() : await this.entradas(entidad);
    const exactas = entradas.filter((e) => e.nombres.includes(n));
    const parecidas = exactas.length || n.length < 3 ? [] : entradas.filter((e) => e.nombres.some((x) => x.includes(n) || (x.length >= 3 && n.includes(x)))).slice(0, 8);
    return { exactas: exactas.map(sinNombres), parecidas: parecidas.map(sinNombres) };
  }
}

function sinNombres({ id, entidad, label, detalle, estado }: Entrada): Candidato {
  return { id, entidad, label, detalle, estado };
}

/** "personajes Alhaitham" en un bloque que admite cualquier ficha. */
function separarTipo(nombre: string): { entidad: string | null; nombre: string } {
  const i = nombre.indexOf(" ");
  if (i < 0) return { entidad: null, nombre };
  const tipo = normalizar(nombre.slice(0, i));
  const entidad = Object.keys(ENTIDAD_INFO).find((e) => e === tipo || normalizar(moldeDe(e)?.singular ?? "") === tipo);
  return entidad ? { entidad, nombre: nombre.slice(i + 1).trim() } : { entidad: null, nombre };
}

interface Ctx {
  dir: Directorio;
  nuevas: Set<string>;
  cal: Calendario;
  catalogos: Record<string, OpcionCatalogo[]>;
  destinos: Record<string, number | "crear">;
}

async function buscarObjetivo(
  ctx: Ctx,
  entidad: string,
  escrito: string,
  { idFicha, sinFicha = false, admiteSinFicha = false, sinFichaSiNoHay = false, crearSiNoHay = false }: { idFicha?: number; sinFicha?: boolean; admiteSinFicha?: boolean; sinFichaSiNoHay?: boolean; crearSiNoHay?: boolean } = {},
): Promise<Objetivo> {
  const tipado = entidad === CUALQUIERA ? separarTipo(escrito) : { entidad: null, nombre: escrito };
  const buscaEn = tipado.entidad ?? entidad;
  const nombre = tipado.nombre;
  const base: Objetivo = { entidad, nombre, id: null, entidadElegida: tipado.entidad, label: null, estado: null, candidatos: [], crear: false, sinFicha, admiteSinFicha, enPropuesta: false };
  if (sinFicha) return base;

  const elegir = (c: Candidato): Objetivo => ({ ...base, id: c.id, entidadElegida: c.entidad, label: c.label, estado: c.estado });

  if (idFicha != null && buscaEn !== CUALQUIERA) {
    const c = await ctx.dir.porId(buscaEn, idFicha);
    if (c) return elegir(c);
  }
  if (!nombre.trim()) return base;
  const { exactas, parecidas } = await ctx.dir.buscar(buscaEn, nombre);
  if (exactas.length === 1) return elegir(exactas[0]);
  if (exactas.length > 1) return { ...base, candidatos: exactas };
  if (ctx.nuevas.has(`${buscaEn}|${normalizar(nombre)}`)) return { ...base, crear: true, enPropuesta: true };
  return { ...base, candidatos: parecidas, sinFicha: sinFichaSiNoHay && !parecidas.length, crear: crearSiNoHay && !parecidas.length };
}

function etiquetaOpcionFija(entidad: string, campo: string, valor: string): string {
  return getEntidadConfig(entidad)?.fields.find((f) => f.name === campo)?.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

function iguales(a: string | null, b: string): boolean {
  return (a ?? "").replace(/\r\n/g, "\n").trim() === b.replace(/\r\n/g, "\n").trim();
}

/** Que el valor exista en su catálogo, para avisar si no. */
function fueraDeCatalogo(ctx: Ctx, catalogo: string | undefined, valor: string): boolean {
  if (!catalogo || !valor) return false;
  return !(ctx.catalogos[catalogo] ?? []).some((o) => normalizar(o.valor) === normalizar(valor));
}

interface Leido {
  entidad: string;
  id: number | null;
  fila: Record<string, unknown> | null;
  ocultos: Set<string>;
  nota: string;
  filas: Map<string, Promise<FilaVinculo[]>>;
  listas: Map<string, Promise<FilaLista[]>>;
}

function datoComun(d: DatoCrudo): Omit<DatoAnalizado, "clave" | "decision" | "igual" | "actual" | "ocultable" | "aNotas"> {
  return { clase: d.clase, raw: d.raw, seccion: d.seccion, rotulo: d.rotulo, valor: d.valor, anadir: d.anadir, vaciar: d.vaciar, aviso: null };
}

function decisionPorDefecto(igual: boolean, ocultar: boolean): DatoAnalizado["decision"] {
  if (igual) return "descartar";
  return ocultar ? "oculto" : "visible";
}

async function analizarCampo(ctx: Ctx, l: Leido, d: DatoCrudo): Promise<DatoAnalizado> {
  const molde = moldeDe(l.entidad)!;
  const c = molde.campos.find((x) => x.name === d.campo)!;
  const bruto = l.fila?.[c.name];
  const ocultoAhora = l.id ? l.ocultos.has(c.name) : (OCULTOS_POR_DEFECTO[l.entidad] ?? []).includes(c.name);
  const esNombre = c.name === molde.nombre || c.name === "slug";
  const ocultable = !esNombre;

  let actual: string | null = textoDeValor(bruto) || null;
  if (actual && c.opciones) actual = etiquetaOpcionFija(l.entidad, c.name, actual);
  let objetivo: Objetivo | undefined;
  if (c.tipo === "ficha") {
    const ref = entidadDeRef(c.ref)!;
    if (bruto != null) actual = (await ctx.dir.porId(ref, Number(bruto)))?.label ?? `#${bruto}`;
    if (!d.vaciar) objetivo = await buscarObjetivo(ctx, ref, d.valor);
  }

  const valor = d.vaciar ? "" : d.valor;
  const mismoValor = d.vaciar
    ? actual == null
    : d.anadir
      ? (actual ?? "").includes(valor.trim())
      : c.tipo === "numero"
        ? actual != null && Number(actual.replace(",", ".")) === Number(valor.replace(",", "."))
        : c.tipo === "opcion"
          ? normalizar(actual ?? "") === normalizar(valor)
          : iguales(actual, valor);
  const quiereOculto = d.oculto || ocultoAhora;
  const igual = mismoValor && quiereOculto === ocultoAhora;

  let aviso: string | null = null;
  if (d.opcionNueva) aviso = "Opción nueva: se añade al catálogo al aplicar.";
  else if (c.tipo === "opcion" && fueraDeCatalogo(ctx, c.catalogo, valor)) aviso = "No está en el catálogo: se añadirá al aplicar, o elige otra.";
  else if (c.tipo === "lista" && valor.split(",").some((v) => fueraDeCatalogo(ctx, c.catalogo, v.trim()))) aviso = "Alguna opción no está en el catálogo: se añadirá al aplicar.";
  if (c.catalogo === "elementos" && aviso) aviso = "Ese elemento no existe: créalo antes en Elementos, o elige otro.";

  return {
    ...datoComun(d),
    clave: "",
    valor,
    campo: c.name,
    editor: c.tipo,
    catalogo: c.catalogo,
    opciones: c.opciones,
    actual,
    igual,
    decision: decisionPorDefecto(igual, ocultable && quiereOculto),
    ocultable,
    aNotas: !esNombre,
    aviso,
    objetivo,
  };
}

function subcamposDe(defs: CampoLista[], d: DatoCrudo, actuales: Record<string, string> | null): { subcampos: SubcampoAnalizado[]; aviso: string | null } {
  const conocidos = new Set(defs.map((c) => normalizar(c.label)));
  const desconocidos = (d.subcampos ?? []).filter((s) => !conocidos.has(normalizar(s.label))).map((s) => s.label);
  const subcampos = defs.map((c) => ({
    ...c,
    valor: d.subcampos?.find((s) => normalizar(s.label) === normalizar(c.label))?.valor ?? "",
    actual: actuales?.[c.name] ?? null,
  }));
  return { subcampos, aviso: desconocidos.length ? `No se reconoce: ${desconocidos.join(", ")}. Se ignora al aplicar.` : null };
}

/** Lo que vale para comparar: solo los subcampos que la propuesta rellena. */
const mismosSubcampos = (subs: SubcampoAnalizado[]) => subs.every((s) => !s.valor || iguales(s.actual, s.valor));

const resumenSubcampos = (subs: { label: string; actual: string | null }[]) =>
  subs.filter((s) => s.actual).map((s) => `${s.label}: ${s.actual}`).join(" · ");

function bloqueDeConexion(entidad: string, titulo: string): BloqueRelacion | undefined {
  const n = normalizar(titulo);
  return bloquesDe(entidad).find((b) => normalizar(b.titulo) === n);
}

function camposDeBloque(b: BloqueRelacion): CampoLista[] {
  return [
    ...b.campos.map((c): CampoLista => ({ name: c.name, label: c.label, tipo: c.tipo === "select" ? "opcion" : "corto", catalogo: c.catalogo, opciones: c.tipo === "checkbox" ? ["sí", "no"] : c.opciones })),
    ...(EXTRAS_JERARQUIA[b.relId] ?? []),
  ];
}

async function analizarConexion(ctx: Ctx, l: Leido, d: DatoCrudo): Promise<DatoAnalizado> {
  const b = bloqueDeConexion(l.entidad, d.rotulo);
  if (!b) {
    return {
      ...datoComun(d),
      clase: "desconocido",
      clave: "",
      valor: d.raw,
      actual: null,
      igual: false,
      decision: "luego",
      ocultable: false,
      aNotas: true,
      aviso: `Esta ficha no tiene ninguna conexión llamada «${d.rotulo}».`,
      editor: "texto",
    };
  }
  const admiteSinFicha = b.lado === "a" && Boolean(tablaDeRelacion(b.relId)?.colLibre);
  const objetivo = await buscarObjetivo(ctx, b.objetivo, d.nombre ?? "", { idFicha: d.idFicha, sinFicha: d.sinFicha && admiteSinFicha, admiteSinFicha });

  let filas: FilaVinculo[] = [];
  if (l.id) {
    const k = `${b.relId}:${b.lado}`;
    if (!l.filas.has(k)) l.filas.set(k, leerFilas(b.relId, b.lado, l.id));
    filas = await l.filas.get(k)!;
  }
  const mismaFila = (f: FilaVinculo) =>
    objetivo.sinFicha ? normalizar(f.label) === normalizar(d.nombre ?? "") && f.objetivoId === 0 : objetivo.id != null && f.objetivoId === objetivo.id && (!objetivo.entidadElegida || !f.objetivoTipo || f.objetivoTipo === objetivo.entidadElegida);
  const fila = filas.find(mismaFila) ?? null;

  if (d.clase === "quitar") {
    return {
      ...datoComun(d),
      clave: "",
      relId: b.relId,
      lado: b.lado,
      filaId: fila?.id ?? null,
      objetivo,
      actual: fila ? fila.label : null,
      igual: !fila,
      decision: fila ? "visible" : "descartar",
      ocultable: false,
      aNotas: false,
      aviso: fila ? null : "Esa conexión ya no existe: no hay nada que quitar.",
      editor: "fila",
    };
  }

  // Rango, facción y apodo no están en la fila genérica: viven en la tabla del grupo.
  const defs = camposDeBloque(b);
  let extras: Record<string, string> = {};
  if (fila && EXTRAS_JERARQUIA[b.relId]) {
    const grupoId = b.lado === "a" ? l.id! : objetivo.id!;
    extras = (await extrasDeMiembros(b.relId, grupoId)).get(fila.id) ?? {};
  }
  const { subcampos, aviso } = subcamposDe(defs, d, fila ? { ...fila.campos, ...extras } : null);
  // Una referencia apunta a una sola ficha: lo que hay ahora es lo que va a sustituir.
  const unica = b.unico && !fila ? (filas[0] ?? null) : null;
  const igual = Boolean(fila) && mismosSubcampos(subcampos) && (d.oculto || Boolean(fila?.oculto)) === Boolean(fila?.oculto);

  const avisos = [aviso];
  for (const s of subcampos) if (s.tipo === "opcion" && fueraDeCatalogo(ctx, s.catalogo, s.valor)) avisos.push(`«${s.valor}» no está en el catálogo de ${s.label}: se añadirá al aplicar.`);
  if (objetivo.enPropuesta) avisos.push("Es una ficha nueva de esta propuesta: se conecta al aplicar (como borrador si aún no existe).");
  if (unica) avisos.push(`Sustituye a ${unica.label}: esta conexión admite una sola ficha.`);

  return {
    ...datoComun(d),
    clave: "",
    valor: "",
    relId: b.relId,
    lado: b.lado,
    filaId: fila?.id ?? null,
    modoFila: "actualizar",
    objetivo,
    subcampos,
    actual: fila ? [fila.label, resumenSubcampos(subcampos)].filter(Boolean).join(" · ") : (unica?.label ?? null),
    igual,
    decision: decisionPorDefecto(igual, d.oculto || Boolean(fila?.oculto)),
    ocultable: true,
    aNotas: true,
    aviso: avisos.filter(Boolean).join(" ") || null,
    editor: "fila",
  };
}

async function analizarFecha(ctx: Ctx, l: Leido, d: DatoCrudo): Promise<DatoAnalizado> {
  const rol = rolesDe(l.entidad).find((r) => normalizar(r.etiqueta) === normalizar(d.rotulo));
  if (!rol) {
    return { ...datoComun(d), clase: "desconocido", clave: "", valor: d.raw, actual: null, igual: false, decision: "luego", ocultable: false, aNotas: true, aviso: `Esta ficha no tiene ninguna fecha llamada «${d.rotulo}».`, editor: "texto" };
  }
  const fechas = l.id ? await leerFechasDe(l.entidad, l.id) : {};
  const guardada = fechas[rol.rol];
  const actual = guardada ? textosFecha(ctx.cal, guardada.fecha).eras : null;
  const propuesta = d.vaciar ? null : leerFecha(ctx.cal, d.valor);
  const textoPropuesto = propuesta ? textosFecha(ctx.cal, propuesta).eras : d.valor;
  const quiereOculto = d.oculto || Boolean(guardada?.oculto);
  const igual = d.vaciar ? !guardada : Boolean(guardada) && actual === textoPropuesto && Boolean(guardada?.importante) === d.importante && quiereOculto === Boolean(guardada?.oculto);
  const calculada = l.entidad === "actos" && l.id ? (await contarFragmentosConFecha(db, l.id)) > 0 : false;
  return {
    ...datoComun(d),
    clave: "",
    rol: rol.rol,
    importante: d.importante,
    actual,
    igual,
    decision: decisionPorDefecto(igual, quiereOculto),
    ocultable: true,
    aNotas: !d.vaciar,
    aviso: calculada ? "La fecha de este acto se calcula de sus fragmentos: esta no se guardará." : null,
    editor: "fecha",
  };
}

async function analizarLista(ctx: Ctx, l: Leido, d: DatoCrudo): Promise<DatoAnalizado> {
  const def = listasDe(l.entidad).find((x) => x.clase === d.lista) as ListaDef;
  const nombre = d.nombre ?? "";
  let filas: FilaLista[] = [];
  if (l.id) {
    if (!l.listas.has(def.clase)) l.listas.set(def.clase, leerLista(l.entidad, def.clase, l.id));
    filas = await l.listas.get(def.clase)!;
  }

  // El POV de un fragmento es la ficha a la que apunta; el título, su nombre.
  const povEscrito = def.clase === "fragmentos" ? d.subcampos?.find((s) => normalizar(s.label) === "pov")?.valor : undefined;
  let objetivo: Objetivo | undefined;
  if (def.clase === "fragmentos") {
    if (povEscrito) objetivo = await buscarObjetivo(ctx, "personajes", povEscrito);
  } else if (def.objetivo && nombre) {
    objetivo = await buscarObjetivo(ctx, def.objetivo, nombre, {
      idFicha: d.idFicha,
      sinFicha: d.sinFicha,
      admiteSinFicha: def.clase !== "habilidades",
      // Una habilidad sin magia que la respalde se crea como magia en borrador, igual
      // que en el formulario del personaje. Una persona sin ficha es un nombre suelto.
      sinFichaSiNoHay: def.clase !== "habilidades",
      crearSiNoHay: def.clase === "habilidades",
    });
  }

  const fila =
    filas.find((f) =>
      def.clase === "fragmentos"
        ? nombre
          ? normalizar(f.nombre) === normalizar(nombre)
          : !f.nombre && normalizar(f.valores.pov ?? "") === normalizar(povEscrito ?? "")
        : normalizar(f.nombre) === normalizar(nombre),
    ) ?? null;

  if (d.clase === "quitar-lista") {
    return {
      ...datoComun(d),
      clave: "",
      lista: def.clase,
      nombre,
      filaId: fila?.id ?? null,
      actual: fila ? fila.nombre : null,
      igual: !fila,
      decision: fila ? "visible" : "descartar",
      ocultable: false,
      aNotas: false,
      aviso: fila ? null : "Esa fila ya no existe: no hay nada que quitar.",
      editor: "fila",
    };
  }

  const { subcampos, aviso } = subcamposDe(def.campos, d, fila?.valores ?? null);
  const quiereOculto = def.ocultable && (d.oculto || Boolean(fila?.oculto));
  const igual = Boolean(fila) && mismosSubcampos(subcampos) && (!def.texto || !d.valor || iguales(fila?.texto ?? null, d.valor)) && quiereOculto === Boolean(fila?.oculto);
  const resumen = fila ? [resumenSubcampos(subcampos), def.texto ? fila.texto : null].filter(Boolean).join("\n") : null;

  const avisos = [aviso];
  for (const s of subcampos) if (s.tipo === "opcion" && fueraDeCatalogo(ctx, s.catalogo, s.valor)) avisos.push(`«${s.valor}» no está en el catálogo de ${s.label}: se añadirá al aplicar.`);
  if (def.clase === "habilidades" && objetivo?.crear) avisos.push("No hay ninguna magia con ese nombre: se crea en borrador al aplicar.");
  if (def.clase === "fragmentos" && d.subcampos?.some((s) => normalizar(s.label) === "fecha" && s.valor && !leerFecha(ctx.cal, s.valor))) avisos.push("No se entiende la fecha de este fragmento.");

  return {
    ...datoComun(d),
    clave: "",
    lista: def.clase,
    nombre,
    filaId: fila?.id ?? null,
    objetivo,
    subcampos: subcampos.filter((s) => s.name !== "pov"),
    actual: fila ? resumen || fila.nombre : null,
    igual,
    decision: decisionPorDefecto(igual, quiereOculto),
    ocultable: def.ocultable,
    aNotas: true,
    aviso: avisos.filter(Boolean).join(" ") || null,
    editor: "fila",
  };
}

async function analizarEstadisticas(l: Leido, d: DatoCrudo): Promise<DatoAnalizado> {
  const [fila] = l.id ? await db.select().from(s.estadisticas).where(eq(s.estadisticas.personajeId, l.id)).limit(1) : [];
  const actuales = fila ? Object.fromEntries(ESTADISTICAS.map((e) => [e.name, textoDeValor((fila as Record<string, unknown>)[e.name])])) : null;
  const defs: CampoLista[] = ESTADISTICAS.map((e) => ({ name: e.name, label: e.label, tipo: e.tipo === "rango" ? "opcion" : "numero", opciones: e.tipo === "rango" ? ["D", "C", "B", "A", "S", "SS", "SSS"] : undefined }));
  const { subcampos, aviso } = subcamposDe(defs, d, actuales);
  const quiereOculto = d.oculto || l.ocultos.has("estadisticas");
  const igual = Boolean(fila) && mismosSubcampos(subcampos) && quiereOculto === l.ocultos.has("estadisticas");
  return {
    ...datoComun(d),
    clave: "",
    valor: "",
    campo: "estadisticas",
    subcampos,
    actual: fila ? resumenSubcampos(subcampos) || null : null,
    igual,
    decision: decisionPorDefecto(igual, quiereOculto),
    ocultable: true,
    aNotas: true,
    aviso,
    editor: "fila",
  };
}

/**
 * Lo que una ficha necesita para nacer, además del nombre. Si la propuesta no lo trae,
 * sale como un dato más que el autor tiene que rellenar.
 */
const IMPRESCINDIBLES: Record<string, string[]> = { capitulos: ["libro"], actos: ["capituloId"], elementos: ["slug"], hojas: ["arcoId"] };

async function datosImprescindibles(ctx: Ctx, entidad: string, datos: DatoAnalizado[]): Promise<DatoAnalizado[]> {
  const molde = moldeDe(entidad)!;
  const faltan = (IMPRESCINDIBLES[entidad] ?? []).filter((n) => !datos.some((d) => d.campo === n));
  return Promise.all(
    faltan.map(async (name) => {
      const c = molde.campos.find((x) => x.name === name)!;
      return {
        clave: `imprescindible:${name}`,
        clase: "campo" as const,
        raw: "",
        seccion: null,
        rotulo: c.label,
        valor: "",
        actual: null,
        igual: false,
        decision: "visible" as const,
        ocultable: false,
        aNotas: false,
        anadir: false,
        vaciar: false,
        aviso: null,
        obligatorio: true,
        campo: c.name,
        editor: c.tipo,
        catalogo: c.catalogo,
        opciones: c.opciones,
        objetivo: c.tipo === "ficha" ? await buscarObjetivo(ctx, entidadDeRef(c.ref)!, "") : undefined,
      };
    }),
  );
}

function rutaPanel(entidad: string, id: number): string | null {
  if (entidad === "gremio") return "/admin/gremio";
  if (entidad === "capitulos") return `/admin/taller/capitulos/${id}`;
  if (entidad === "actos") return `/admin/taller/escribe?acto=${id}`;
  if (entidad === "arcos" || entidad === "hojas" || entidad === "hilos") return `/admin/taller/trama/${entidad}/${id}`;
  return `/admin/${entidad}/${id}/editar`;
}

async function analizarFicha(ctx: Ctx, archivo: string, cruda: FichaCruda): Promise<FichaAnalizada> {
  const entidad = cruda.entidad!;
  const molde = moldeDe(entidad)!;
  const tabla = tablaEntidad(entidad);
  const cabecera = cruda.raw.split("\n")[0];
  const clave = hashTexto(`${archivo}\n${cabecera}`);
  const avisos: string[] = [];
  let error: string | null = null;

  const base = {
    clave,
    archivo,
    raw: cruda.raw,
    tipo: cruda.tipo,
    entidad,
    singular: molde.singular,
    modo: cruda.modo,
    nombre: cruda.nombre,
    estado: cruda.estado,
  };
  if (!tabla) {
    return { ...base, id: null, nombreActual: null, estadoActual: null, conEstado: false, parecidas: [], ambigua: false, rutaPanel: null, avisos, error: `No se pueden aplicar fichas de tipo «${cruda.tipo}».`, datos: [] };
  }

  // A qué ficha va.
  let id: number | null = cruda.id;
  let parecidas: Candidato[] = [];
  let ambigua = false;
  const forzado = ctx.destinos[clave];
  if (cruda.modo === "nueva") {
    const b = await ctx.dir.buscar(entidad, cruda.nombre);
    parecidas = [...b.exactas, ...b.parecidas];
    if (forzado === "crear") id = null;
    else if (typeof forzado === "number") id = forzado;
    else if (entidad === "gremio") id = (await ctx.dir.entradas("gremio"))[0]?.id ?? null;
    else if (b.exactas.length === 1) {
      id = b.exactas[0].id;
      avisos.push(`Ya existe una ficha llamada así (#${id}): se aplica sobre ella. Puedes elegir crear otra.`);
    } else if (b.exactas.length > 1) {
      ambigua = true;
      avisos.push("Hay varias fichas llamadas así: elige sobre cuál se aplica, o crea otra.");
    } else if (b.parecidas.length) {
      avisos.push("Hay fichas con un nombre parecido: comprueba que no sea una de ellas.");
    }
  }

  const c = cols(tabla);
  let fila: Record<string, unknown> | null = null;
  if (id != null) {
    [fila] = (await db.select().from(tabla).where(eq(c.id, id)).limit(1)) as Record<string, unknown>[];
    fila ??= null;
    if (!fila) error = `No existe ninguna ficha de tipo ${molde.singular} con el id #${id}.`;
    else {
      const actual = String(fila[molde.nombre] ?? "");
      if (cruda.modo === "cambios" && normalizar(actual) !== normalizar(cruda.nombre)) avisos.push(`La propuesta dice «${cruda.nombre}», pero la ficha #${id} se llama «${actual}». Comprueba que sea esa.`);
      if (fila.eliminadoEn) avisos.push("Esta ficha está en la papelera.");
    }
  }

  const leido: Leido = {
    entidad,
    id: fila ? id : null,
    fila,
    ocultos: fila && id ? await camposOcultos(entidad, id) : new Set(),
    nota: "",
    filas: new Map(),
    listas: new Map(),
  };
  if (fila && id) {
    const notas = await db.select({ contenido: s.notaPrivada.contenido }).from(s.notaPrivada).where(and(eq(s.notaPrivada.entidadTipo, entidad), eq(s.notaPrivada.entidadId, id)));
    leido.nota = notas.map((n) => n.contenido).join("\n\n");
  }

  const repetidas = new Map<string, number>();
  const datos: DatoAnalizado[] = [];
  for (const d of cruda.datos) {
    let dato: DatoAnalizado;
    switch (d.clase) {
      case "campo":
        dato = await analizarCampo(ctx, leido, d);
        break;
      case "conexion":
      case "quitar":
        dato = await analizarConexion(ctx, leido, d);
        break;
      case "fecha":
        dato = await analizarFecha(ctx, leido, d);
        break;
      case "lista":
      case "quitar-lista":
        dato = await analizarLista(ctx, leido, d);
        break;
      case "estadisticas":
        dato = await analizarEstadisticas(leido, d);
        break;
      case "nota": {
        const igual = leido.nota.includes(d.valor.trim());
        dato = { ...datoComun(d), clave: "", actual: leido.nota || null, igual, decision: igual ? "descartar" : "notas", ocultable: false, aNotas: true, anadir: true, editor: "largo" };
        break;
      }
      default:
        dato = { ...datoComun(d), clave: "", valor: d.valor || d.raw, actual: null, igual: false, decision: "luego", ocultable: false, aNotas: true, editor: "texto", aviso: "No se entiende: se queda en el archivo hasta que decidas." };
    }
    const h = hashTexto(d.raw);
    const n = repetidas.get(h) ?? 0;
    repetidas.set(h, n + 1);
    dato.clave = `${h}:${n}`;
    datos.push(dato);
  }
  if (!fila) datos.unshift(...(await datosImprescindibles(ctx, entidad, datos)));

  return {
    ...base,
    id: fila ? id : null,
    nombreActual: fila ? String(fila[molde.nombre] ?? "") : null,
    estadoActual: fila && "estadoPublicacion" in fila ? String(fila.estadoPublicacion) : null,
    conEstado: Boolean(c.estadoPublicacion),
    parecidas,
    ambigua,
    rutaPanel: fila && id ? rutaPanel(entidad, id) : null,
    avisos,
    error,
    datos,
  };
}

/** Analiza varios archivos a la vez: una conexión puede apuntar a una ficha nueva de otro. */
export async function analizarArchivos(archivos: { nombre: string; texto: string }[], destinos: Record<string, number | "crear"> = {}): Promise<Analisis> {
  const leidos = archivos.map((a) => ({ nombre: a.nombre, propuesta: leerPropuesta(a.texto) }));
  const [cal, filasCat, elementos] = await Promise.all([
    getCalendario(),
    db.select({ campo: s.catalogos.campo, valor: s.catalogos.valor, grupo: s.catalogos.grupo }).from(s.catalogos).orderBy(asc(s.catalogos.grupo), asc(s.catalogos.orden), asc(s.catalogos.valor)),
    db.select({ valor: s.elementos.nombre, grupo: s.elementos.familia }).from(s.elementos).where(isNull(s.elementos.eliminadoEn)).orderBy(asc(s.elementos.orden), asc(s.elementos.nombre)),
  ]);
  const catalogos: Record<string, OpcionCatalogo[]> = { elementos };
  for (const f of filasCat) (catalogos[f.campo] ??= []).push({ valor: f.valor, grupo: f.grupo });

  const nuevas = new Set<string>();
  for (const { propuesta } of leidos) for (const f of propuesta.fichas) if (f.modo === "nueva" && f.entidad) nuevas.add(`${f.entidad}|${normalizar(f.nombre)}`);

  const ctx: Ctx = { dir: new Directorio(), nuevas, cal, catalogos, destinos };
  const out: Analisis = { fichas: [], sueltos: [], raros: [], calendario: cal, catalogos };
  for (const { nombre, propuesta } of leidos) {
    for (const f of propuesta.fichas) out.fichas.push(await analizarFicha(ctx, nombre, f));
    for (const su of propuesta.sueltos) out.sueltos.push({ ...su, archivo: nombre, clave: hashTexto(`${nombre}\n${su.raw}`) });
    for (const r of propuesta.raros) out.raros.push({ ...r, archivo: nombre, clave: hashTexto(`${nombre}\n${r.raw}`) });
  }
  return out;
}
