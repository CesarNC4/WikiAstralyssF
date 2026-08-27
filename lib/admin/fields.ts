/**
 * Configuración declarativa de entidades para el admin genérico.
 * Plano y client-safe (sin imports de servidor/Drizzle): describe cómo se
 * renderiza el formulario, la tabla y el preview de cada entidad simple.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  /** Desplegable de catálogo. */
  | "combobox"
  /** Varios valores del mismo catálogo (columna de lista en la base). */
  | "multi"
  /** Desplegable alimentado por la tabla `elementos`, agrupado por familia. */
  | "elemento"
  | "checkbox"
  | "reference"
  | "slider";

export type RefTarget =
  | "personajes"
  | "capitulos"
  | "magia"
  | "naciones"
  | "razas"
  | "monedas"
  | "regiones"
  | "locaciones";

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
  /**
   * Nombre del campo cuyo valor decide qué opciones se ofrecen aquí: la variante
   * de un artefacto depende de su tipo, y el subtipo de una relación de su tipo.
   * El valor del campo padre se compara con el `grupo` del catálogo.
   */
  dependeDe?: string;
  /**
   * Para `elemento`: familia a la que se limita el desplegable. Si en
   * `dependeDe` se pasa otro campo, la familia sale de la escuela elegida allí.
   */
  familia?: string;
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
  /** Nota informativa que se muestra arriba del formulario (p.ej. "la geometría se edita en el Mapa"). */
  nota?: string;
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
      f("elementoFundamental", "Elemento fundamental", "elemento", "Datos clave"),
      f("conceptoDivino", "Concepto divino", "text", "Datos clave"),
      f("diosFundador", "Dios fundador", "text", "Datos clave"),
      f("clima", "Clima", "combobox", "Geografía", { catalogCampo: "clima" }),
      f("terreno", "Terreno", "multi", "Geografía", { catalogCampo: "terreno", hint: "Una nación puede ser montañosa y costera a la vez." }),
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
  regiones: {
    key: "regiones",
    singular: "Región",
    plural: "Regiones",
    route: "/regiones",
    icon: "MapPinned",
    nameField: "nombre",
    hasImage: true,
    hasBanner: true,
    hasFicha: true,
    nota: "🗺️ El contorno en el mapa y el color se editan en el Mapa. La nación a la que pertenece se detecta sola por la geometría.",
    fields: [
      f("subtitulo", "Subtítulo", "text", "Identidad"),
      f("tipo", "Tipo", "combobox", "Identidad", { catalogCampo: "region_tipo" }),
      f("estado", "Control", "combobox", "Identidad", { catalogCampo: "region_estado" }),
      f("clima", "Clima", "combobox", "Geografía", { catalogCampo: "clima", hint: "Puede ser distinto al de su nación." }),
      f("terreno", "Terreno", "multi", "Geografía", { catalogCampo: "terreno" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("historia", "Historia", "textarea", "Contenido", { rows: 8 }),
    ],
  },
  locaciones: {
    key: "locaciones",
    singular: "Locación",
    plural: "Locaciones",
    route: "/locaciones",
    icon: "MapPin",
    nameField: "nombre",
    hasImage: true,
    hasBanner: true,
    hasFicha: true,
    nota: "🗺️ El punto en el mapa y el evento de cronología se editan en el Mapa. La región y la nación se detectan solas por la posición.",
    fields: [
      f("subtitulo", "Subtítulo", "text", "Identidad"),
      f("tipo", "Tipo", "combobox", "Identidad", { catalogCampo: "locacion_tipo" }),
      f("escala", "Escala", "combobox", "Identidad", { catalogCampo: "locacion_escala", hint: "Decide a qué nivel de zoom aparece el pin en el mapa." }),
      f("estado", "Conservación", "combobox", "Datos clave", { catalogCampo: "locacion_estado" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
      f("historia", "Historia", "textarea", "Contenido", { rows: 8 }),
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
      f("estado", "Estado de la raza", "combobox", "Identidad", { catalogCampo: "raza_estado" }),
      f("rareza", "Frecuencia", "combobox", "Identidad", { catalogCampo: "rareza" }),
      f("subtitulo", "Subtítulo", "text", "Identidad"),
      f("razaPadreId", "Deriva de (raza padre)", "reference", "Identidad", { refTarget: "razas", hint: "para sub-razas / variantes / mestizajes" }),
      f("longevidad", "Longevidad", "combobox", "Datos clave", { catalogCampo: "raza_longevidad", hint: "El tramo sirve para filtrar; el detalle va en el campo de al lado." }),
      f("esperanzaVida", "Esperanza de vida (detalle)", "text", "Datos clave"),
      f("poblacionEstimada", "Población estimada", "text", "Datos clave"),
      f("dieta", "Dieta", "combobox", "Datos clave", { catalogCampo: "dieta" }),
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
      f("naturaleza", "Naturaleza", "combobox", "Identidad", { catalogCampo: "bestia_naturaleza", hint: "Qué es: bestia, no-muerta, constructo, aberración…" }),
      f("nivelAmenaza", "Nivel de amenaza", "combobox", "Datos clave", { catalogCampo: "bestia_nivel_amenaza" }),
      f("dieta", "Dieta", "combobox", "Datos clave", { catalogCampo: "dieta" }),
      f("tamano", "Tamaño", "combobox", "Datos clave", { catalogCampo: "bestia_tamano" }),
      f("comportamientoTipo", "Comportamiento", "combobox", "Datos clave", { catalogCampo: "bestia_comportamiento", hint: "El resumen; el detalle va en el texto de abajo." }),
      f("biomas", "Biomas", "multi", "Datos clave", { catalogCampo: "bestia_habitat" }),
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
      f("rareza", "Rareza", "combobox", "Identidad", { catalogCampo: "rareza" }),
      f("tipo", "Origen", "combobox", "Identidad", { catalogCampo: "mineral_tipo", hint: "De dónde sale: natural, arcano, disonante o sintético." }),
      f("composicion", "Composición", "combobox", "Identidad", { catalogCampo: "mineral_composicion", hint: "De qué está hecho." }),
      f("estadoFisico", "Estado físico", "combobox", "Datos clave", { catalogCampo: "mineral_estado_fisico" }),
      f("estado", "Disponibilidad", "combobox", "Datos clave", { catalogCampo: "mineral_estado" }),
      f("origen", "Origen (detalle)", "text", "Datos clave"),
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
      f("destacado", "Concepto clave", "checkbox", "Identidad", { hint: "Lo sube arriba del índice." }),
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
        hint: "Teoría: Fundamento · Concepto. Seleccionables: Técnica · Técnica Avanzada",
      }),
      f("tipo", "Tipo / escuela", "combobox", "Identidad", {
        catalogCampo: "magia_tipo",
        hint: "Elemental, Rúnica, Oscura, Ritual, Demoníaca, Antigua",
      }),
      // El elemento sale del catálogo elemental, filtrado por la familia que
      // corresponde a la escuela elegida arriba. Antes salían todos mezclados.
      f("subcategoria", "Elemento", "elemento", "Identidad", {
        dependeDe: "tipo",
        hint: "Depende de la escuela: Elemental da los siete, Antigua da Lumino y Umbra…",
      }),
      f("coste", "Coste / riesgo", "combobox", "Datos clave", { catalogCampo: "magia_coste" }),
      f("legalidad", "Legalidad", "combobox", "Datos clave", { catalogCampo: "magia_legalidad" }),
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
      f("tamanoGrupo", "Grupo recomendado", "combobox", "Identidad", { catalogCampo: "mision_grupo" }),
      // La ubicación enlazada hace que la misión aparezca sola en la ficha del
      // lugar; el texto queda para sitios que todavía no tienen ficha.
      f("ubicacionNacionId", "Nación", "reference", "Ubicación", { refTarget: "naciones" }),
      f("ubicacionRegionId", "Región", "reference", "Ubicación", { refTarget: "regiones" }),
      f("ubicacionLocacionId", "Locación", "reference", "Ubicación", { refTarget: "locaciones" }),
      f("ubicacion", "Ubicación (sin ficha)", "text", "Ubicación", { hint: "para lugares que aún no tienen ficha" }),
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
      f("fechaLore", "Fecha (lore)", "text", "Identidad", { hint: "p. ej. 'Año 1024' o 'Era de los Reyes'" }),
      f("era", "Era", "combobox", "Identidad", { catalogCampo: "era" }),
      f("anioLore", "Año", "number", "Identidad", { hint: "Solo el número, negativo si es antes del año cero. Sirve para ordenar." }),
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
      f("era", "Era de aparición", "combobox", "Datos clave", { catalogCampo: "era" }),
      f("anioLore", "Año", "number", "Datos clave", { hint: "Negativo si es antes del año cero." }),
      f("eraAparicion", "Era (detalle libre)", "text", "Datos clave"),
      f("estado", "Estado", "combobox", "Datos clave", { catalogCampo: "estado_vital" }),
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
      // Cada tipo tiene sus propias variantes: las de un arma no valen para una
      // armadura. El desplegable se filtra por el tipo elegido arriba.
      f("variante", "Variante", "combobox", "Identidad", {
        catalogCampo: "artefacto_variante",
        dependeDe: "tipo",
        hint: "Depende del tipo elegido.",
      }),
      f("rareza", "Rareza", "combobox", "Identidad", { catalogCampo: "rareza" }),
      f("propietarioId", "Propietario", "reference", "Datos clave", { refTarget: "personajes", hint: "Se refleja solo en la ficha del personaje." }),
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
      f("denominacion", "Denominación", "combobox", "Identidad", { catalogCampo: "moneda_denominacion" }),
      f("valorRelativo", "Valor relativo", "text", "Datos clave", { hint: "p.ej. 1 oro = 100 plata" }),
      f("descripcion", "Descripción", "textarea", "Contenido"),
    ],
  },
  // ── Narrativa ─────────────────────────────────────────────────────────────
  // Existían en la base y ya alimentaban partes visibles de la wiki (la sección
  // "Capítulos en los que aparece" de cada personaje sale de aquí), pero no
  // había ninguna pantalla para editarlas: sólo se podían tocar por base de datos.
  capitulos: {
    key: "capitulos",
    singular: "Capítulo",
    plural: "Capítulos",
    route: "/capitulos",
    icon: "BookOpen",
    nameField: "titulo",
    nameLabel: "Título",
    hasImage: false,
    hasBanner: false,
    hasFicha: true,
    orderBy: "numero",
    fields: [
      f("numero", "Número", "text", "Identidad", { required: true, hint: "admite '12', '12b' o 'Interludio'" }),
      f("libro", "Libro", "combobox", "Identidad", { catalogCampo: "libro" }),
      f("tipo", "Tipo", "combobox", "Identidad", { catalogCampo: "capitulo_tipo" }),
      f("tipoTemporal", "Tipo temporal", "combobox", "Datos clave", { catalogCampo: "tipo_temporal" }),
      f("marcoNarrativo", "Marco narrativo", "text", "Datos clave"),
      f("narradorPersonajeId", "Narrador (ficha)", "reference", "Datos clave", { refTarget: "personajes" }),
      f("narradorTipo", "Cómo narra", "combobox", "Datos clave", { catalogCampo: "narrador_tipo" }),
      f("narrador", "Narrador (sin ficha)", "text", "Datos clave", { hint: "si el narrador no tiene ficha" }),
      f("fechaLore", "Fecha (lore)", "text", "Datos clave"),
      f("paraleloACapituloId", "Paralelo al capítulo", "reference", "Datos clave", { refTarget: "capitulos" }),
      f("discordUrl", "Enlace en Discord", "text", "Datos clave"),
      f("descripcion", "Descripción", "textarea", "Contenido", { rows: 6 }),
      f("notasPrivadas", "Notas privadas", "textarea", "Contenido", { hint: "no se publican" }),
    ],
  },
  actos: {
    key: "actos",
    singular: "Acto",
    plural: "Actos",
    route: "/capitulos",
    icon: "Clapperboard",
    nameField: "nombre",
    hasImage: false,
    hasBanner: false,
    hasFicha: false,
    orderBy: "numeroOrden",
    fields: [
      f("capituloId", "Capítulo", "reference", "Identidad", { refTarget: "capitulos" }),
      f("numeroOrden", "Orden", "number", "Identidad"),
      f("estado", "Estado", "combobox", "Datos clave", { catalogCampo: "estado_narrativo" }),
      f("fechaInicioLore", "Inicio (lore)", "text", "Datos clave"),
      f("fechaFinLore", "Fin (lore)", "text", "Datos clave"),
      f("descripcion", "Descripción", "textarea", "Contenido", { rows: 6 }),
    ],
  },
  arcos: {
    key: "arcos",
    singular: "Arco",
    plural: "Arcos de trama",
    route: "/capitulos",
    icon: "Waypoints",
    nameField: "nombre",
    hasImage: false,
    hasBanner: false,
    hasFicha: false,
    orderBy: "orden",
    fields: [
      f("libro", "Libro", "combobox", "Identidad", { catalogCampo: "libro" }),
      f("tipo", "Tipo temporal", "combobox", "Identidad", { catalogCampo: "tipo_temporal", hint: "El mismo eje que usan los capítulos." }),
      f("color", "Color", "text", "Identidad", { hint: "hex, para distinguirlo en la trama" }),
      f("orden", "Orden", "number", "Identidad"),
      f("descripcion", "Descripción", "textarea", "Contenido", { rows: 6 }),
    ],
  },
  hojas: {
    key: "hojas",
    singular: "Hoja de trama",
    plural: "Hojas de trama",
    route: "/capitulos",
    icon: "FileText",
    nameField: "titulo",
    nameLabel: "Título",
    hasImage: false,
    hasBanner: false,
    hasFicha: false,
    orderBy: "orden",
    fields: [
      f("capituloId", "Capítulo", "reference", "Identidad", { refTarget: "capitulos" }),
      f("orden", "Orden", "number", "Identidad"),
      f("estado", "Estado", "combobox", "Identidad", { catalogCampo: "estado_narrativo" }),
      f("conflictoCentral", "Conflicto central", "textarea", "Contenido", { rows: 4 }),
      f("giroArgumental", "Giro argumental", "textarea", "Contenido", { rows: 4 }),
      f("secretosRevelados", "Secretos revelados", "textarea", "Contenido", { rows: 4 }),
      f("consecuencias", "Consecuencias", "textarea", "Contenido", { rows: 4 }),
      f("notasPrivadas", "Notas privadas", "textarea", "Contenido", { hint: "no se publican" }),
    ],
  },
  hilos: {
    key: "hilos",
    singular: "Hilo narrativo",
    plural: "Hilos narrativos",
    route: "/capitulos",
    icon: "Spline",
    nameField: "nombre",
    hasImage: false,
    hasBanner: false,
    hasFicha: false,
    orderBy: "orden",
    fields: [
      f("estado", "Estado", "combobox", "Identidad", { catalogCampo: "estado_narrativo" }),
      f("orden", "Orden", "number", "Identidad"),
      f("capituloAperturaId", "Capítulo de apertura", "reference", "Datos clave", { refTarget: "capitulos" }),
      f("capituloCierreId", "Capítulo de cierre", "reference", "Datos clave", { refTarget: "capitulos" }),
      f("descripcion", "Descripción", "textarea", "Contenido", { rows: 5 }),
      f("personajesInvolucrados", "Personajes involucrados", "textarea", "Contenido"),
      f("pistasEntregadas", "Pistas entregadas", "textarea", "Contenido"),
      f("notasAutor", "Notas del autor", "textarea", "Contenido", { hint: "no se publican" }),
    ],
  },
  canciones: {
    key: "canciones",
    singular: "Canción",
    plural: "Canciones",
    route: "/capitulos",
    icon: "Music",
    nameField: "titulo",
    nameLabel: "Título",
    hasImage: true,
    hasBanner: false,
    hasFicha: false,
    fields: [
      f("artista", "Artista", "text", "Identidad"),
      f("tipoFuente", "Fuente", "combobox", "Datos clave", { catalogCampo: "cancion_fuente" }),
      f("uso", "Uso", "combobox", "Identidad", { catalogCampo: "cancion_uso", hint: "Tema de personaje, de batalla, ambiente…" }),
      f("url", "Enlace", "text", "Datos clave"),
      f("notas", "Notas", "textarea", "Contenido"),
    ],
  },
  elementos: {
    key: "elementos",
    singular: "Elemento",
    plural: "Elementos",
    route: "/compendio",
    icon: "Sparkles",
    nameField: "nombre",
    hasImage: false,
    hasBanner: false,
    hasFicha: false,
    orderBy: "orden",
    nota: "Catálogo compartido: estos elementos alimentan las afinidades, debilidades y resistencias de todas las fichas.",
    fields: [
      f("slug", "Slug", "text", "Identidad", { required: true, hint: "identificador estable, en minúsculas" }),
      f("familia", "Familia", "combobox", "Identidad", {
        catalogCampo: "elemento_familia",
        hint: "Agrupa el desplegable, filtra en la web y decide qué variantes ofrece cada escuela de magia.",
      }),
      f("color", "Color", "text", "Identidad", { hint: "hex, p. ej. #7b5cff" }),
      f("icono", "Icono", "text", "Identidad", { hint: "nombre de lucide-react" }),
      f("orden", "Orden", "number", "Identidad"),
      f("descripcion", "Descripción", "textarea", "Contenido"),
    ],
  },
};

export function getEntidadConfig(key: string): EntidadConfig | undefined {
  return ENTIDADES[key];
}
