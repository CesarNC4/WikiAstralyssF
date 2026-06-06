import { relations } from "drizzle-orm";
import {
  personajes,
  estadisticas,
  habilidades,
  relaciones,
  eventosPersonaje,
  personajeNarrativa,
  equipamiento,
  objetosImportantes,
} from "./schema/personajes";
import {
  naciones,
  razas,
  organizaciones,
  familias,
  gremio,
} from "./schema/mundo";
import { magiaFundamentos } from "./schema/lore";
import {
  canciones,
  personajeCancion,
  mediaAssets,
} from "./schema/media";
import {
  personajeNacion,
  personajeRaza,
  personajeOrganizacion,
} from "./schema/relacionesNM";
import {
  familiaArbol,
  familiaJerarquia,
  familiaFacciones,
  orgJerarquia,
  orgFacciones,
  orgRangos,
  orgHistorial,
  gremioJerarquia,
  gremioFacciones,
  gremioRangos,
  gremioHistorial,
} from "./schema/jerarquias";

/**
 * Relaciones de query (§2.2). Centralizadas para evitar imports cíclicos
 * entre archivos de dominio. Las FK físicas viven en cada columna.
 */

export const personajesRelations = relations(personajes, ({ one, many }) => ({
  estadisticas: many(estadisticas),
  habilidades: many(habilidades),
  relaciones: many(relaciones, { relationName: "relacion_origen" }),
  eventos: many(eventosPersonaje),
  narrativa: one(personajeNarrativa),
  equipamiento: many(equipamiento),
  objetos: many(objetosImportantes),
  canciones: many(personajeCancion),
  naciones: many(personajeNacion),
  razas: many(personajeRaza),
  organizaciones: many(personajeOrganizacion),
  imagenAsset: one(mediaAssets, {
    fields: [personajes.imagenAssetId],
    references: [mediaAssets.id],
    relationName: "personaje_imagen",
  }),
  bannerAsset: one(mediaAssets, {
    fields: [personajes.bannerAssetId],
    references: [mediaAssets.id],
    relationName: "personaje_banner",
  }),
}));

export const estadisticasRelations = relations(estadisticas, ({ one }) => ({
  personaje: one(personajes, {
    fields: [estadisticas.personajeId],
    references: [personajes.id],
  }),
}));

export const habilidadesRelations = relations(habilidades, ({ one }) => ({
  personaje: one(personajes, {
    fields: [habilidades.personajeId],
    references: [personajes.id],
  }),
  fundamento: one(magiaFundamentos, {
    fields: [habilidades.magiaFundamentoId],
    references: [magiaFundamentos.id],
  }),
}));

export const relacionesRelations = relations(relaciones, ({ one }) => ({
  personaje: one(personajes, {
    fields: [relaciones.personajeId],
    references: [personajes.id],
    relationName: "relacion_origen",
  }),
  relacionado: one(personajes, {
    fields: [relaciones.personajeRelacionadoId],
    references: [personajes.id],
    relationName: "relacion_destino",
  }),
}));

export const eventosPersonajeRelations = relations(eventosPersonaje, ({ one }) => ({
  personaje: one(personajes, {
    fields: [eventosPersonaje.personajeId],
    references: [personajes.id],
  }),
}));

export const personajeNarrativaRelations = relations(personajeNarrativa, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeNarrativa.personajeId],
    references: [personajes.id],
  }),
}));

export const equipamientoRelations = relations(equipamiento, ({ one }) => ({
  personaje: one(personajes, {
    fields: [equipamiento.personajeId],
    references: [personajes.id],
  }),
}));

export const objetosRelations = relations(objetosImportantes, ({ one }) => ({
  personaje: one(personajes, {
    fields: [objetosImportantes.personajeId],
    references: [personajes.id],
  }),
}));

export const personajeCancionRelations = relations(personajeCancion, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeCancion.personajeId],
    references: [personajes.id],
  }),
  cancion: one(canciones, {
    fields: [personajeCancion.cancionId],
    references: [canciones.id],
  }),
}));

export const personajeNacionRelations = relations(personajeNacion, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeNacion.personajeId],
    references: [personajes.id],
  }),
  nacion: one(naciones, {
    fields: [personajeNacion.nacionId],
    references: [naciones.id],
  }),
}));

export const personajeRazaRelations = relations(personajeRaza, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeRaza.personajeId],
    references: [personajes.id],
  }),
  raza: one(razas, {
    fields: [personajeRaza.razaId],
    references: [razas.id],
  }),
}));

export const personajeOrganizacionRelations = relations(personajeOrganizacion, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeOrganizacion.personajeId],
    references: [personajes.id],
  }),
  organizacion: one(organizaciones, {
    fields: [personajeOrganizacion.organizacionId],
    references: [organizaciones.id],
  }),
}));

// ── Mundo: relaciones inversas para fichas ───────────────
export const nacionesRelations = relations(naciones, ({ many }) => ({
  personajes: many(personajeNacion),
  razas: many(razas),
}));

export const organizacionesRelations = relations(organizaciones, ({ many }) => ({
  miembros: many(personajeOrganizacion),
  facciones: many(orgFacciones),
  rangos: many(orgRangos),
  jerarquia: many(orgJerarquia),
  historial: many(orgHistorial),
}));

export const orgJerarquiaRelations = relations(orgJerarquia, ({ one }) => ({
  organizacion: one(organizaciones, {
    fields: [orgJerarquia.organizacionId],
    references: [organizaciones.id],
  }),
  personaje: one(personajes, {
    fields: [orgJerarquia.personajeId],
    references: [personajes.id],
  }),
  rango: one(orgRangos, {
    fields: [orgJerarquia.rangoId],
    references: [orgRangos.id],
  }),
}));

export const familiasRelations = relations(familias, ({ many }) => ({
  arbol: many(familiaArbol),
  jerarquia: many(familiaJerarquia),
  facciones: many(familiaFacciones),
}));

export const familiaArbolRelations = relations(familiaArbol, ({ one }) => ({
  familia: one(familias, {
    fields: [familiaArbol.familiaId],
    references: [familias.id],
  }),
  personaje: one(personajes, {
    fields: [familiaArbol.personajeId],
    references: [personajes.id],
  }),
}));

export const familiaJerarquiaRelations = relations(familiaJerarquia, ({ one }) => ({
  familia: one(familias, {
    fields: [familiaJerarquia.familiaId],
    references: [familias.id],
  }),
  personaje: one(personajes, {
    fields: [familiaJerarquia.personajeId],
    references: [personajes.id],
  }),
}));

export const gremioRelations = relations(gremio, ({ many }) => ({
  facciones: many(gremioFacciones),
  rangos: many(gremioRangos),
  jerarquia: many(gremioJerarquia),
  historial: many(gremioHistorial),
}));
