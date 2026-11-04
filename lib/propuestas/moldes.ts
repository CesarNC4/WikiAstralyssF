import { ENTIDADES, type FieldDef } from "@/lib/admin/fields";
import { RELACIONES } from "@/lib/relaciones/registro";

/**
 * El molde de cada ficha: sus campos con los rótulos del panel, por secciones
 * (docs/area-ia.md). Es el contrato entre lo que Claude lee y propone
 * (`scripts/lore/`) y lo que aplica la bandeja de propuestas: un dato se
 * escribe con el mismo rótulo que tiene en el formulario.
 *
 * Client-safe. Las fichas del admin genérico salen de `ENTIDADES`; las que
 * tienen formulario propio (personaje, organización, familia, gremio, página
 * de lore) se declaran aquí a mano, copiando sus rótulos.
 *
 * Las conexiones y las fechas no son campos del molde: van en sus propias
 * secciones de la propuesta, y salen del registro de relaciones y de
 * `ROLES_FECHA`. Por eso se omiten las columnas de clave foránea que ya son una
 * relación de medio "referencia" (el lugar de nacimiento, la región de una
 * locación…): aparecen como conexión.
 */

export type TipoCampo =
  /** Una línea. */
  | "corto"
  /** Párrafos (markdown). */
  | "largo"
  | "numero"
  /** Una opción de un catálogo (`catalogo`) o de una lista fija (`opciones`). */
  | "opcion"
  /** Varias opciones del mismo catálogo. */
  | "lista"
  | "si-no"
  /** Otra ficha, por su nombre (`ref`). */
  | "ficha";

export interface CampoMolde {
  /** Columna en Drizzle (camelCase). */
  name: string;
  label: string;
  tipo: TipoCampo;
  seccion: string;
  catalogo?: string;
  opciones?: string[];
  ref?: string;
  hint?: string;
}

export interface Molde {
  entidad: string;
  singular: string;
  /** Columna del nombre (nombre | titulo). */
  nombre: string;
  campos: CampoMolde[];
}

const TIPO: Record<FieldDef["type"], TipoCampo> = {
  text: "corto",
  textarea: "largo",
  number: "numero",
  decimal: "numero",
  slider: "numero",
  combobox: "opcion",
  opciones: "opcion",
  elemento: "opcion",
  multi: "lista",
  checkbox: "si-no",
  reference: "ficha",
};

/** Lo calcula el taller: lo que se escribiera aquí se reemplazaría al guardar. */
const CALCULADOS: Record<string, string[]> = { capitulos: ["numero"], actos: ["numeroOrden"] };

/** Columnas de clave foránea que el registro ya trata como conexión. */
function columnasDeReferencia(entidad: string): Set<string> {
  return new Set(
    RELACIONES.filter((r) => r.medio === "referencia" && r.a.entidad === entidad && r.columna).map((r) => r.columna!),
  );
}

function desdeConfig(entidad: string): Molde | undefined {
  const c = ENTIDADES[entidad];
  if (!c) return undefined;
  const refs = columnasDeReferencia(entidad);
  return {
    entidad,
    singular: c.singular,
    nombre: c.nameField,
    campos: [
      { name: c.nameField, label: c.nameLabel ?? "Nombre", tipo: "corto", seccion: "Identidad" },
      ...c.fields
        .filter((f) => !(f.type === "reference" && refs.has(f.name)) && !CALCULADOS[entidad]?.includes(f.name))
        .map((f) => ({
          name: f.name,
          label: f.label,
          tipo: TIPO[f.type],
          seccion: f.group,
          catalogo: f.type === "elemento" ? "elementos" : f.catalogCampo,
          opciones: f.opciones?.map((o) => o.etiqueta),
          ref: f.refTarget,
          hint: f.hint,
        })),
    ],
  };
}

