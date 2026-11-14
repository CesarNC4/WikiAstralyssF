import type { GaleriaItem } from "@/lib/queries/galeria";

/** La imagen de perfil de una ficha, para ponerla en su galería. */
export interface PerfilEnGaleria {
  url: string | null;
  assetId: number | null;
  alt: string | null;
}

/** La imagen de perfil no es una fila de `entidad_media` (esas tienen id positivo). */
export const ID_PERFIL = -1;

/** Si la imagen de perfil ya está entre las de la galería (la misma subida o la misma dirección). */
export function estaEnGaleria(galeria: GaleriaItem[], perfil: PerfilEnGaleria): boolean {
  return galeria.some((g) => g.url === perfil.url || (perfil.assetId != null && g.assetId === perfil.assetId));
}

/**
 * La galería con la imagen de perfil la primera (decisión del autor, 2026-11-14). No se guarda en
 * la galería: es siempre la actual, y al cambiarla cambia también aquí. Si el autor ya la había
 * subido a la galería, se queda donde la puso y no se repite.
 */
export function conPerfil(galeria: GaleriaItem[], perfil: PerfilEnGaleria | null | undefined): GaleriaItem[] {
  if (!perfil?.url || estaEnGaleria(galeria, perfil)) return galeria;
  return [{ id: ID_PERFIL, assetId: perfil.assetId ?? ID_PERFIL, url: perfil.url, alt: perfil.alt, blurhash: null }, ...galeria];
}
