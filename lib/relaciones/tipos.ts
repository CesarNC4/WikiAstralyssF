/**
 * Tipos del registro de relaciones. Client-safe: no importa Drizzle ni toca la
 * base. El mapeo a tablas vive en `lib/relaciones/tablas.ts` (server-only).
 *
 * La idea de todo el sistema es que cada arista del mundo se declare **una vez**
 * y con nombre para sus dos extremos. De esa declaración salen solos el editor
 * en la ficha A, el editor espejo en la ficha B, los bloques de las dos fichas
 * públicas y las aristas del Atlas. Antes cada arista se repetía en siete
 * sitios y siempre en una sola dirección, que es la razón por la que la wiki
 * estaba conectada a medias.
 */

/** Cómo se guarda la relación. */
export type Medio =
  /** Tabla propia con columnas tipadas y claves foráneas. */
  | "tabla"
  /** Tabla genérica `vinculo`, sin migración para añadir relaciones nuevas. */
  | "vinculo"
  /**
   * Una columna de clave foránea en la tabla del lado A. No es N:M: el lado A
   * apunta como mucho a una ficha, mientras que el lado B ve todas las que le
   * apuntan. Editarla desde el reverso escribe esa columna en la OTRA ficha.
   */
  | "referencia";

export interface CampoVinculo {
  /** Nombre de columna (medio "tabla") o clave dentro de la fila (medio "vinculo"). */
  name: string;
  label: string;
  tipo: "text" | "select" | "checkbox";
  /**
   * Catálogo del que salen las opciones. Se prefiere a `opciones`: así la lista
   * se edita desde /admin/catalogos sin tocar código ni desplegar.
   */
  catalogo?: string;
  /** Lista fija, para relaciones cuyo matiz no tiene sentido que edites. */
  opciones?: string[];
  /** Se muestra junto al nombre en las listas compactas. */
  destacado?: boolean;
}

/** Un extremo de la relación. Los textos son los de la ficha de ESTE lado. */
export interface Lado {
  /** Key de entidad, de `lib/entities.ts`. */
  entidad: string;
  /** Título del bloque en esta ficha; describe lo que hay AL OTRO lado. */
  titulo: string;
  /** Icono de lucide-react. */
  icon: string;
  hint?: string;
  /** Orden del bloque dentro de la ficha. Menor primero. */
  orden: number;
  /** No generar el bloque público de este lado. */
  sinPublico?: boolean;
  /**
   * Esta ficha ya tiene un editor a medida para la relación (jerarquías de
   * organización, familia y gremio). El panel de conexiones la muestra como
   * solo lectura y enlaza al editor propio en lugar de duplicarlo.
   */
  editorPropio?: boolean;
}

/** Relación de una entidad consigo misma que debe verse desde los dos lados. */
export interface Reciproca {
  /** Campo que guarda el tipo de relación. */
  campo: string;
  /**
   * Término que se escribe en la fila inversa. "Depredador" en A produce
   * "Presa" en B. Lo que no aparezca aquí se copia tal cual, que es lo correcto
   * para los tipos simétricos ("Aliada", "Rival").
   */
  inverso: Record<string, string>;
}

export interface RelacionDef {
  /** Identificador estable. Para medio "tabla" coincide con el nombre de tabla. */
  id: string;
  medio: Medio;
  a: Lado;
  b: Lado;
  campos: CampoVinculo[];
  /** La relación se ordena a mano y guarda posición. */
  ordenable?: boolean;
  reciproca?: Reciproca;
  /** Valor de la columna `relacion` en la tabla genérica. Sólo medio "vinculo". */
  relacion?: string;
  /** Columna de clave foránea en la tabla del lado A. Sólo medio "referencia". */
  columna?: string;
  /** No incluir estas aristas en el grafo del Atlas (ruido visual). */
  fueraDelAtlas?: boolean;
}

/** Un bloque tal y como lo ve una ficha concreta: ya resuelto a un lado. */
export interface BloqueRelacion {
  relId: string;
  /** Qué extremo de la relación es esta ficha. */
  lado: "a" | "b";
  /** Entidad que se lista en el bloque (el otro extremo). */
  objetivo: string;
  titulo: string;
  icon: string;
  hint?: string;
  orden: number;
  campos: CampoVinculo[];
  ordenable: boolean;
  editorPropio: boolean;
  sinPublico: boolean;
  /** La relación conecta la entidad consigo misma. */
  reflexiva: boolean;
  /** El bloque admite una sola ficha (lado que posee la clave foránea). */
  unico: boolean;
}

/** Una fila de relación, uniforme sea cual sea el medio de guardado. */
export interface FilaVinculo {
  /** Id de la fila. Las operaciones van por id porque se permiten duplicados. */
  id: number;
  objetivoId: number;
  /** Entidad del otro extremo. Sólo varía en las relaciones comodín. */
  objetivoTipo?: string;
  /** Nombre de la ficha del otro extremo. */
  label: string;
  imagenUrl?: string | null;
  /** Contexto para desambiguar en el selector y en las listas. */
  detalle?: string | null;
  /** Estado de publicación del otro extremo, para avisar en el admin. */
  estado?: string | null;
  campos: Record<string, string>;
}
