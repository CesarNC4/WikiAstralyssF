/**
 * Configuración declarativa de entidades para el admin genérico.
 * Plano y client-safe (sin imports de servidor/Drizzle): describe cómo se
 * renderiza el formulario, la tabla y el preview de cada entidad simple.
 */

export type FieldType = "text" | "textarea" | "number" | "combobox" | "checkbox" | "reference" | "slider";

export type RefTarget = "personajes" | "capitulos" | "magia" | "naciones" | "razas" | "monedas";

export interface FieldDef {
  /** Clave de columna en Drizzle (camelCase). */
  name: string;
  label: string;
  type: FieldType;
  /** Para combobox: campo del catálogo donde persistir valores nuevos. */
  catalogCampo?: string;
  /** Para reference: entidad destino del enlace (FK). */
  refTarget?: RefTarget;
  /** Campo obligatorio (además de nameField). */
  required?: boolean;
  hint?: string;
  /** Sección del acordeón. */
  group: string;
  rows?: number;
  /** Renderiza este campo solo si otro campo tiene un valor concreto (dependencia). */
  dependsOn?: { field: string; equals: string };
}

export interface EntidadConfig {
  key: string;
  singular: string;
  plural: string;
  /** Ruta pública base (para revalidar y enlazar). */
  route: string;
  icon: string;
  /** Campo que actúa como "nombre" (nombre | titulo). */
  nameField: string;
  /** Etiqueta del campo nombre (default "Nombre"). */
  nameLabel?: string;
  hasImage: boolean;
  hasBanner: boolean;
  /** ¿Tiene ficha pública /ruta/[id] (para enlazar preview/ver)? */
  hasFicha: boolean;
  /** Columna por la que ordenar la lista del admin (default: nameField). */
  orderBy?: string;
  fields: FieldDef[];
}

const f = (name: string, label: string, type: FieldType, group: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  name,
  label,
  type,
  group,
  ...extra,
});

