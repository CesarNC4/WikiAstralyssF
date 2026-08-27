/**
 * Nombres legibles de los catálogos y dónde se usa cada uno.
 *
 * Client-safe a propósito: la pantalla de catálogos lo usa para explicar a qué
 * afecta tocar una lista, y ese aviso importa — renombrar "Raro" cambia el texto
 * en minerales, artefactos y razas a la vez.
 */

export interface EtiquetaCatalogo {
  titulo: string;
  descripcion?: string;
}

export const ETIQUETAS_CATALOGO: Record<string, EtiquetaCatalogo> = {
  // ── Compartidos ──────────────────────────────────────────────────────────
  rareza: {
    titulo: "Rareza",
    descripcion: "Una sola escala para toda la web, para que los colores y filtros signifiquen lo mismo en todas partes.",
  },
  estado_vital: {
    titulo: "Estado vital",
    descripcion: "Sirve para personas, lords demonio y miembros del árbol genealógico.",
  },
  dieta: { titulo: "Dieta", descripcion: "Compartida por razas y bestias." },
  clima: { titulo: "Clima", descripcion: "Naciones y regiones. Una región puede tener clima propio." },
  terreno: { titulo: "Terreno", descripcion: "Varios por ficha: una nación puede ser montañosa y costera." },
  era: { titulo: "Eras del mundo", descripcion: "Lords demonio y cronología. Rellénala con tu lore." },
  libro: { titulo: "Libros", descripcion: "Capítulos y arcos." },
  tipo_temporal: { titulo: "Tipo temporal", descripcion: "Capítulos y arcos: presente, flashback, paralelo…" },
  estado_narrativo: {
    titulo: "Flujo de escritura",
    descripcion: "El estado de actos, hojas de trama e hilos narrativos.",
  },
  rango_aventurero: { titulo: "Rango aventurero", descripcion: "Personajes y rango mínimo de misiones." },

  // ── Personajes ───────────────────────────────────────────────────────────
  genero: { titulo: "Género" },
  nivel_consciencia: { titulo: "Nivel de consciencia" },
  tipo_invocacion: { titulo: "Tipo de invocación" },
  ocupacion: { titulo: "Ocupación", descripcion: "El matiz va en el campo de detalle de cada ficha." },
  habilidad_categoria: { titulo: "Categoría de habilidad", descripcion: "Agrupa las habilidades en la ficha pública." },
  tipo_relacion: { titulo: "Tipo de relación", descripcion: "Los pares como Mentor/Aprendiz se reflejan solos en la otra ficha." },
  subtipo_relacion: { titulo: "Subtipo de relación", descripcion: "Depende del tipo: cada tipo tiene los suyos." },
  afecto: {
    titulo: "Afecto",
    descripcion: "Lo que siente cada lado, por separado: A puede sentir amor y B odio.",
  },
  nacion_rol: { titulo: "Rol en una nación" },
  org_rol: { titulo: "Rol en una organización" },

  // ── Magia ────────────────────────────────────────────────────────────────
  magia_naturaleza: { titulo: "Naturaleza de la magia" },
  magia_tipo: { titulo: "Escuela de magia", descripcion: "Decide qué familia de elementos ofrece la variante." },
  magia_coste: { titulo: "Coste de la magia" },
  magia_legalidad: { titulo: "Legalidad de la magia" },

  // ── Mundo ────────────────────────────────────────────────────────────────
  nacion_gobierno: { titulo: "Formas de gobierno" },
  region_tipo: { titulo: "Tipo de región" },
  region_estado: { titulo: "Control de la región" },
  locacion_tipo: { titulo: "Tipo de locación" },
  locacion_estado: { titulo: "Conservación de la locación" },
  locacion_escala: { titulo: "Escala de asentamiento", descripcion: "Decide a qué nivel de zoom sale el pin en el mapa." },
  raza_clasificacion: { titulo: "Clasificación de razas" },
  raza_estado: { titulo: "Estado de la raza" },
  raza_longevidad: { titulo: "Longevidad de la raza" },
  bestia_naturaleza: { titulo: "Naturaleza de la bestia" },
  bestia_nivel_amenaza: { titulo: "Nivel de amenaza", descripcion: "La misma escala de letras que el riesgo de misiones." },
  bestia_tamano: { titulo: "Tamaño de la bestia" },
  bestia_comportamiento: { titulo: "Comportamiento de la bestia" },
  bestia_habitat: { titulo: "Biomas", descripcion: "Varios por bestia." },
  mineral_tipo: { titulo: "Origen del mineral" },
  mineral_composicion: { titulo: "Composición del mineral" },
  mineral_estado: { titulo: "Disponibilidad del mineral" },
  mineral_estado_fisico: { titulo: "Estado físico del mineral" },
  mineral_uso: { titulo: "Usos de un mineral" },
  concepto_categoria: { titulo: "Categoría de concepto" },
  mision_tipo: { titulo: "Tipo de misión" },
  mision_riesgo: { titulo: "Riesgo de la misión" },
  mision_estado: { titulo: "Estado de la misión" },
  mision_grupo: { titulo: "Grupo recomendado" },
  demonio_dominio: { titulo: "Dominio de un lord demonio" },
  familia_origen: { titulo: "Origen de la familia", descripcion: "De dónde viene; dónde está hoy es el estatus." },
  familia_estatus: { titulo: "Estatus de la familia" },
  org_tipo: { titulo: "Tipo de organización", descripcion: "Agrupado por familias, que sirven de filtro en la web." },
  org_estado: { titulo: "Estado de la organización", descripcion: "Vitalidad; si es clandestina o no, va en legalidad." },
  org_legalidad: { titulo: "Legalidad de la organización" },
  elemento_familia: { titulo: "Familias elementales", descripcion: "Los elementos en sí se editan en su propia sección." },

  // ── Narrativa y medios ───────────────────────────────────────────────────
  capitulo_tipo: { titulo: "Tipo de capítulo" },
  narrador_tipo: { titulo: "Cómo narra el narrador" },
  cancion_fuente: { titulo: "Fuente de la canción" },
  cancion_uso: { titulo: "Uso de la canción" },
  moneda_denominacion: { titulo: "Denominación de moneda" },
  lore_seccion_tipo: { titulo: "Tipo de sección de lore" },
  timeline_importancia: { titulo: "Importancia del evento" },
  timeline_categoria: { titulo: "Categoría del evento", descripcion: "Agrupada por familias, que sirven de filtro." },
  artefacto_tipo: { titulo: "Tipo de artefacto" },
  artefacto_variante: { titulo: "Variante de artefacto", descripcion: "Depende del tipo: cada tipo tiene las suyas." },

  // ── Vínculos entre fichas ────────────────────────────────────────────────
  vinculo_nacion_nacion: { titulo: "Vínculo Nación ↔ Nación" },
  vinculo_bestia_bestia: { titulo: "Vínculo Bestia ↔ Bestia" },
  vinculo_personaje_bestia: { titulo: "Vínculo Personaje ↔ Bestia" },
  vinculo_entidad_elemento: { titulo: "Vínculo Ficha ↔ Elemento" },
  vinculo_personaje_locacion: { titulo: "Vínculo Personaje ↔ Locación" },
  vinculo_mision_bestia: { titulo: "Vínculo Misión ↔ Bestia" },
  vinculo_mision_locacion: { titulo: "Vínculo Misión ↔ Locación" },
  vinculo_mision_organizacion: { titulo: "Vínculo Misión ↔ Organización" },
  vinculo_org_org: { titulo: "Vínculo Organización ↔ Organización" },
  vinculo_familia_nacion: { titulo: "Vínculo Familia ↔ Nación" },
  vinculo_familia_organizacion: { titulo: "Vínculo Familia ↔ Organización" },
  vinculo_org_locacion: { titulo: "Vínculo Organización ↔ Locación" },
  vinculo_drop_rareza: { titulo: "Rareza de un drop" },
};

