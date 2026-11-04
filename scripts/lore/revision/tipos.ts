import type { Calendario, Fecha } from "@/lib/fechas/tipos";

/**
 * La revisión del lore (docs/area-ia.md, Fase 6). Una "foto" es todo lo que la
 * base sabe, en memoria y sin ninguna consulta: las reglas (`reglas.ts`) son puras y
 * se prueban con fotos inventadas (`probar-revision.ts`), sin tocar la base.
 */

/** En este orden salen en el informe: de lo que más urge a lo que menos. */
export const CATEGORIAS = {
  secretos: "Secretos en riesgo",
  fechas: "Fechas imposibles",
  conexiones: "Conexiones y duplicados",
  referencias: "Referencias rotas",
  taller: "Coherencia del taller",
  menciones: "Menciones sin conexión",
  guia: "Guía de estilo y restos de prueba",
  huecos: "Fichas a medias",
} as const;

export type Categoria = keyof typeof CATEGORIAS;
export type Gravedad = "alta" | "media" | "baja";

export interface RefFicha {
  entidad: string;
  id: number;
  nombre: string;
}

export interface Hallazgo {
  /** Estable entre revisiones: es lo que se apunta en las excepciones. */
  clave: string;
  categoria: Categoria;
  gravedad: Gravedad;
  texto: string;
  fichas: RefFicha[];
}

export interface TextoFicha {
  campo: string;
  rotulo: string;
  texto: string;
  /** El campo entero está oculto al público. */
  oculto: boolean;
  /** No se publica nunca: notas de autor. */
  privado: boolean;
  /** Párrafos (molde "largo"), no un dato de una línea. */
  largo: boolean;
}

export interface FichaFoto {
  entidad: string;
  id: number;
  nombre: string;
  /** Null en lo que no se publica por separado (gremio, elementos). */
  estado: string | null;
  enPapelera: boolean;
  /** La ve un lector sin sesión. */
  publica: boolean;
  /** Las columnas de la fila, en camelCase. */
  valores: Record<string, unknown>;
  textos: TextoFicha[];
  ocultos: Set<string>;
}

export interface AristaFoto {
  relId: string;
  filaId: number;
  a: { entidad: string; id: number };
  /** Null en una fila que solo guarda un nombre suelto. */
  b: { entidad: string; id: number } | null;
  nombreLibre: string | null;
  campos: Record<string, string>;
  oculto: boolean;
}

export interface FechaFoto {
  entidad: string;
  id: number;
  rol: string;
  fecha: Fecha;
  claveIni: number;
  claveFin: number;
  oculto: boolean;
  /** Ya escrita, para el informe. */
  texto: string;
}

export interface ArbolFoto {
  id: number;
  familiaId: number;
  nombre: string;
  personajeId: number | null;
  padreId: number | null;
  madreId: number | null;
}

export interface FragmentoFoto {
  id: number;
  actoId: number;
  personajeId: number | null;
  titulo: string | null;
}

export interface Foto {
  fichas: FichaFoto[];
  aristas: AristaFoto[];
  fechas: FechaFoto[];
  arbol: ArbolFoto[];
  fragmentos: FragmentoFoto[];
  fases: { id: number; plantillaId: number }[];
  /** Filas de tablas polimórficas: ninguna clave foránea las protege. */
  polimorficas: { tabla: string; filaId: number; entidad: string; id: number }[];
  /** Filas de `vinculo` cuya relación no está en el registro. */
  vinculosRaros: { filaId: number; relacion: string | null }[];
  fueraDeCatalogo: { tabla: string; columna: string; catalogo: string; valor: string; n: number }[];
  calendario: Calendario;
}

/** Cuántas fichas hay de un tipo y cuántas están vacías o a medias. */
export interface ResumenHuecos {
  entidad: string;
  total: number;
  publicas: number;
  vacias: number;
  vaciasPublicas: number;
  aMedias: number;
  aMediasPublicas: number;
}