export const ENTIDADES: Record<string, EntidadConfig> = {
  naciones: {
    key: "naciones",
    singular: "Nación",
    plural: "Naciones",
    route: "/naciones",
    icon: "Globe2",
    nameField: "nombre",
    hasImage: true,
    hasBanner: true,
    hasFicha: true,
    fields: [
      f("subtitulo", "Subtítulo", "text", "Identidad"),
      f("gobierno", "Gobierno", "combobox", "Datos clave", { catalogCampo: "nacion_gobierno" }),
      f("capital", "Capital", "text", "Datos clave"),
      f("idioma", "Idioma", "text", "Datos clave"),
      f("poblacion", "Población", "text", "Datos clave"),
      f("elementoFundamental", "Elemento fundamental", "combobox", "Datos clave", { catalogCampo: "nacion_elemento" }),
      f("conceptoDivino", "Concepto divino", "text", "Datos clave"),
      f("diosFundador", "Dios fundador", "text", "Datos clave"),
      f("clima", "Clima", "combobox", "Geografía", { catalogCampo: "nacion_clima" }),
      f("terreno", "Terreno", "combobox", "Geografía", { catalogCampo: "nacion_terreno" }),
      f("recursosNaturales", "Recursos naturales", "textarea", "Geografía"),
      f("poderMilitarNivel", "Militar", "slider", "Poder (0-100)"),
      f("poderEconomicoNivel", "Económico", "slider", "Poder (0-100)"),
      f("poderPoliticoNivel", "Político", "slider", "Poder (0-100)"),
      f("poderMagicoNivel", "Mágico", "slider", "Poder (0-100)"),
      f("poderTecnologicoNivel", "Tecnológico", "slider", "Poder (0-100)"),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("historia", "Historia", "textarea", "Contenido", { rows: 8 }),
      f("estadoActual", "Estado actual", "textarea", "Contenido"),
      f("estructura", "Estructura", "textarea", "Contenido"),
    ],
  },
  razas: {
    key: "razas",
    singular: "Raza",
    plural: "Razas",
    route: "/razas",
    icon: "Rabbit",
    nameField: "nombre",
    hasImage: true,
    hasBanner: true,
    hasFicha: true,
    fields: [
      f("clasificacion", "Clasificación", "combobox", "Identidad", { catalogCampo: "raza_clasificacion" }),
      f("afinidad", "Afinidad elemental", "combobox", "Identidad", { catalogCampo: "raza_afinidad", hint: "Afinidad principal (Pyro, Hydro…). Debilidades/resistencias se editan abajo." }),
      f("subtitulo", "Subtítulo", "text", "Identidad"),
      f("razaPadreId", "Deriva de (raza padre)", "reference", "Identidad", { refTarget: "razas", hint: "para sub-razas / variantes / mestizajes" }),
      f("esperanzaVida", "Esperanza de vida", "text", "Datos clave"),
      f("poblacionEstimada", "Población estimada", "text", "Datos clave"),
      f("dieta", "Dieta", "combobox", "Datos clave", { catalogCampo: "raza_dieta" }),
      f("statLongevidad", "Longevidad", "slider", "Atributos (0-100)"),
      f("statAfinidadMagica", "Afinidad mágica", "slider", "Atributos (0-100)"),
      f("statFuerza", "Fuerza física", "slider", "Atributos (0-100)"),
      f("statAgilidad", "Agilidad", "slider", "Atributos (0-100)"),
      f("statAdaptabilidad", "Adaptabilidad", "slider", "Atributos (0-100)"),
      f("statDispersion", "Dispersión", "slider", "Demografía (0-100)"),
      f("statPurezaLinaje", "Pureza de linaje", "slider", "Demografía (0-100)"),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("origen", "Origen", "textarea", "Contenido"),
      f("rasgosFisicos", "Rasgos físicos", "textarea", "Contenido"),
      f("cultura", "Cultura", "textarea", "Contenido"),
      f("habilidadesRasgo", "Habilidades de raza", "textarea", "Contenido"),
      f("estructuraSocial", "Estructura social", "textarea", "Sociedad"),
      f("creencias", "Creencias / religión", "textarea", "Sociedad"),
      f("relacionOtrasRazas", "Relación con otras razas", "textarea", "Sociedad"),
      f("reproduccion", "Reproducción", "textarea", "Biología"),
      f("rasgosDistintivos", "Rasgos distintivos", "textarea", "Biología"),
    ],
  },
  bestias: {
    key: "bestias",
    singular: "Bestia",
    plural: "Bestias",
    route: "/bestias",
    icon: "PawPrint",
    nameField: "nombre",
    hasImage: true,
    hasBanner: true,
    hasFicha: true,
    fields: [
      f("subtitulo", "Subtítulo", "text", "Identidad"),
      f("categoria", "Categoría", "combobox", "Identidad", { catalogCampo: "bestia_categoria", hint: "Común · Jefe · Legendaria · Divina" }),
      f("nivelAmenaza", "Nivel de amenaza", "combobox", "Datos clave", { catalogCampo: "bestia_nivel_amenaza" }),
      f("dieta", "Dieta", "combobox", "Datos clave", { catalogCampo: "bestia_dieta", hint: "Carnívoro · Herbívoro · Omnívoro…" }),
      f("tamano", "Tamaño", "combobox", "Datos clave", { catalogCampo: "bestia_tamano", hint: "Diminuto · Pequeño · Mediano · Grande · Colosal" }),
      f("statFuerza", "Fuerza", "slider", "Combate (0-100)"),
      f("statVelocidad", "Velocidad", "slider", "Combate (0-100)"),
      f("statResistencia", "Resistencia", "slider", "Combate (0-100)"),
      f("statPoderMagico", "Poder mágico", "slider", "Combate (0-100)"),
      f("statPeligrosidad", "Peligrosidad", "slider", "Bestiario (0-100)"),
      f("statRareza", "Rareza", "slider", "Bestiario (0-100)"),
      f("statTerritorialidad", "Territorialidad", "slider", "Bestiario (0-100)"),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("habitat", "Hábitat (prosa)", "textarea", "Contenido", { hint: "El hábitat enlazado a naciones/regiones se edita abajo" }),
      f("comportamiento", "Comportamiento", "textarea", "Contenido"),
      f("cicloVida", "Ciclo de vida", "textarea", "Contenido"),
      f("recursos", "Recursos (prosa)", "textarea", "Contenido", { hint: "Los drops enlazados a minerales se editan abajo" }),
    ],
  },
  minerales: {
    key: "minerales",
    singular: "Mineral",
    plural: "Minerales",
    route: "/minerales",
    icon: "Gem",
    nameField: "nombre",
    hasImage: true,
    hasBanner: true,
    hasFicha: true,
    fields: [
      f("rareza", "Rareza", "combobox", "Identidad", { catalogCampo: "mineral_rareza" }),
      f("tipo", "Tipo", "combobox", "Identidad", { catalogCampo: "mineral_tipo" }),
      f("elemento", "Afinidad elemental", "combobox", "Identidad", { catalogCampo: "mineral_elemento", hint: "Pyro, Hydro, Cryo… (catálogo unificado)" }),
      f("origen", "Origen", "text", "Datos clave"),
      f("valorMonedaId", "Moneda de referencia", "reference", "Datos clave", { refTarget: "monedas" }),
      f("valorCantidad", "Valor (cantidad)", "number", "Datos clave", { hint: "p.ej. 250 (en la moneda elegida)" }),
      f("statDureza", "Dureza", "slider", "Gema (0-100)"),
      f("statPureza", "Pureza", "slider", "Gema (0-100)"),
      f("statConductividad", "Conductividad mágica", "slider", "Gema (0-100)"),
      f("statRareza", "Rareza", "slider", "Mercado (0-100)"),
      f("statValor", "Valor", "slider", "Mercado (0-100)"),
      f("statDemanda", "Demanda", "slider", "Mercado (0-100)"),
      f("statAbundancia", "Abundancia", "slider", "Mercado (0-100)"),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("propiedades", "Propiedades", "textarea", "Contenido"),
      f("usos", "Usos (prosa)", "textarea", "Contenido", { hint: "Los usos estructurados y artefactos se editan abajo" }),
    ],
  },
  conceptos: {
    key: "conceptos",
    singular: "Concepto",
    plural: "Conceptos",
    route: "/conceptos",
    icon: "Lightbulb",
    nameField: "nombre",
    hasImage: true,
    hasBanner: false,
    hasFicha: true,
    fields: [
      f("categoria", "Categoría", "combobox", "Identidad", { catalogCampo: "concepto_categoria" }),
      f("orden", "Orden", "number", "Identidad", { hint: "para ordenar el índice" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("contenido", "Contenido", "textarea", "Contenido", { rows: 10 }),
    ],
  },
  magia: {
    key: "magia",
    singular: "Fundamento de magia",
    plural: "Magia",
    route: "/magia",
    icon: "Sparkles",
    nameField: "nombre",
    hasImage: true,
    hasBanner: false,
    hasFicha: true,
    fields: [
      f("naturaleza", "Naturaleza", "combobox", "Identidad", {
        catalogCampo: "magia_naturaleza",
        hint: "Teoría: Fundamento · Concepto. Seleccionables: Tecnica · Tecnica Avanzada",
      }),
      f("tipo", "Tipo / escuela", "combobox", "Identidad", {
        catalogCampo: "magia_tipo",
        hint: "Solo técnicas: Elemental, Demoniaca…",
      }),
      f("subcategoria", "Elemento", "combobox", "Identidad", {
        catalogCampo: "magia_variante",
        hint: "Pyro, Hydro, Cryo, Electro, Geo, Dendro, Vento…",
      }),
      f("fundamentoPadreId", "Deriva de (fundamento)", "reference", "Identidad", { refTarget: "magia" }),
      f("orden", "Orden", "number", "Identidad", { hint: "para ordenar el índice" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("contenido", "Contenido", "textarea", "Contenido", { rows: 10 }),
    ],
  },
  misiones: {
    key: "misiones",
    singular: "Misión",
    plural: "Misiones",
    route: "/misiones",
    icon: "Swords",
    nameField: "nombre",
    hasImage: true,
    hasBanner: false,
    hasFicha: true,
    fields: [
      f("tipo", "Tipo", "combobox", "Identidad", { catalogCampo: "mision_tipo" }),
      f("nivelRiesgo", "Nivel de riesgo", "combobox", "Identidad", { catalogCampo: "mision_riesgo" }),
      f("estado", "Estado", "combobox", "Identidad", { catalogCampo: "mision_estado" }),
      f("rangoMinimo", "Rango mínimo", "combobox", "Identidad", { catalogCampo: "rango_aventurero" }),
      f("ubicacion", "Ubicación", "text", "Datos clave"),
      f("fechaLore", "Fecha (lore)", "text", "Datos clave"),
      f("personajeId", "Encargada por", "reference", "Datos clave", { refTarget: "personajes", hint: "personaje con ficha" }),
      f("encarganteNombre", "Encargante (sin ficha)", "text", "Datos clave", { hint: "si el encargante no tiene ficha" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("objetivo", "Objetivo", "textarea", "Contenido"),
      f("recompensa", "Recompensa", "textarea", "Contenido"),
    ],
  },
  timeline: {
    key: "timeline",
    singular: "Evento",
    plural: "Cronología",
    route: "/timeline",
    icon: "Clock",
    nameField: "titulo",
    nameLabel: "Título",
    hasImage: false,
    hasBanner: false,
    hasFicha: false,
    orderBy: "orden",
    fields: [
      f("fechaLore", "Fecha (lore)", "text", "Identidad", { required: true, hint: "obligatorio" }),
      f("importancia", "Importancia", "combobox", "Identidad", { catalogCampo: "timeline_importancia" }),
      f("categoria", "Categoría", "combobox", "Identidad", { catalogCampo: "timeline_categoria" }),
      f("capituloId", "Capítulo", "reference", "Datos clave", { refTarget: "capitulos" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
    ],
  },
  demonios: {
    key: "demonios",
    singular: "Lord demonio",
    plural: "Lords demonio",
    route: "/demonios",
    icon: "Flame",
    nameField: "nombre",
    hasImage: true,
    hasBanner: true,
    hasFicha: true,
    fields: [
      f("titulo", "Título", "text", "Identidad"),
      f("dominio", "Dominio", "combobox", "Identidad", { catalogCampo: "demonio_dominio" }),
      f("eraAparicion", "Era de aparición", "text", "Datos clave"),
      f("estado", "Estado", "combobox", "Datos clave", { catalogCampo: "demonio_estado" }),
      f("derrotadoPor", "Derrotado por", "text", "Datos clave"),
      f("descripcionFisica", "Descripción física", "textarea", "Contenido"),
      f("devilTrigger", "Devil Trigger", "textarea", "Contenido"),
      f("historia", "Historia", "textarea", "Contenido", { rows: 8 }),
      f("poderEspecial", "Poder especial", "textarea", "Contenido"),
    ],
  },
  artefactos: {
    key: "artefactos",
    singular: "Artefacto",
    plural: "Armas y Artefactos",
    route: "/artefactos",
    icon: "Sword",
    nameField: "nombre",
    hasImage: true,
    hasBanner: false,
    hasFicha: true,
    fields: [
      f("tipo", "Tipo", "combobox", "Identidad", { catalogCampo: "artefacto_tipo" }),
      f("variante", "Variante", "combobox", "Identidad", {
        catalogCampo: "arma_variante",
        dependsOn: { field: "tipo", equals: "Arma" },
        hint: "Solo para armas: Composición · Activación · Sincronización…",
      }),
      f("propietarioActual", "Propietario (texto)", "text", "Datos clave", { hint: "si no tiene ficha" }),
      f("propietarioId", "Propietario (ficha)", "reference", "Datos clave", { refTarget: "personajes" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("historia", "Historia", "textarea", "Contenido", { rows: 6 }),
      f("poderEspecial", "Poder especial", "textarea", "Contenido"),
    ],
  },
  economia: {
    key: "economia",
    singular: "Moneda",
    plural: "Sistema monetario",
    route: "/economia",
    icon: "Coins",
    nameField: "nombre",
    hasImage: true,
    hasBanner: false,
    hasFicha: false,
    fields: [
      f("denominacion", "Denominación", "text", "Identidad"),
      f("valorRelativo", "Valor relativo", "text", "Datos clave", { hint: "p.ej. 1 oro = 100 plata" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
    ],
  },
};

export function getEntidadConfig(key: string): EntidadConfig | undefined {
  return ENTIDADES[key];
}

export const ENTIDAD_KEYS = Object.keys(ENTIDADES);
