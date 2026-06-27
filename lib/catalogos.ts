/**
 * FUENTE ÚNICA de los catálogos del admin (listas fijas).
 *
 * Esto es lo que TÚ controlas: edita las listas a tu gusto y luego corre el seed
 * para sincronizar la base de datos:
 *
 *     node --env-file=.env.local scripts/seed-catalogos.ts
 *
 * Reglas:
 *  - El orden del array ES el orden en que aparecen en los desplegables.
 *  - El seed es ESTRICTO (espejo): lo que no esté aquí se elimina del catálogo en BD
 *    (tras migrar los valores en uso). Así los filtros quedan 100% limpios.
 *  - Las fichas SOLO pueden elegir de estas listas (sin texto libre).
 *
 * Marcas:
 *  ✦ = lista curada/propuesta por mí — REVÍSALA y ajústala a tu lore.
 *  · = lista que ya estaba limpia en BD (la dejé igual).
 */

/** Catálogos simples: campo → valores (en orden). */
export const CATALOGOS = {
  // ── Personajes ────────────────────────────────────────────────────────────
  genero: ["Femenino", "Masculino", "Sin género"], // ·
  rango_aventurero: ["Amateur", "Bronce", "Plata", "Oro", "Platino", "Rubí", "Esmeralda", "Diamante", "Dragonita"], // ·
  nivel_consciencia: ["D", "C", "B", "A", "S"], // ·
  tipo_invocacion: ["Natural", "Ishkoriana"], // · (antes hardcodeado en el form)

  // ── Habilidades ──────────────────────────────────────────────────────────
  habilidad_categoria: ["Técnica", "Pasiva", "Especial", "Definitiva"], // ✦ (migra: TECNICA → Técnica)

  // ── Relaciones ───────────────────────────────────────────────────────────
  tipo_relacion: ["Aliado", "Rival", "Amigo", "Enemigo", "Familiar", "Mentor", "Aprendiz", "Amante", "Compañero", "Subordinado", "Superior", "Otro"], // ✦ (incluye en uso: Aprendiz, Amante)
  subtipo_relacion: ["Amigo", "Mejor amigo", "Confidente", "Conocido", "Compañero de armas", "Otro"], // ✦ (en uso: amigo)

  // ── Magia (catálogo y técnicas) ──────────────────────────────────────────
  magia_naturaleza: ["Fundamento", "Concepto", "Tecnica", "Tecnica Avanzada"], // · (sin tilde a propósito)
  magia_tipo: ["Elemental", "Rúnica", "Oscura", "Ritual", "Demoníaca", "Antigua"], // ·

  // ── Cronología ───────────────────────────────────────────────────────────
  timeline_importancia: ["Menor", "Normal", "Mayor", "Crítico"], // ·
  timeline_categoria: ["Político", "Militar", "Mágico", "Cósmico", "Social", "Religioso", "Otro"], // ✦ (migra tildes: Magico→Mágico, etc.)

  // ── Naciones ─────────────────────────────────────────────────────────────
  nacion_gobierno: ["Monarquía", "República", "Imperio", "Teocracia", "Oligarquía", "Tribal", "Confederación", "Otro"], // ✦
  nacion_clima: ["Templado", "Árido", "Tropical", "Polar", "Volcánico", "Mágico"], // ·
  nacion_terreno: ["Montañoso", "Costero", "Boscoso", "Desértico", "Llanura", "Insular"], // ·
  nacion_elemento: ["Pyro", "Hydro", "Cryo", "Electro", "Geo", "Dendro", "Anemo (Vento)", "Sacro", "Demoníaco", "Neutro"], // ·

  // ── Razas ────────────────────────────────────────────────────────────────
  raza_clasificacion: ["Humanoide", "Bestial", "Elemental", "No-muerto", "Demoníaco", "Divino", "Híbrido", "Otro"], // ✦
  raza_afinidad: ["Pyro", "Hydro", "Cryo", "Electro", "Geo", "Dendro", "Anemo (Vento)", "Sacro", "Demoníaco", "Neutro"], // ·
  raza_dieta: ["Carnívoro", "Herbívoro", "Omnívoro", "Energía mágica"], // ·

  // ── Bestias ──────────────────────────────────────────────────────────────
  bestia_categoria: ["Común", "Jefe", "Legendaria", "Divina"], // ·
  bestia_nivel_amenaza: ["Inofensiva", "Baja", "Media", "Alta", "Extrema", "Apocalíptica"], // ✦
  bestia_dieta: ["Carnívoro", "Herbívoro", "Omnívoro", "Carroñero", "Energía mágica"], // ·
  bestia_tamano: ["Diminuto", "Pequeño", "Mediano", "Grande", "Colosal"], // ·

  // ── Minerales ────────────────────────────────────────────────────────────
  mineral_rareza: ["Común", "Poco común", "Raro", "Épico", "Legendario", "Mítico"], // ✦
  mineral_tipo: ["Mineral", "Gema", "Metal", "Cristal", "Esencia", "Orgánico"], // ✦
  mineral_elemento: ["Pyro", "Hydro", "Cryo", "Electro", "Geo", "Dendro", "Anemo (Vento)", "Sacro", "Demoníaco", "Neutro"], // ·

  // ── Conceptos ────────────────────────────────────────────────────────────
  concepto_categoria: ["Cosmología", "Magia", "Historia", "Sociedad", "Religión", "Geografía", "Otro"], // ✦

  // ── Misiones ─────────────────────────────────────────────────────────────
  mision_tipo: ["Principal", "Secundaria", "Caza", "Escolta", "Recolección", "Exploración", "Otro"], // ✦
  mision_riesgo: ["Bajo", "Medio", "Alto", "Extremo", "Mortal"], // ✦
  mision_estado: ["Disponible", "En curso", "Completada", "Fallida", "Cancelada"], // ✦

  // ── Lords demonio ────────────────────────────────────────────────────────
  demonio_dominio: ["Fuego", "Hielo", "Sombra", "Sangre", "Vacío", "Caos", "Otro"], // ✦ (en uso: "Fuego Verde" — ajústalo)
  demonio_estado: ["Vivo", "Sellado", "Derrotado", "Desaparecido"], // ✦

  // ── Armas y artefactos ───────────────────────────────────────────────────
  artefacto_tipo: ["Arma", "Artefacto", "Objeto", "Reliquia", "Consumible"], // ✦

  // ── Familias ─────────────────────────────────────────────────────────────
  familia_origen: ["Noble", "Real", "Plebeya", "Mercante", "Militar", "Religiosa", "Otro"], // ✦ (en uso: "Dinero" — ajústalo)

  // ── Organizaciones ───────────────────────────────────────────────────────
  org_tipo: ["Orden", "Gremio", "Secta", "Clan", "Compañía", "Academia", "Culto", "Otro"], // ✦
  org_estado: ["Activa", "Inactiva", "Disuelta", "Clandestina", "En guerra"], // ✦

  // ── Árbol genealógico (editor de familia) ────────────────────────────────
  arbol_estado: ["Vivo", "Fallecido", "Desaparecido", "Desconocido"], // ✦
} as const satisfies Record<string, readonly string[]>;