/** Qué fichas leen de cada catálogo, en lenguaje llano. */
export const USOS_LEGIBLES: Record<string, string[]> = {
  rareza: ["Minerales", "Artefactos", "Razas", "Drops de bestias"],
  estado_vital: ["Personajes", "Lords demonio", "Árbol genealógico"],
  dieta: ["Razas", "Bestias"],
  clima: ["Naciones", "Regiones"],
  terreno: ["Naciones", "Regiones"],
  era: ["Lords demonio", "Cronología"],
  libro: ["Capítulos", "Arcos"],
  tipo_temporal: ["Capítulos", "Arcos"],
  estado_narrativo: ["Actos", "Hojas de trama", "Hilos narrativos"],
  rango_aventurero: ["Personajes", "Misiones"],
  afecto: ["Relaciones entre personajes"],

  genero: ["Personajes"],
  nivel_consciencia: ["Personajes"],
  tipo_invocacion: ["Personajes"],
  ocupacion: ["Personajes"],
  habilidad_categoria: ["Habilidades"],
  tipo_relacion: ["Relaciones entre personajes"],
  subtipo_relacion: ["Relaciones entre personajes"],
  nacion_rol: ["Personajes"],
  org_rol: ["Organizaciones"],

  magia_naturaleza: ["Magia"],
  magia_tipo: ["Magia"],
  magia_coste: ["Magia"],
  magia_legalidad: ["Magia"],

  nacion_gobierno: ["Naciones"],
  region_tipo: ["Regiones"],
  region_estado: ["Regiones"],
  locacion_tipo: ["Locaciones"],
  locacion_estado: ["Locaciones"],
  locacion_escala: ["Locaciones", "Mapa"],
  raza_clasificacion: ["Razas"],
  raza_estado: ["Razas"],
  raza_longevidad: ["Razas"],
  bestia_naturaleza: ["Bestias"],
  bestia_nivel_amenaza: ["Bestias"],
  bestia_tamano: ["Bestias"],
  bestia_comportamiento: ["Bestias"],
  bestia_habitat: ["Bestias"],
  mineral_tipo: ["Minerales"],
  mineral_composicion: ["Minerales"],
  mineral_estado: ["Minerales"],
  mineral_estado_fisico: ["Minerales"],
  mineral_uso: ["Minerales"],
  concepto_categoria: ["Conceptos"],
  mision_tipo: ["Misiones"],
  mision_riesgo: ["Misiones"],
  mision_estado: ["Misiones"],
  mision_grupo: ["Misiones"],
  demonio_dominio: ["Lords demonio"],
  familia_origen: ["Familias"],
  familia_estatus: ["Familias"],
  org_tipo: ["Organizaciones"],
  org_estado: ["Organizaciones"],
  org_legalidad: ["Organizaciones"],
  elemento_familia: ["Elementos"],

  capitulo_tipo: ["Capítulos"],
  narrador_tipo: ["Capítulos"],
  cancion_fuente: ["Canciones"],
  cancion_uso: ["Canciones"],
  moneda_denominacion: ["Economía"],
  lore_seccion_tipo: ["Páginas de lore"],
  timeline_importancia: ["Cronología"],
  timeline_categoria: ["Cronología"],
  artefacto_tipo: ["Artefactos"],
  artefacto_variante: ["Artefactos"],
};

