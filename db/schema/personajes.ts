import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { estadoPublicacion } from "./enums";

/**
 * Dominio Personajes (modelado contra el schema vivo actual).
 * La nullabilidad real de muchas columnas de texto es laxa; se modelan
 * como opcionales para que el render trate los NULL con seguridad.
 */

export const personajes = pgTable("personajes", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre").notNull(),
  surname: varchar("surname"),
  titulo: varchar("titulo"),
  edad: varchar("edad"),
  genero: varchar("genero"),
  altura: doublePrecision("altura"),
  /** Del catalogo; el matiz va en ocupacionDetalle. */
  ocupacion: varchar("ocupacion"),
  /** "Ex Princesa", "Escriba del Consejo": lo que la lista no puede recoger. */
  ocupacionDetalle: varchar("ocupacion_detalle"),
  /** Vivo, fallecido, sellado... Lo lee tambien el arbol genealogico. */
  estadoVital: varchar("estado_vital"),
  rangoAventurero: varchar("rango_aventurero"),
  lugarNacimiento: varchar("lugar_nacimiento"),
  // Lugar de nacimiento en 3 niveles (todos opcionales): nación → región → locación.
  lugarNacimientoNacionId: integer("lugar_nacimiento_nacion_id"),
  lugarNacimientoRegionId: integer("lugar_nacimiento_region_id"),
  lugarNacimientoLocacionId: integer("lugar_nacimiento_locacion_id"),
  historia: text("historia"),
  familia: varchar("familia"),
  rasgosPersonalidad: text("rasgos_personalidad"),
  motivacion: text("motivacion"),
  miedos: text("miedos"),
  filosofia: varchar("filosofia"),
  gustos: text("gustos"),
  disgustos: text("disgustos"),
  // Texto combinado "Tipo (Variante)" — alimenta la ficha pública y el enlace por nombre.
  tipoMagiaPrincipal: varchar("tipo_magia_principal"),
  magiaSecundaria: varchar("magia_secundaria"),
  // Estructurado (para edición limpia sin regex y filtros). Derivan el texto de arriba al guardar.
  magiaPrincipalTipo: varchar("magia_principal_tipo"),
  magiaPrincipalVariante: varchar("magia_principal_variante"),
  magiaSecundariaTipo: varchar("magia_secundaria_tipo"),
  magiaSecundariaVariante: varchar("magia_secundaria_variante"),
  nivelDeConsciencia: varchar("nivel_de_consciencia"),
  circuitoForte: varchar("circuito_forte"),
  essentia: varchar("essentia"),
  zenithra: varchar("zenithra"),
  bendicion: varchar("bendicion"),
  segundoDespertar: varchar("segundo_despertar"),
  debilidades: text("debilidades"),
  imagenUrl: varchar("imagen_url"),
  bannerUrl: varchar("banner_url"),
  imagenAssetId: integer("imagen_asset_id"),
  bannerAssetId: integer("banner_asset_id"),
  estadoPublicacion: estadoPublicacion("estado_publicacion").notNull().default("borrador"),
  publicadoPrimeraVezEn: timestamp("publicado_primera_vez_en", { mode: "date" }),
  esInvocado: boolean("es_invocado").default(false),
  tipoInvocacion: varchar("tipo_invocacion"),
  creadoEn: timestamp("creado_en", { mode: "date" }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { mode: "date" }).notNull().defaultNow(),
  eliminadoEn: timestamp("eliminado_en", { mode: "date" }),
});

export const estadisticas = pgTable("estadisticas", {
  idEstadistica: serial("id_estadistica").primaryKey(),
  personajeId: integer("personaje_id"),
  fuerza: integer("fuerza"),
  destreza: integer("destreza"),
  constitucion: integer("constitucion"),
  inteligencia: integer("inteligencia"),
  sabiduria: integer("sabiduria"),
  carisma: integer("carisma"),
  mpMax: integer("mp_max"),
  ataqueFisico: integer("ataque_fisico"),
  ataqueMagico: integer("ataque_magico"),
  defensaFisica: integer("defensa_fisica"),
  defensaMagica: integer("defensa_magica"),
  velocidad: integer("velocidad"),
  capacidadDeReaccion: integer("capacidad_de_reaccion"),
  rangoCuerpoACuerpo: varchar("rango_cuerpo_a_cuerpo"),
  rangoDistancia: varchar("rango_distancia"),
  danoMagico: varchar("daño_magico"),
  defensa: varchar("defensa"),
  apoyo: varchar("apoyo"),
  movilidad: varchar("movilidad"),
  controlDeMasas: varchar("control_de_masas"),
  precisionVal: integer("precision_val"),
  /** Poder de Combate: % derivado (promedio de primarios, combate y rangos). Se calcula al guardar. */
  poderDeCombate: integer("poder_de_combate"),
});

export const habilidades = pgTable("habilidades", {
  idHabilidad: serial("id_habilidad").primaryKey(),
  personajeId: integer("personaje_id"),
  categoria: varchar("categoria").notNull(),
  nombre: varchar("nombre"),
  descripcion: text("descripcion"),
  tipo: varchar("tipo"),
  magiaFundamentoId: integer("magia_fundamento_id"),
});

export const relaciones = pgTable("relaciones", {
  idRr: serial("id_rr").primaryKey(),
  personajeId: integer("personaje_id"),
  // Relación personaje↔personaje vía FK; `nombreExterno` sólo para entidades sin ficha (§1).
  personajeRelacionadoId: integer("personaje_relacionado_id"),
  nombreExterno: varchar("nombre_externo"),
  tipoRelacion: varchar("tipo_relacion"),
  descripcion: text("descripcion"),
  /** Depende de `tipoRelacion`: cada tipo tiene sus subtipos. */
  subtipoRelacion: varchar("subtipo_relacion"),
  /**
   * Que siente cada lado. Son dos columnas y no una porque el afecto NO es
   * reciproco: A puede sentir amor y B odio. `afecto` es lo que siente
   * `personajeId`; `afectoReciproco`, lo que siente el relacionado.
   */
  afecto: varchar("afecto"),
  afectoReciproco: varchar("afecto_reciproco"),
});

export const personajeNarrativa = pgTable("personaje_narrativa", {
  id: serial("id").primaryKey(),
  personajeId: integer("personaje_id"),
  estadoNarrativo: varchar("estado_narrativo"),
  tipoArco: varchar("tipo_arco"),
  desarrolloArco: text("desarrollo_arco"),
  destinoFinal: text("destino_final"),
  actoClaveId: integer("acto_clave_id"),
  capituloClaveId: integer("capitulo_clave_id"),
  secretosPendientes: text("secretos_pendientes"),
  revelacionIdentidad: text("revelacion_identidad"),
  relacionesOcultas: text("relaciones_ocultas"),
  notasAutor: text("notas_autor"),
  porcentajeEscrito: integer("porcentaje_escrito"),
});

