import type { ClaseLista, CampoLista } from "./listas";
import { validarFecha } from "@/lib/fechas/calendario";
import { leerFecha } from "@/lib/fechas/leer";
import type { Calendario } from "@/lib/fechas/tipos";

/**
 * Lo que entiende la bandeja de propuestas (docs/area-ia.md, Fase 5). Client-safe: el
 * servidor analiza el archivo y el panel enseña y edita estos mismos objetos.
 */

/** Qué hacer con un dato. "visible" y "oculto" lo aplican; "luego" lo deja en el archivo. */
export type Decision = "visible" | "oculto" | "notas" | "descartar" | "luego";

export type ClaseDato =
  | "campo"
  | "conexion"
  | "quitar"
  | "fecha"
  | "nota"
  | "lista"
  | "quitar-lista"
  | "estadisticas"
  /** Una línea que no se entiende: nunca se pierde, se queda en el archivo hasta que el autor decida. */
  | "desconocido";

export type EstadoFicha = "borrador" | "publicado" | "oculto";

export interface Subcampo {
  label: string;
  valor: string;
}

/** Un dato tal como está escrito en la propuesta, todavía sin mirar la base. */
export interface DatoCrudo {
  clase: ClaseDato;
  /** Las líneas exactas de este dato en el archivo. */
  raw: string;
  /** El encabezado `###` bajo el que está, para poder dejarlo pendiente en su sitio. */
  seccion: string | null;
  rotulo: string;
  valor: string;
  /** Columna del campo. */
  campo?: string;
  oculto: boolean;
  /** `(añadir)`: el texto va al final del actual en vez de sustituirlo. */
  anadir: boolean;
  /** `(vaciar)`: deja el campo vacío. */
  vaciar: boolean;
  opcionNueva: boolean;
  /** ★ en una fecha. */
  importante: boolean;
  /** Conexión o fila de lista: a quién apunta. */
  nombre?: string;
  idFicha?: number;
  sinFicha?: boolean;
  subcampos?: Subcampo[];
  lista?: ClaseLista;
}

export interface FichaCruda {
  raw: string;
  /** Singular tal como viene ("Personaje"). */
  tipo: string;
  entidad: string | null;
  id: number | null;
  nombre: string;
  modo: "nueva" | "cambios";
  estado: EstadoFicha | null;
  datos: DatoCrudo[];
}

export interface SueltoCrudo {
  raw: string;
  titulo: string;
  texto: string;
}

/** Un bloque `##` que no se entiende: se enseña tal cual y se queda en el archivo. */
export interface BloqueRaro {
  raw: string;
  motivo: string;
}

export interface PropuestaCruda {
  fichas: FichaCruda[];
  sueltos: SueltoCrudo[];
  raros: BloqueRaro[];
}

// ── Analizado ──────────────────────────────────────────────────────────────

export interface Candidato {
  id: number;
  entidad: string;
  label: string;
  detalle: string | null;
  estado: string | null;
}

/** La ficha a la que apunta una conexión, un campo de referencia o una fila de lista. */
export interface Objetivo {
  /** Entidad en la que se busca; "*" si vale cualquiera. */
  entidad: string;
  /** El nombre tal como lo escribió la propuesta. */
  nombre: string;
  /** Ficha elegida; null si aún no se sabe o no se va a usar. */
  id: number | null;
  entidadElegida: string | null;
  label: string | null;
  estado: string | null;
  candidatos: Candidato[];
  /** Al aplicar se crea como borrador (o se usa la que ya tenga ese nombre entonces). */
  crear: boolean;
  /** La fila se guarda con el nombre suelto, sin ficha. */
  sinFicha: boolean;
  admiteSinFicha: boolean;
  /** Es una ficha nueva en esta misma propuesta. */
  enPropuesta: boolean;
}

export interface SubcampoAnalizado extends CampoLista {
  valor: string;
  actual: string | null;
}

export interface DatoAnalizado {
  /** Estable entre análisis: lo que el autor cambió sobrevive a que se vuelva a analizar. */
  clave: string;
  clase: ClaseDato;
  raw: string;
  seccion: string | null;
  rotulo: string;
  /** El valor propuesto, editable. */
  valor: string;
  /** Lo que hay ahora en la ficha, escrito para leerlo. */
  actual: string | null;
  /** Ya está así en la ficha: aplicarlo no cambia nada. */
  igual: boolean;
  decision: Decision;
  /** Se puede marcar como oculto al público. */
  ocultable: boolean;
  /** Se puede mandar a las notas de la ficha. */
  aNotas: boolean;
  anadir: boolean;
  vaciar: boolean;
  /** Un aviso que no impide aplicar. */
  aviso: string | null;
  /** Hace falta para crear la ficha aunque la propuesta no lo traiga: sin él no se aplica. */
  obligatorio?: boolean;