/**
 * Variantes de magia de DOS niveles: tipo de magia → elementos/variantes.
 * Solo los tipos que tienen variantes aparecen aquí.
 */
export const MAGIA_VARIANTES = {
  Elemental: ["Pyro", "Hydro", "Geo", "Dendro", "Vento", "Cryo", "Electro"], // ·
  Antigua: ["Lumino", "Umbra"], // ·
} as const satisfies Record<string, readonly string[]>;

export type CatalogoCampo = keyof typeof CATALOGOS;

/**
 * Etiqueta inversa de una relación PJ↔PJ. Si A es "Mentor" de B, en la ficha de
 * B la relación se muestra como "Aprendiz" automáticamente. Los tipos no listados
 * aquí se consideran simétricos (misma etiqueta en ambos lados).
 * Edita estos pares a tu gusto (deben existir en CATALOGOS.tipo_relacion).
 */
export const RELACION_INVERSA: Record<string, string> = {
  Mentor: "Aprendiz",
  Aprendiz: "Mentor",
  Superior: "Subordinado",
  Subordinado: "Superior",
  // Simétricos (Aliado, Rival, Amigo, Enemigo, Familiar, Amante, Compañero, Otro)
  // no necesitan entrada: se muestran con la misma etiqueta.
};

/** Devuelve la etiqueta a mostrar en el lado inverso de una relación. */
export function etiquetaInversa(tipo: string | null | undefined): string | null {
  if (!tipo) return tipo ?? null;
  return RELACION_INVERSA[tipo] ?? tipo;
}

/** Migraciones de valores en uso (valor viejo en BD → valor canónico del archivo). */
export const MIGRACIONES_VALOR: Record<string, Record<string, string>> = {
  habilidad_categoria: { TECNICA: "Técnica" },
  timeline_categoria: { Magico: "Mágico", Politico: "Político", Cosmico: "Cósmico" },
  subtipo_relacion: { amigo: "Amigo" },
};
