import { relations } from "drizzle-orm";
import {
  personajes,
  estadisticas,
  habilidades,
  relaciones,
  personajeNarrativa,
} from "./schema/personajes";
import {
  naciones,
  razas,
  organizaciones,
  familias,
  gremio,
  armasArtefactos,
} from "./schema/mundo";
import { magiaFundamentos, timelineEventos } from "./schema/lore";
import {
  canciones,
  personajeCancion,
  mediaAssets,
} from "./schema/media";
import {
  personajeNacion,
  personajeRaza,
  personajeEvento,
  personajeObjeto,
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
  // Relaciones donde este PJ es el destino (para mostrarlas también en su ficha).
  relacionesInversas: many(relaciones, { relationName: "relacion_destino" }),
  eventos: many(personajeEvento),
  narrativa: one(personajeNarrativa),
  objetos: many(personajeObjeto),
  canciones: many(personajeCancion),
  naciones: many(personajeNacion),
  razas: many(personajeRaza),
  // La pertenencia a organizaciones vive en org_jerarquia desde la unificación.
  organizaciones: many(orgJerarquia),
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

export const personajeEventoRelations = relations(personajeEvento, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeEvento.personajeId],
    references: [personajes.id],
  }),
  evento: one(timelineEventos, {
    fields: [personajeEvento.timelineEventoId],
    references: [timelineEventos.id],
  }),
}));

export const personajeNarrativaRelations = relations(personajeNarrativa, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeNarrativa.personajeId],
    references: [personajes.id],
  }),
}));

export const personajeObjetoRelations = relations(personajeObjeto, ({ one }) => ({
  personaje: one(personajes, {
    fields: [personajeObjeto.personajeId],
    references: [personajes.id],
  }),
  objeto: one(armasArtefactos, {
    fields: [personajeObjeto.armaArtefactoId],
    references: [armasArtefactos.id],
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

// ── Mundo: relaciones inversas para fichas ───────────────
export const nacionesRelations = relations(naciones, ({ many }) => ({
  personajes: many(personajeNacion),
  razas: many(razas),
}));

export const organizacionesRelations = relations(organizaciones, ({ many }) => ({
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
