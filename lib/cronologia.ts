import { TIPOS_SUCESO, type Fecha, type TextosFecha, type TipoSuceso } from "@/lib/fechas";

/**
 * Forma de un suceso de la cronología (spec §14), tal como viaja al navegador.
 * Client-safe: la consulta vive en `lib/queries/cronologia.ts`.
 *
 * Un suceso es un evento creado a mano o una fecha de ficha (un nacimiento,
 * una fundación, un acto…). Los capítulos también, con la fecha que calculan
 * de sus actos.
 */

/** Una ficha a la que apunta un suceso. */
export interface RefSuceso {
  tipo: string;
  id: number;
  nombre: string;
  /** Ficha pública, o editor en el taller. Null si no tiene página. */
  href: string | null;
  imagenUrl?: string | null;
}

export interface Suceso {
  /** Única: "timeline:12:principal", "personajes:5:nacimiento", "capitulos:3". */
  clave: string;
  tipo: TipoSuceso;
  rol: string;
  titulo: string;
  descripcion: string | null;
  fecha: Fecha;
  /** La fecha escrita, larga y corta, en las dos lecturas. */
  textos: TextosFecha;
  cortos: TextosFecha;
  claveIni: number;
  claveFin: number;
  importante: boolean;
  /** Era en la que empieza; null si no hay eras. */
  era: { id: number; nombre: string } | null;
  /** Solo los eventos: su categoría y su escala de importancia. */
  categoria: string | null;
  importancia: string | null;
  /** La ficha del suceso (el personaje que nace…). Null en los eventos. */
  entidad: RefSuceso | null;
  capitulo: RefSuceso | null;
  acto: RefSuceso | null;
  locacion: RefSuceso | null;
  personajes: RefSuceso[];
}

export function metaTipoSuceso(tipo: TipoSuceso) {
  return TIPOS_SUCESO.find((t) => t.id === tipo) ?? TIPOS_SUCESO[TIPOS_SUCESO.length - 1];
}

/** Todas las fichas que toca un suceso, para filtrar "por entidad". */
export function refsDe(s: Suceso): RefSuceso[] {
  return [s.entidad, s.capitulo, s.acto, s.locacion, ...s.personajes].filter((r): r is RefSuceso => r != null);
}

export const claveRef = (r: { tipo: string; id: number }) => `${r.tipo}:${r.id}`;
