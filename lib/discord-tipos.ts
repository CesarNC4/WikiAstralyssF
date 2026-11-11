import type { EntityKey } from "@/lib/entities";

/**
 * Los tipos de ficha que avisan en Discord, en el orden del panel, con el nombre
 * del canal que se propone para cada uno (la categoría WIKI del servidor, del
 * 2026-11-09). Un tipo sin canal guardado no avisa salvo que se elija uno al
 * publicar. Sin `server-only`: lo usa también el panel en el navegador.
 */
export const TIPOS_CON_AVISO: { tipo: EntityKey; canal: string }[] = [
  { tipo: "personajes", canal: "personajes" },
  { tipo: "naciones", canal: "naciones-y-lugares" },
  { tipo: "regiones", canal: "naciones-y-lugares" },
  { tipo: "locaciones", canal: "naciones-y-lugares" },
  { tipo: "organizaciones", canal: "organizaciones" },
  { tipo: "familias", canal: "organizaciones" },
  // Siempre publicado: solo avisa de cambios, si se marca al guardar.
  { tipo: "gremio", canal: "organizaciones" },
  { tipo: "razas", canal: "razas-y-criaturas" },
  { tipo: "bestias", canal: "razas-y-criaturas" },
  { tipo: "demonios", canal: "razas-y-criaturas" },
  { tipo: "magia", canal: "magia-y-conceptos" },
  { tipo: "conceptos", canal: "magia-y-conceptos" },
  { tipo: "lore", canal: "magia-y-conceptos" },
  { tipo: "artefactos", canal: "objetos" },
  { tipo: "minerales", canal: "objetos" },
  { tipo: "economia", canal: "objetos" },
  { tipo: "timeline", canal: "historia" },
  { tipo: "capitulos", canal: "capitulos" },
  // Solo avisa si su capítulo también está publicado: si no, el acto no se ve.
  { tipo: "actos", canal: "capitulos" },
  { tipo: "arcos", canal: "capitulos" },
  { tipo: "misiones", canal: "capitulos" },
  { tipo: "canciones", canal: "musica" },
];

export const ES_TIPO_CON_AVISO = new Set<string>(TIPOS_CON_AVISO.map((t) => t.tipo));

/** El canal propuesto por su nombre: el de la categoría WIKI si hay varios que se llaman igual. */
export function canalPropuesto<C extends { id: string; nombre: string; categoria: string | null }>(canales: C[], nombre: string): C | undefined {
  const mismos = canales.filter((c) => c.nombre === nombre);
  return mismos.find((c) => c.categoria?.toUpperCase().includes("WIKI")) ?? mismos[0];
}