const c = (name: string, label: string, tipo: TipoCampo, seccion: string, extra: Partial<CampoMolde> = {}): CampoMolde => ({
  name,
  label,
  tipo,
  seccion,
  ...extra,
});

const largos = (seccion: string, pares: [string, string][]) => pares.map(([n, l]) => c(n, l, "largo", seccion));

/** Formularios propios: rótulos copiados de `components/admin/*Form.tsx`. */
const A_MANO: Record<string, Molde> = {
  personajes: {
    entidad: "personajes",
    singular: "Personaje",
    nombre: "nombre",
    campos: [
      c("nombre", "Nombre", "corto", "Identidad"),
      c("nombreReal", "Nombre real", "corto", "Identidad", { hint: "Identidad oculta: el Nombre es el alias que conocen los lectores. Va oculto salvo que lo reveles." }),
      c("surname", "Apellido", "corto", "Identidad"),
      c("titulo", "Título", "corto", "Identidad"),
      c("edad", "Edad (texto)", "corto", "Identidad", { hint: "Solo si no tiene fecha de nacimiento: «Milenaria», «Desconocida»." }),
      c("genero", "Género", "opcion", "Identidad", { catalogo: "genero" }),
      c("altura", "Altura (m)", "numero", "Identidad"),
      c("ocupacion", "Ocupación", "opcion", "Identidad", { catalogo: "ocupacion" }),
      c("ocupacionDetalle", "Ocupación (detalle)", "corto", "Identidad", { hint: "El matiz: «Ex Princesa», «Escriba del Consejo»." }),
      c("estadoVital", "Estado vital", "opcion", "Identidad", { catalogo: "estado_vital" }),
      c("rangoAventurero", "Rango aventurero", "opcion", "Identidad", { catalogo: "rango_aventurero" }),
      c("lugarNacimiento", "Lugar de nacimiento (detalle libre)", "corto", "Identidad", { hint: "Si el lugar no tiene ficha." }),
      c("esInvocado", "Es invocado", "si-no", "Identidad"),
      c("tipoInvocacion", "Tipo de invocación", "corto", "Identidad"),
      ...largos("Historia", [
        ["historia", "Historia"],
        ["rasgosPersonalidad", "Rasgos de personalidad"],
        ["motivacion", "Motivación"],
        ["miedos", "Miedos"],
        ["filosofia", "Filosofía"],
        ["debilidades", "Debilidades"],
        ["gustos", "Gustos"],
        ["disgustos", "Disgustos"],
      ]),
      c("magiaPrincipalTipo", "Magia principal", "opcion", "Magia y combate", { catalogo: "magia_tipo" }),
      c("magiaPrincipalVariante", "Magia principal (elemento)", "opcion", "Magia y combate", { catalogo: "elementos" }),
      c("magiaSecundariaTipo", "Magia secundaria", "opcion", "Magia y combate", { catalogo: "magia_tipo" }),
      c("magiaSecundariaVariante", "Magia secundaria (elemento)", "opcion", "Magia y combate", { catalogo: "elementos" }),
      c("nivelDeConsciencia", "Nivel de consciencia", "opcion", "Magia y combate", { catalogo: "nivel_consciencia" }),
      ...largos("Magia y combate", [
        ["circuitoForte", "Circuito Forte"],
        ["essentia", "Essentia"],
        ["zenithra", "Zenithra"],
        ["bendicion", "Bendición"],
        ["segundoDespertar", "Segundo despertar"],
      ]),
    ],
  },
  organizaciones: {
    entidad: "organizaciones",
    singular: "Organización",
    nombre: "nombre",
    campos: [
      c("nombre", "Nombre", "corto", "Identidad"),
      c("subtitulo", "Subtítulo", "corto", "Identidad"),
      c("tipo", "Tipo", "opcion", "Identidad", { catalogo: "org_tipo" }),
      c("estado", "Estado", "opcion", "Identidad", { catalogo: "org_estado" }),
      c("legalidad", "Legalidad", "opcion", "Identidad", { catalogo: "org_legalidad" }),
      c("sede", "Sede", "corto", "Identidad"),
      ...largos("Contenido", [
        ["descripcion", "Descripción"],
        ["historia", "Historia"],
        ["objetivo", "Objetivo"],
        ["ideologia", "Ideología"],
        ["liderazgo", "Liderazgo"],
        ["miembrosDestacados", "Miembros destacados"],
        ["estructuraInterna", "Estructura interna"],
        ["relacionFacciones", "Relación entre facciones"],
        ["notasAdicionales", "Notas adicionales"],
      ]),
    ],
  },
  familias: {
    entidad: "familias",
    singular: "Familia",
    nombre: "nombre",
    campos: [
      c("nombre", "Nombre", "corto", "Identidad"),
      c("apellido", "Apellido / casa", "corto", "Identidad"),
      c("subtitulo", "Subtítulo", "corto", "Identidad"),
      c("origen", "Origen", "opcion", "Identidad", { catalogo: "familia_origen" }),
      c("estatus", "Estatus", "opcion", "Identidad", { catalogo: "familia_estatus" }),
      c("poderEconomicoNivel", "Poder económico (0–100)", "numero", "Niveles de poder"),
      c("poderPoliticoNivel", "Poder político (0–100)", "numero", "Niveles de poder"),
      c("poderMilitarNivel", "Poder militar (0–100)", "numero", "Niveles de poder"),
      ...largos("Contenido", [
        ["descripcion", "Descripción"],
        ["historia", "Historia"],
        ["poderEconomico", "Poder económico"],
        ["poderPolitico", "Poder político"],
        ["poderMilitar", "Poder militar"],
        ["estructuraNucleo", "Estructura del núcleo"],
        ["circuloExtendido", "Círculo extendido"],
        ["liderazgo", "Liderazgo"],
      ]),
    ],
  },
  gremio: {
    entidad: "gremio",
    singular: "Gremio",
    nombre: "nombre",
    campos: [
      c("nombre", "Nombre", "corto", "Identidad"),
      c("subtitulo", "Subtítulo", "corto", "Identidad"),
      c("lema", "Lema", "corto", "Identidad"),
      c("sede", "Sede", "corto", "Identidad"),
      ...largos("Contenido", [
        ["descripcion", "Descripción"],
        ["historia", "Historia"],
        ["estructuraGlobal", "Estructura global"],
        ["jerarquiaRangos", "Jerarquía y rangos (texto)"],
        ["sistemaMisiones", "Sistema de misiones"],
        ["principiosGenerales", "Principios generales"],
        ["normasContratos", "Normas y contratos"],
        ["conductaAceptable", "Conducta aceptable"],
        ["conductaIntolerable", "Conducta intolerable"],
        ["usoFuerza", "Uso de la fuerza"],
        ["lealtadDiscrecion", "Lealtad y discreción"],
        ["principioEspadaNeutral", "Principio de la espada neutral"],
        ["recompensas", "Recompensas"],
      ]),
    ],
  },
  lore: {
    entidad: "lore",
    singular: "Página de lore",
    nombre: "titulo",
    campos: [
      c("titulo", "Título", "corto", "Identidad"),
      c("slug", "Slug (URL)", "corto", "Identidad"),
      c("subtitulo", "Subtítulo", "corto", "Identidad"),
      c("introduccion", "Introducción", "largo", "Contenido"),
    ],
  },
};

/** El molde de una entidad, o undefined si no tiene formulario de ficha. */
export function moldeDe(entidad: string): Molde | undefined {
  return A_MANO[entidad] ?? desdeConfig(entidad);
}

/** Entidades con molde: todas las que se pueden proponer. */
export function entidadesConMolde(): string[] {
  return [...new Set([...Object.keys(A_MANO), ...Object.keys(ENTIDADES)])];
}