  /** Campo: columna y cómo se edita. */
  campo?: string;
  editor?: "corto" | "largo" | "numero" | "opcion" | "lista" | "si-no" | "ficha" | "fecha" | "fila" | "texto";
  catalogo?: string;
  opciones?: string[];

  /** Conexión. */
  relId?: string;
  lado?: "a" | "b";
  filaId?: number | null;
  /** Qué hacer si la conexión ya existe con otros datos. */
  modoFila?: "actualizar" | "anadir";

  /** Fecha. */
  rol?: string;
  importante?: boolean;

  /** Lista: clase, nombre de la fila (editable) y fila que ya existe con ese nombre. */
  lista?: ClaseLista;
  nombre?: string;

  objetivo?: Objetivo;
  subcampos?: SubcampoAnalizado[];
}

export interface FichaAnalizada {
  /** Estable entre análisis. */
  clave: string;
  archivo: string;
  raw: string;
  tipo: string;
  entidad: string;
  singular: string;
  modo: "nueva" | "cambios";
  /** Ficha sobre la que se aplica; null si se crea. */
  id: number | null;
  nombre: string;
  /** El nombre actual en la wiki, si existe. */
  nombreActual: string | null;
  /** Estado de publicación actual; null si es nueva o no tiene. */
  estadoActual: string | null;
  /** Tiene estado de publicación (el gremio no). */
  conEstado: boolean;
  estado: EstadoFicha | null;
  /** Fichas que se llaman igual o parecido: el autor puede aplicar sobre ellas. */
  parecidas: Candidato[];
  /** Hay más de una que se llama igual: hay que elegir. */
  ambigua: boolean;
  /** Ruta para abrirla en el panel, si existe. */
  rutaPanel: string | null;
  avisos: string[];
  /** Impide aplicar la ficha entera (un tipo que no existe, un #id que no está). */
  error: string | null;
  datos: DatoAnalizado[];
}

export interface SueltoAnalizado {
  clave: string;
  archivo: string;
  raw: string;
  titulo: string;
  texto: string;
}

export interface RaroAnalizado {
  clave: string;
  archivo: string;
  raw: string;
  motivo: string;
}

export interface OpcionCatalogo {
  valor: string;
  grupo: string | null;
}

export interface Analisis {
  fichas: FichaAnalizada[];
  sueltos: SueltoAnalizado[];
  raros: RaroAnalizado[];
  calendario: Calendario;
  catalogos: Record<string, OpcionCatalogo[]>;
}

/** Lo que hace falta para aplicar una ficha: la analizada, con lo que el autor cambió. */
export interface EntradaFicha {
  entidad: string;
  id: number | null;
  /** Crear ficha nueva aunque ya exista otra con ese nombre. */
  crearOtra: boolean;
  nombre: string;
  estado: EstadoFicha | null;
  datos: DatoAnalizado[];
  /** El aviso a Discord elegido en la tarjeta (canal, «No avisar» o el de un cambio). */
  aviso?: { canal?: string | null; cambio?: boolean; nota?: string };
}

export interface ResultadoFicha {
  ok: boolean;
  id: number | null;
  /** Error que impidió aplicar la ficha entera. */
  error?: string;
  /** Datos que no se pudieron aplicar, con el motivo. Se quedan en el archivo. */
  fallidos: Record<string, string>;
  /** Datos ya aplicados en esta llamada. */
  aplicados: string[];
}

// ── Utilidades ─────────────────────────────────────────────────────────────

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Hash corto (djb2): da una clave estable a un texto. */
export function hashTexto(t: string): string {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Por qué un dato aún no se puede aplicar; null si está listo. */
export function faltaEn(d: DatoAnalizado, cal: Calendario): string | null {
  if (d.decision === "descartar" || d.decision === "luego" || d.decision === "notas") return null;
  if (d.clase === "desconocido") return "No se entiende: mándalo a notas, descártalo o déjalo para luego.";
  if (d.obligatorio && d.editor !== "ficha" && !d.valor.trim()) return "Hace falta para crear esta ficha.";
  const o = d.objetivo;
  if (o && o.id == null && !o.crear && !o.sinFicha) {
    if (d.obligatorio) return "Hace falta para crear esta ficha: elígela.";
    return o.candidatos.length ? "Hay varias fichas posibles: elige una." : "No hay ninguna ficha con ese nombre: elige una o créala.";
  }
  if (d.clase === "fecha" && !d.vaciar) {
    const fecha = leerFecha(cal, d.valor);
    if (!fecha) return "No se entiende la fecha: escríbela como «Año 1203» o «20 de Mes 3, año 1203».";
    const errores = validarFecha(cal, fecha);
    if (errores.length) return errores[0];
  }
  return null;
}
