/**
 * Bloques que cada ficha pública ya pinta por su cuenta, con una presentación
 * propia que el bloque genérico no sabe reproducir: el organigrama con rangos y
 * facciones, el árbol genealógico, la diplomacia coloreada por tipo, los drops
 * ordenados por rareza, el mapa de territorio.
 *
 * Sin esta lista esas secciones aparecerían dos veces. Todo lo que NO esté aquí
 * lo genera el registro solo, en las dos direcciones, que es lo que hace que una
 * relación nueva se vea en ambas fichas sin tocar ninguna página.
 *
 * Las claves son `relId:lado`, tal y como las devuelve `bloquesDe()`.
 */
export const BLOQUES_A_MANO: Record<string, string[]> = {
  personajes: [
    "personaje_nacion:a",
    "personaje_raza:a",
    "org_jerarquia:b",
    "familia_jerarquia:b",
    "relaciones:a",
    "capitulo_personaje:b",
    "personaje_evento:a",
    "personaje_objeto:a",
    "personaje_cancion:a",
    // El lugar de nacimiento se muestra como dato, no como bloque.
    "nacimiento_nacion:a",
    "nacimiento_region:a",
    "nacimiento_locacion:a",
    "mision_encargante:b",
  ],
  naciones: [
    "personaje_nacion:b",
    "nacion_organizacion:a",
    "nacion_raza:a",
    "nacion_diplomacia:a",
    "bestia_nacion:b",
    "region_nacion:b",
    "nacimiento_nacion:b",
  ],
  razas: ["nacion_raza:b", "personaje_raza:b", "entidad_elemento:razas:a", "raza_padre:b"],
  bestias: [
    "bestia_nacion:a",
    "bestia_region:a",
    "bestia_drop:a",
    "bestia_relacion:a",
    "entidad_elemento:bestias:a",
  ],
  minerales: ["mineral_artefacto:a", "bestia_drop:b"],
  organizaciones: ["org_jerarquia:a"],
  familias: ["familia_jerarquia:a"],
  gremio: ["gremio_jerarquia:a"],
  artefactos: ["artefacto_propietario:a"],
  regiones: ["region_nacion:a", "nacimiento_region:b"],
  locaciones: ["locacion_nacion:a", "locacion_region:a", "nacimiento_locacion:b"],
  misiones: ["mision_encargante:a"],
};

export function bloquesAMano(entidad: string): string[] {
  return BLOQUES_A_MANO[entidad] ?? [];
}