/**
 * Dónde se usa cada catálogo: [tabla, columna].
 *
 * Es lo que permite renombrar sin romper fichas. Un catálogo compartido aparece
 * en varias filas — es justo la gracia de compartirlo.
 */
export const USOS_DE_CATALOGO: Record<string, [string, string][]> = {
  rareza: [["minerales", "rareza"], ["armas_artefactos", "rareza"], ["razas", "rareza"], ["bestia_drop", "rareza"]],
  estado_vital: [["personajes", "estado_vital"], ["lord_demonio", "estado"], ["familia_arbol", "estado"]],
  dieta: [["razas", "dieta"], ["bestias", "dieta"]],
  clima: [["naciones", "clima"], ["regiones", "clima"]],
  era: [["lord_demonio", "era"], ["timeline_eventos", "era"]],
  libro: [["capitulos", "libro"], ["trama_arcos", "libro"]],
  tipo_temporal: [["capitulos", "tipo_temporal"], ["trama_arcos", "tipo"]],
  estado_narrativo: [["actos", "estado"], ["trama_hojas", "estado"], ["hilo_narrativo", "estado"]],
  rango_aventurero: [["personajes", "rango_aventurero"], ["misiones", "rango_minimo"]],

  genero: [["personajes", "genero"]],
  nivel_consciencia: [["personajes", "nivel_de_consciencia"]],
  tipo_invocacion: [["personajes", "tipo_invocacion"]],
  ocupacion: [["personajes", "ocupacion"]],
  habilidad_categoria: [["habilidades", "categoria"]],
  tipo_relacion: [["relaciones", "tipo_relacion"]],
  subtipo_relacion: [["relaciones", "subtipo_relacion"]],
  afecto: [["relaciones", "afecto"], ["relaciones", "afecto_reciproco"]],
  nacion_rol: [["personaje_nacion", "tipo"]],
  org_rol: [["org_jerarquia", "rol"]],

  magia_naturaleza: [["magia_fundamentos", "naturaleza"]],
  magia_tipo: [["magia_fundamentos", "tipo"]],
  magia_coste: [["magia_fundamentos", "coste"]],
  magia_legalidad: [["magia_fundamentos", "legalidad"]],

  timeline_importancia: [["timeline_eventos", "importancia"]],
  timeline_categoria: [["timeline_eventos", "categoria"]],

  nacion_gobierno: [["naciones", "gobierno"]],
  region_tipo: [["regiones", "tipo"]],
  region_estado: [["regiones", "estado"]],
  locacion_tipo: [["locaciones", "tipo"]],
  locacion_estado: [["locaciones", "estado"]],
  locacion_escala: [["locaciones", "escala"]],

  raza_clasificacion: [["razas", "clasificacion"]],
  raza_estado: [["razas", "estado"]],
  raza_longevidad: [["razas", "longevidad"]],

  bestia_naturaleza: [["bestias", "naturaleza"]],
  bestia_nivel_amenaza: [["bestias", "nivel_amenaza"]],
  bestia_tamano: [["bestias", "tamano"]],
  bestia_comportamiento: [["bestias", "comportamiento_tipo"]],

  mineral_tipo: [["minerales", "tipo"]],
  mineral_composicion: [["minerales", "composicion"]],
  mineral_estado: [["minerales", "estado"]],
  mineral_estado_fisico: [["minerales", "estado_fisico"]],
  mineral_uso: [["mineral_uso", "nombre"]],

  concepto_categoria: [["conceptos", "categoria"]],

  mision_tipo: [["misiones", "tipo"]],
  mision_riesgo: [["misiones", "nivel_riesgo"]],
  mision_estado: [["misiones", "estado"]],
  mision_grupo: [["misiones", "tamano_grupo"]],

  demonio_dominio: [["lord_demonio", "dominio"]],

  familia_origen: [["familias", "origen"]],
  familia_estatus: [["familias", "estatus"]],

  org_tipo: [["organizaciones", "tipo"]],
  org_estado: [["organizaciones", "estado"]],
  org_legalidad: [["organizaciones", "legalidad"]],

  capitulo_tipo: [["capitulos", "tipo"]],
  narrador_tipo: [["capitulos", "narrador_tipo"]],

  cancion_fuente: [["canciones", "tipo_fuente"]],
  cancion_uso: [["canciones", "uso"]],

  moneda_denominacion: [["sistema_monetario", "denominacion"]],
  lore_seccion_tipo: [["pagina_secciones", "tipo"]],

  artefacto_tipo: [["armas_artefactos", "tipo"]],
  artefacto_variante: [["armas_artefactos", "variante"]],

  // Los vínculos entre fichas guardan su matiz en la tabla genérica o en la suya.
  vinculo_nacion_nacion: [["nacion_diplomacia", "tipo"]],
  vinculo_bestia_bestia: [["bestia_relacion", "tipo"]],
  vinculo_entidad_elemento: [["entidad_elemento", "relacion"]],
  vinculo_drop_rareza: [["bestia_drop", "rareza"]],
};
