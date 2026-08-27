/**
 * SEMILLA de los catálogos del admin.
 *
 * La fuente de verdad es la tabla `catalogos` y se edita desde /admin/catalogos.
 * Este archivo solo siembra la base la primera vez y sirve de referencia de qué
 * listas existen:
 *
 *     node --env-file=.env.local scripts/seed-catalogos.mjs
 *
 * Reglas:
 *  - El orden del array ES el orden en que aparecen en los desplegables.
 *  - El seed es ADITIVO: no borra lo que hayas añadido desde el panel. Antes era
 *    un espejo estricto, y eso habría hecho inservible la pantalla de catálogos.
 *  - Los desplegables permiten escribir un valor nuevo: se guarda aquí mismo.
 *  - El catálogo elemental NO vive aquí: vive en la tabla `elementos`, que además
 *    tiene color e icono y recibe vínculos de fichas. Ver `lib/elementos.ts`.
 */

/** Catálogos simples: campo → valores (en orden). */
export const CATALOGOS = {
  // ── Compartidos por varias fichas ─────────────────────────────────────────
  /** Minerales, artefactos y frecuencia de razas. Una sola escala en toda la web. */
  rareza: ["Común", "Poco común", "Raro", "Épico", "Legendario", "Mítico", "Único"],
  /** Personajes, árbol genealógico y lords demonio. */
  estado_vital: ["Vivo", "Fallecido", "Derrotado", "Sellado", "Desaparecido", "Exiliado", "Repudiado", "No-muerto", "Renacido", "Desconocido"],
  /** Razas y bestias comparten dieta. */
  dieta: ["Carnívoro", "Herbívoro", "Omnívoro", "Carroñero", "Frugívoro", "Hematófago", "Energía mágica", "Almas", "No se alimenta"],
  /** Naciones y regiones. */
  clima: ["Templado", "Continental", "Árido", "Desértico", "Tropical", "Subtropical", "Polar", "Alpino", "Volcánico", "Pantanoso", "Oceánico", "Antaño mágico / Distorsionado", "Variable"],
  /** Naciones y regiones. Selección múltiple. */
  terreno: ["Montañoso", "Costero", "Boscoso", "Selvático", "Desértico", "Llanura", "Estepa", "Insular", "Pantanoso", "Volcánico", "Subterráneo", "Flotante / Aéreo", "Helado", "Mixto"],
  /** Eras del mundo. Lords demonio, cronología y capítulos. Rellénalo con tu lore. */
  era: ["Era Primordial", "Era de los Dioses", "Era Antigua", "Era Actual"],
  /** Libros de la obra. Capítulos y arcos. */
  libro: ["Astralys"],
  /** Capítulos y arcos. */
  tipo_temporal: ["Presente", "Pasado", "Futuro", "Flashback", "Flashforward", "Paralelo", "Atémporal", "Sueño / Visión"],
  /** Flujo de escritura: actos, hojas de trama e hilos narrativos. */
  estado_narrativo: ["Idea", "Esbozo", "En desarrollo", "Escrito", "Revisado", "Completado", "Publicado", "En pausa", "Descartado"],

  // ── Personajes ────────────────────────────────────────────────────────────
  genero: ["Femenino", "Masculino", "No binario", "Sin género", "Fluido", "Desconocido"],
  rango_aventurero: ["Sin rango", "Amateur", "Bronce", "Plata", "Oro", "Platino", "Rubí", "Esmeralda", "Diamante", "Dragonita", "Retirado", "Expulsado"],
  nivel_consciencia: ["D (Latente)", "C (Despierto)", "B (Consciente)", "A (Pleno)", "S (Trascendente)"],
  tipo_invocacion: ["Natural", "Ishkoriana", "Desconocida"],
  ocupacion: ["Aventurero", "Caballero", "Mago", "Erudito / Escriba", "Comerciante", "Artesano", "Sacerdote", "Noble", "Gobernante", "Soldado", "Asesino", "Ladrón", "Bardo", "Sanador", "Herrero", "Cazador", "Granjero", "Sin ocupación"],

  // ── Habilidades ──────────────────────────────────────────────────────────
  habilidad_categoria: ["Técnica", "Técnica Avanzada", "Técnica Suprema", "Habilidad pasiva", "Habilidad innata", "Maldición", "Don divino", "Arte marcial"],

  // ── Relaciones entre personajes ──────────────────────────────────────────
  tipo_relacion: [
    "Aliado", "Rival", "Amigo", "Enemigo", "Familiar", "Compañero", "Amante", "Prometido",
    "Mentor", "Aprendiz", "Superior", "Subordinado", "Protector", "Protegido",
    "Creador", "Creación", "Salvador", "Salvado", "Deudor", "Acreedor", "Captor", "Cautivo",
    "Ex-aliado", "Traidor", "Desconocido", "Otro",
  ],
  /**
   * Eje de sentimiento, independiente en cada lado: A puede sentir amor y B odio.
   * Por eso NO entra en el reflejo recíproco.
   */
  afecto: ["Amistad", "Amor", "Respeto", "Admiración", "Indiferencia", "Rivalidad", "Odio", "Miedo", "Culpa", "Complicado"],

  // ── Pertenencias del personaje ───────────────────────────────────────────
  nacion_rol: ["Ciudadano", "Nacido allí", "Noble", "Gobernante", "Fundador", "Diplomático", "Forastero", "Refugiado", "Exiliado", "Prisionero", "Traidor", "Desaparecido", "Otro"],
  org_rol: ["Miembro", "Iniciado", "Recluta", "Oficial", "Veterano", "Maestro", "Consejero", "Líder", "Fundador", "Honorario", "Aliado", "Infiltrado", "Desertor", "Expulsado", "Caído", "Otro"],

  // ── Magia ────────────────────────────────────────────────────────────────
  magia_naturaleza: ["Fundamento", "Concepto", "Técnica", "Técnica Avanzada"],
  magia_tipo: ["Elemental", "Rúnica", "Oscura", "Ritual", "Demoníaca", "Antigua"],
  magia_coste: ["Nulo", "Bajo", "Moderado", "Alto", "Extremo", "Mortal", "Precio oculto"],
  magia_legalidad: ["Libre", "Regulada", "Restringida a una orden", "Prohibida", "Herejía", "Perdida"],

  // ── Cronología ───────────────────────────────────────────────────────────
  timeline_importancia: ["Anécdota", "Menor", "Normal", "Mayor", "Crítico", "Definitorio"],

  // ── Naciones ─────────────────────────────────────────────────────────────
  nacion_gobierno: ["Monarquía", "Imperio", "República", "Confederación", "Teocracia", "Oligarquía", "Magocracia", "Consejo de eruditos", "Tribal / Clanes", "Meritocracia", "Anarquía", "Dominio demónico", "Otro"],

  // ── Regiones ─────────────────────────────────────────────────────────────
  region_tipo: ["Provincia", "Reino vasallo", "Territorio libre", "Frontera", "Tierra salvaje", "Zona prohibida", "Dominio mágico", "Ruinas antiguas", "Mar / Océano", "Otro"],
  region_estado: ["Estable", "En disputa", "Ocupada", "En guerra", "Deshabitada", "Cuarentena", "Desconocido"],

  // ── Locaciones ───────────────────────────────────────────────────────────
  locacion_tipo: ["Ciudad", "Pueblo / Aldea", "Capital", "Fortaleza", "Templo / Santuario", "Academia", "Mazmorra", "Ruina", "Punto de interés", "Campo de batalla", "Puerto", "Refugio", "Otro"],
  locacion_estado: ["En pie", "Próspera", "En decadencia", "En ruinas", "Destruida", "Abandonada", "Perdida / Ilocalizable", "Sellada", "Reconstruida"],
  /** Filtra qué pines se ven en la capa de locaciones del mapa. */
  locacion_escala: ["Aldea", "Pueblo", "Villa", "Ciudad", "Gran ciudad", "Metrópolis", "Capital"],

  // ── Razas ────────────────────────────────────────────────────────────────
  raza_clasificacion: ["Primordiales", "Alteradas por el Maná", "Corruptas o Malditas", "Espirituales o Místicas", "Artificiales"],
  raza_estado: ["Floreciente", "Estable", "En declive", "Al borde de la extinción", "Extinta", "Sellada", "Desconocido"],
  raza_longevidad: ["Efímera (menos de 10)", "Corta (10-50)", "Humana (50-120)", "Larga (120-500)", "Milenaria (500-5000)", "Inmortal", "Desconocida"],

  // ── Bestias ──────────────────────────────────────────────────────────────
  bestia_naturaleza: ["Bestia", "Magia", "No-muerta", "Elemental", "Demónica", "Constructo", "Aberración", "Espíritu"],
  bestia_nivel_amenaza: ["E", "D", "C", "B", "A", "S", "SS", "SSS"],
  bestia_tamano: ["Diminuto (menos de 0,5 m)", "Pequeño (0,5-1,5 m)", "Mediano (1,5-3 m)", "Grande (3-8 m)", "Enorme (8-20 m)", "Colosal (20-100 m)", "Titánico (más de 100 m)"],
  bestia_comportamiento: ["Pacífica", "Territorial", "Agresiva", "Emboscadora", "Migratoria", "Nocturna", "Gregaria", "Solitaria", "Impredecible"],
  /** Selección múltiple. */
  bestia_habitat: ["Bosque", "Montaña", "Desierto", "Pantano", "Océano", "Río / Lago", "Subterráneo", "Cielo", "Volcánico", "Helado", "Ruinas", "Plano demónico", "Ubicua"],

  // ── Minerales ────────────────────────────────────────────────────────────
  mineral_tipo: ["Natural", "Arcano", "Disonante", "Sintético"],
  mineral_composicion: ["Metálico", "Cristalino", "Pétreo", "Orgánico", "Gaseoso", "Líquido", "Inmaterial"],
  mineral_estado: ["Abundante", "En explotación", "Escaso", "Agotado", "Prohibido", "Perdido", "Recién descubierto"],
  mineral_estado_fisico: ["Sólido", "Líquido", "Gaseoso", "Cristalino", "Plasmático", "Inmaterial"],
  /** Selección múltiple. */
  mineral_uso: ["Forja de armas", "Joyería", "Catálisis mágica", "Moneda", "Construcción", "Alquimia", "Ritual", "Combustible", "Medicina"],

  // ── Conceptos ────────────────────────────────────────────────────────────
  concepto_categoria: ["Cosmología", "Magia", "Historia", "Sociedad", "Religión", "Geografía", "Política", "Economía", "Tecnología", "Lengua", "Criatura", "Fenómeno", "Otro"],

  // ── Misiones ─────────────────────────────────────────────────────────────
  mision_tipo: ["Principal", "Secundaria", "Caza", "Escolta", "Recolección", "Exploración", "Rescate", "Investigación", "Asesinato", "Entrega", "Defensa", "Infiltración", "Diplomática", "Gremial", "Personal", "Otro"],
  mision_riesgo: ["E: Muy Bajo", "D: Bajo", "C: Moderado", "B: Alto", "A: Muy Alto", "S: Extremo", "SS: Catastrófico", "SSS: Existencial"],
  mision_estado: ["Borrador", "Disponible", "Aceptada", "En curso", "En pausa", "Completada", "Completada parcialmente", "Fallida", "Cancelada", "Expirada", "Secreta"],
  mision_grupo: ["En solitario", "Pareja", "Grupo pequeño (3-5)", "Escuadrón", "Ejército"],

  // ── Lords demonio ────────────────────────────────────────────────────────
  demonio_dominio: ["Destrucción", "Distorsión", "Control", "Aberración"],

  // ── Familias ─────────────────────────────────────────────────────────────
  familia_origen: ["Real", "Noble", "Plebeya", "Mercante", "Militar", "Religiosa", "Otro"],
  familia_estatus: ["En auge", "Consolidada", "Estable", "En declive", "Caída", "Extinta", "Exiliada"],

  // ── Organizaciones ───────────────────────────────────────────────────────
  org_estado: ["Activa", "En auge", "En declive", "Inactiva", "Disuelta"],
  org_legalidad: ["Oficial", "Tolerada", "Clandestina", "Proscrita"],

  // ── Narrativa ────────────────────────────────────────────────────────────
  capitulo_tipo: ["Prólogo", "Principal", "Secundario", "Interludio", "Flashback", "Especial", "Extra", "Epílogo"],
  narrador_tipo: ["Omnisciente", "Primera persona", "Tercera limitada", "Epistolar", "Múltiple", "Sin narrador"],

  // ── Canciones ────────────────────────────────────────────────────────────
  cancion_fuente: ["Local", "YouTube", "Spotify", "SoundCloud", "Bandcamp", "Suno", "Enlace externo"],
  cancion_uso: ["Tema principal", "Tema de personaje", "Tema de batalla", "Ambiente", "Créditos", "Tema de nación", "Tema de villano"],

  // ── Economía ─────────────────────────────────────────────────────────────
  moneda_denominacion: ["Baja", "Media", "Alta", "Suprema"],

  // ── Elementos ────────────────────────────────────────────────────────────
  /** Familias del catálogo elemental. Viven aquí porque son editables; los
   * elementos en sí viven en la tabla `elementos`. */
  elemento_familia: ["Elementales", "Antiguos", "Oscuros", "Sacros", "Sin elemento"],

  // ── Páginas de lore ──────────────────────────────────────────────────────
  lore_seccion_tipo: ["Texto", "Cita", "Tabla", "Lista", "Galería de imágenes", "Aviso / Nota", "Cronología", "Separador", "Ficha destacada", "Código"],

  // ── Vínculos entre fichas (antes fijos en lib/relaciones/registro.ts) ─────
  vinculo_nacion_nacion: ["Aliada", "Rival", "Neutral", "Vasalla", "Soberana", "En guerra"],
  vinculo_bestia_bestia: ["Depredador", "Presa", "Subespecie", "Especie madre", "Evolución", "Forma previa", "Simbiótica", "Rival"],
  vinculo_personaje_bestia: ["Montura", "Familiar", "Némesis", "Domesticada", "Cazador"],
  vinculo_entidad_elemento: ["Afinidad", "Debilidad", "Resistencia"],
  vinculo_personaje_locacion: ["Reside", "Nació", "Opera", "Murió", "Exiliado", "De paso"],
  vinculo_mision_bestia: ["Objetivo", "Amenaza", "Aliada"],
  vinculo_mision_locacion: ["Escenario", "Punto de partida", "Destino"],
  vinculo_mision_organizacion: ["Encarga", "Respalda", "Se opone"],
  vinculo_org_org: ["Aliada", "Rival", "Filial", "Matriz", "Escisión", "Origen", "Infiltrada"],
  vinculo_familia_nacion: ["Gobierna", "Nobleza", "Exiliada", "Originaria"],
  vinculo_familia_organizacion: ["Fundadora", "Financia", "Controla", "Enfrentada"],
  vinculo_org_locacion: ["Sede", "Cuartel", "Feudo", "Refugio", "Presencia"],
  vinculo_drop_rareza: ["Común", "Poco común", "Raro", "Épico", "Legendario", "Mítico", "Único"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Catálogos de DOS niveles: campo → grupo → valores.
 *
 * El grupo cumple dos papeles según el catálogo:
 *  - **Dependencia**: la variante de un artefacto depende de su tipo, y el
 *    subtipo de una relación depende del tipo de relación. Solo se ofrecen los
 *    valores del grupo elegido arriba.
 *  - **Agrupación**: en `org_tipo` y `timeline_categoria` todos los valores son
 *    elegibles siempre; el grupo solo los ordena en el desplegable y sirve de
 *    filtro en la web pública.
 */
export const CATALOGOS_AGRUPADOS = {
  /** Dependencia: variantes propias de cada tipo de artefacto. */
  artefacto_variante: {
    Arma: ["Composición", "Activación", "Sincronización", "Amplificación", "Ignición"],
    Armadura: ["Ligera", "Media", "Pesada", "Mágica"],
    Accesorio: ["Anillo", "Amuleto", "Capa", "Insignia", "Reliquia portátil"],
    Artefacto: ["Ritual", "Sello", "Contenedor", "Llave"],
    Consumible: ["Poción", "Elixir", "Pergamino", "Alimento", "Veneno"],
    Documento: ["Grimorio", "Mapa", "Carta", "Tratado", "Diario"],
    Herramienta: ["Forja", "Alquimia", "Medición", "Navegación"],
  },
  /** Dependencia: subtipos propios de cada tipo de relación. */
  subtipo_relacion: {
    Amigo: ["Cercano", "Mejor amigo", "Confidente", "De la infancia", "Distante"],
    Enemigo: ["Jurado", "Ocasional", "Por encargo", "Heredado"],
    Familiar: ["Padre", "Madre", "Hijo", "Hija", "Hermano", "Hermana", "Abuelo", "Abuela", "Tío", "Tía", "Primo", "Prima", "Adoptivo", "Político"],
    Aliado: ["De conveniencia", "Juramentado", "Circunstancial", "Secreto"],
    Rival: ["Deportivo", "Profesional", "Amistoso", "A muerte"],
    Compañero: ["De armas", "De viaje", "De gremio", "De celda"],
    Amante: ["Correspondido", "No correspondido", "Secreto", "Pasado"],
    Mentor: ["Formal", "Informal", "A distancia", "No reconocido"],
    Aprendiz: ["Formal", "Informal", "A distancia", "No reconocido"],
    Traidor: ["Descubierto", "Oculto", "Perdonado"],
  },
  /** Agrupación: familias de organización, para ordenar y filtrar. */
  org_tipo: {
    Militares: ["Orden", "Ejército", "Guardia", "Hermandad"],
    Mercantiles: ["Gremio", "Compañía", "Casa mercante", "Sindicato"],
    Religiosas: ["Culto", "Secta", "Iglesia", "Logia"],
    Académicas: ["Academia"],
    Criminales: ["Red criminal"],
    Políticas: ["Consejo", "Corte", "Clan", "Resistencia"],
    Otras: ["Otro"],
  },
  /** Agrupación: familias de evento, para ordenar y filtrar la cronología. */
  timeline_categoria: {
    Poder: ["Político", "Militar", "Económico"],
    Mundo: ["Cósmico", "Catástrofe", "Fundacional"],
    Cultura: ["Social", "Religioso", "Cultural", "Científico"],
    Personal: ["Nacimiento", "Muerte", "Traición"],
    Otros: ["Mágico", "Descubrimiento", "Otro"],
  },
} as const satisfies Record<string, Record<string, readonly string[]>>;

/**
 * Qué familia de elementos ofrece cada escuela de magia como variante.
 * Las escuelas que no aparecen aquí no tienen variante.
 * Las familias son las de la tabla `elementos`.
 */
export const MAGIA_FAMILIA_ELEMENTAL: Record<string, string> = {
  Elemental: "Elementales",
  Antigua: "Antiguos",
  Oscura: "Oscuros",
  Demoníaca: "Oscuros",
};

/**
 * Etiqueta inversa de una relación PJ↔PJ. Si A es "Mentor" de B, en la ficha de
 * B la relación se muestra como "Aprendiz" automáticamente. Los tipos no listados
 * aquí se consideran simétricos (misma etiqueta en ambos lados).
 *
 * El eje de afecto NO se invierte nunca: cada lado siente lo suyo.
 */
export const RELACION_INVERSA: Record<string, string> = {
  Mentor: "Aprendiz",
  Aprendiz: "Mentor",
  Superior: "Subordinado",
  Subordinado: "Superior",
  Protector: "Protegido",
  Protegido: "Protector",
  Creador: "Creación",
  Creación: "Creador",
  Salvador: "Salvado",
  Salvado: "Salvador",
  Deudor: "Acreedor",
  Acreedor: "Deudor",
  Captor: "Cautivo",
  Cautivo: "Captor",
  // Simétricos (Aliado, Rival, Amigo, Enemigo, Familiar, Amante, Compañero,
  // Prometido, Ex-aliado, Traidor, Desconocido, Otro) no necesitan entrada.
};

/** Devuelve la etiqueta a mostrar en el lado inverso de una relación. */
export function etiquetaInversa(tipo: string | null | undefined): string | null {
  if (!tipo) return tipo ?? null;
  return RELACION_INVERSA[tipo] ?? tipo;
}
