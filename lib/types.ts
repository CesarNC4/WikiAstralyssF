import type { EntityKey } from "./entities";

/** Card normalizada para páginas índice y resultados de búsqueda (§5). */
export interface EntityCard {
  id: number | string;
  titulo: string;
  subtitulo: string | null;
  imagenUrl: string | null;
  href: string;
  badge?: string | null;
}

/** Bloque de prosa etiquetado para fichas genéricas (§5.2). */
export interface FichaField {
  label: string;
  value: string | null | undefined;
  /** Si true, se renderiza como párrafo largo; si false, inline. */
  long?: boolean;
}

export interface SearchResult {
  tipo: EntityKey;
  tipoLabel: string;
  id: number | string;
  titulo: string;
  subtitulo: string | null;
  href: string;
}
