import { z } from "zod";

/**
 * Esquema del payload del formulario de personaje (§2.4).
 * Las entradas vienen de inputs (strings) → se normalizan: "" y undefined → null.
 * Solo `nombre` es obligatorio; el resto es opcional (coherente con la DB).
 */

const str = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    const t = typeof v === "string" ? v.trim() : "";
    return t.length > 0 ? t : null;
  });

const intField = (max?: number) =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    },
    (max != null ? z.number().int().min(0).max(max) : z.number().int().min(0)).nullable(),
  );

const boolField = z.preprocess(
  (v) => v === true || v === "true" || v === "on" || v === 1 || v === "1",
  z.boolean(),
);

const idField = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  },
  z.number().int().positive().nullable(),
);

export const estadoPublicacionSchema = z.enum(["borrador", "publicado", "oculto"]);

export const estadisticasSchema = z.object({
  fuerza: intField(100),
  destreza: intField(100),
  constitucion: intField(100),
  inteligencia: intField(100),
  sabiduria: intField(100),
  carisma: intField(100),
  mpMax: intField(),
  ataqueFisico: intField(),
  ataqueMagico: intField(),
  defensaFisica: intField(),
  defensaMagica: intField(),
  velocidad: intField(),
  capacidadDeReaccion: intField(),
  precisionVal: intField(),
  rangoCuerpoACuerpo: str,
  rangoDistancia: str,
  danoMagico: str,
  defensa: str,
  apoyo: str,
  movilidad: str,
  controlDeMasas: str,
});

/**
 * Habilidad del PJ: o se enlaza a un hechizo existente del catálogo Magia
 * (`magiaFundamentoId`), o se crea uno nuevo (`nuevaMagia`) que se guardará en
 * /magia. `descripcion` es la nota propia del personaje. `nombre`/`tipo` se
 * copian del hechizo elegido para el render rápido de la ficha.
 */
export const habilidadSchema = z.object({
  magiaFundamentoId: idField,
  nuevaMagia: z
    .object({
      nombre: z.string().trim().min(1, "El nombre de la habilidad es obligatorio"),
      tipo: str,
      subcategoria: str,
    })
    .nullable()
    .optional(),
  categoria: str,
  nombre: str,
  tipo: str,
  descripcion: str,
});

/**
 * Evento clave del PJ: vínculo a un evento de la cronología global
 * (`timelineEventoId`) o creación de uno nuevo (`nuevoEvento`) que se ubica en
 * la cronología. `nota` es la nota propia del personaje sobre ese evento.
 */
export const eventoSchema = z.object({
  timelineEventoId: idField,
  nuevoEvento: z
    .object({
      fechaLore: z.string().trim().min(1, "La fecha del evento es obligatoria"),
      titulo: z.string().trim().min(1, "El título del evento es obligatorio"),
      importancia: str,
      categoria: str,
      era: str,
    })
    .nullable()
    .optional(),
  nota: str,
});

/**
 * Objeto/arma/artefacto del PJ: vínculo al catálogo global Armas y Artefactos
 * (`armaArtefactoId`) o creación de uno nuevo (`nuevoObjeto`) que aparece en
 * /artefactos. `nota` es la nota propia del personaje.
 */
export const objetoSchema = z.object({
  armaArtefactoId: idField,
  nuevoObjeto: z
    .object({
      nombre: z.string().trim().min(1, "El nombre del objeto es obligatorio"),
      tipo: str,
      descripcion: str,
      poderEspecial: str,
    })
    .nullable()
    .optional(),
  nota: str,
});

export const relacionSchema = z.object({
  idRr: idField.optional(),
  personajeRelacionadoId: idField,
  nombreExterno: str,
  tipoRelacion: str,
  subtipoRelacion: str,
  descripcion: str,
});

export const personajeNacionSchema = z.object({
  nacionId: z.number().int().positive(),
  tipo: str,
  descripcion: str,
});

export const personajeRazaSchema = z.object({
  razaId: z.number().int().positive(),
  esMixta: boolField.optional(),
  nota: str,
});

export const personajeOrganizacionSchema = z.object({
  organizacionId: z.number().int().positive(),
  rol: str,
  tipo: str,
  descripcion: str,
});

export const personajeSchema = z.object({
  // identidad
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  surname: str,
  titulo: str,
  subtitulo: str,
  edad: str,
  genero: str,
  altura: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    },
    z.number().nonnegative().nullable(),
  ),
  ocupacion: str,
  rangoAventurero: str,
  lugarNacimiento: str,
  familia: str,
  esInvocado: boolField.optional(),
  tipoInvocacion: str,
  // historia / personalidad (markdown)
  historia: str,
  rasgosPersonalidad: str,
  motivacion: str,
  miedos: str,
  filosofia: str,
  gustos: str,
  disgustos: str,
  debilidades: str,
  // magia / combate
  tipoMagiaPrincipal: str,
  magiaSecundaria: str,
  nivelDeConsciencia: str,
  circuitoForte: str,
  essentia: str,
  zenithra: str,
  bendicion: str,
  segundoDespertar: str,
  // media
  imagenAssetId: idField,
  bannerAssetId: idField,
  imagenUrl: str,
  bannerUrl: str,
  // estado
  estadoPublicacion: estadoPublicacionSchema.default("borrador"),
  // bloques anidados
  estadisticas: estadisticasSchema.nullable().optional(),
  habilidades: z.array(habilidadSchema).default([]),
  eventos: z.array(eventoSchema).default([]),
  objetos: z.array(objetoSchema).default([]),
  relaciones: z.array(relacionSchema).default([]),
  naciones: z.array(personajeNacionSchema).default([]),
  razas: z.array(personajeRazaSchema).default([]),
  organizaciones: z.array(personajeOrganizacionSchema).default([]),
});

export type PersonajeInput = z.infer<typeof personajeSchema>;
