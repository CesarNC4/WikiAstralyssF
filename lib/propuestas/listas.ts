/**
 * Lo que una ficha tiene además de campos y conexiones: filas propias con varios
 * datos (las habilidades de un personaje, los rangos de una organización, el árbol
 * de una familia…). Como el molde, es el contrato entre lo que Claude lee y propone
 * y lo que aplica la bandeja (docs/propuestas-formato.md). Client-safe.
 */

export type ClaseLista = "habilidades" | "rangos" | "facciones" | "historial" | "arbol" | "secciones" | "fragmentos";

export interface CampoLista {
  /** Clave dentro de la fila. No siempre es una columna: el padre es un nombre, no un id. */
  name: string;
  label: string;
  tipo?: "corto" | "numero" | "opcion";
  catalogo?: string;
  opciones?: string[];
}

export interface ListaDef {
  clase: ClaseLista;
  /** Encabezado `###` en la propuesta. */
  titulo: string;
  /** Qué es el nombre de la fila, en la bandeja. */
  rotuloNombre: string;
  /** Ficha a la que puede apuntar el nombre de la fila. */
  objetivo?: string;
  /** Qué significa el texto que sigue a los dos puntos: `- Nombre (…): texto`. */
  texto?: string;
  /** Lleva 🔒: las filas que no se pueden ocultar no lo admiten. */
  ocultable: boolean;
  campos: CampoLista[];
}

const RANGOS: ListaDef = { clase: "rangos", titulo: "Rangos", rotuloNombre: "Rango", ocultable: false, campos: [] };
const FACCIONES: ListaDef = {
  clase: "facciones",
  titulo: "Facciones",
  rotuloNombre: "Facción",
  ocultable: false,
  campos: [{ name: "color", label: "Color" }],
};
const HISTORIAL: ListaDef = {
  clase: "historial",
  titulo: "Historial",
  rotuloNombre: "Quién",
  objetivo: "personajes",
  ocultable: true,
  campos: [
    { name: "rol", label: "Rol" },
    { name: "periodo", label: "Periodo" },
    { name: "estado", label: "Estado" },
    { name: "destacado", label: "Destacado" },
    { name: "notas", label: "Notas" },
  ],
};

/**
 * Valores de `pagina_secciones.tipo`. El valor guardado es el de siempre (minúsculas,
 * sin tildes) para no invalidar las secciones ya escritas; la etiqueta es lo único
 * que cambia.
 */
export const TIPOS_SECCION = [
  { valor: "texto", label: "Texto" },
  { valor: "cita", label: "Cita" },
  { valor: "tabla", label: "Tabla" },
  { valor: "lista", label: "Lista" },
  { valor: "aviso", label: "Aviso / Nota" },
  { valor: "cronologia", label: "Cronología" },
  { valor: "separador", label: "Separador" },
] as const;

const LISTAS: Record<string, ListaDef[]> = {
  personajes: [
    {
      clase: "habilidades",
      titulo: "Habilidades",
      rotuloNombre: "Habilidad",
      objetivo: "magia",
      texto: "Descripción",
      ocultable: true,
      campos: [
        { name: "categoria", label: "Categoría", tipo: "opcion", catalogo: "habilidad_categoria" },
        { name: "tipo", label: "Tipo", tipo: "opcion", catalogo: "magia_tipo" },
        { name: "elemento", label: "Elemento", tipo: "opcion", catalogo: "elementos" },
      ],
    },
  ],
  organizaciones: [RANGOS, FACCIONES, HISTORIAL],
  gremio: [RANGOS, FACCIONES, HISTORIAL],
  familias: [
    RANGOS,
    FACCIONES,
    {
      clase: "arbol",
      titulo: "Árbol genealógico",
      rotuloNombre: "Persona",
      objetivo: "personajes",
      ocultable: true,
      campos: [
        { name: "generacion", label: "Generación", tipo: "numero" },
        { name: "padre", label: "Padre" },
        { name: "madre", label: "Madre" },
        { name: "estado", label: "Estado", tipo: "opcion", catalogo: "estado_vital" },
        { name: "destacado", label: "Destacado" },
        { name: "notas", label: "Notas" },
      ],
    },
  ],
  lore: [
    {
      clase: "secciones",
      titulo: "Sección",
      rotuloNombre: "Sección",
      texto: "Contenido",
      ocultable: true,
      campos: [{ name: "tipo", label: "Tipo", tipo: "opcion", opciones: TIPOS_SECCION.map((t) => t.label) }],
    },
  ],
  actos: [
    {
      clase: "fragmentos",
      titulo: "Fragmentos",
      rotuloNombre: "Fragmento",
      ocultable: true,
      campos: [
        { name: "pov", label: "POV" },
        { name: "enlace", label: "Enlace" },
        { name: "fecha", label: "Fecha" },
      ],
    },
  ],
};

export function listasDe(entidad: string): ListaDef[] {
  return LISTAS[entidad] ?? [];
}

/**
 * Las estadísticas van en bloque: se ocultan juntas (`BLOQUES_OCULTABLES`) y son una
 * sola fila en su tabla. Rótulos copiados de `components/admin/PersonajeForm.tsx`.
 */
export const ESTADISTICAS: { name: string; label: string; tipo: "primario" | "combate" | "rango" }[] = [
  { name: "fuerza", label: "Fuerza", tipo: "primario" },
  { name: "destreza", label: "Destreza", tipo: "primario" },
  { name: "constitucion", label: "Constitución", tipo: "primario" },
  { name: "inteligencia", label: "Inteligencia", tipo: "primario" },
  { name: "sabiduria", label: "Sabiduría", tipo: "primario" },
  { name: "carisma", label: "Carisma", tipo: "primario" },
  { name: "mpMax", label: "MP máx", tipo: "combate" },
  { name: "ataqueFisico", label: "Ataque físico", tipo: "combate" },
  { name: "ataqueMagico", label: "Ataque mágico", tipo: "combate" },
  { name: "defensaFisica", label: "Defensa física", tipo: "combate" },
  { name: "defensaMagica", label: "Defensa mágica", tipo: "combate" },
  { name: "velocidad", label: "Velocidad", tipo: "combate" },
  { name: "capacidadDeReaccion", label: "Reacción", tipo: "combate" },
  { name: "precisionVal", label: "Precisión", tipo: "combate" },
  { name: "rangoCuerpoACuerpo", label: "C. a cuerpo", tipo: "rango" },
  { name: "rangoDistancia", label: "Distancia", tipo: "rango" },
  { name: "danoMagico", label: "Daño mágico", tipo: "rango" },
  { name: "defensa", label: "Defensa", tipo: "rango" },
  { name: "apoyo", label: "Apoyo", tipo: "rango" },
  { name: "movilidad", label: "Movilidad", tipo: "rango" },
  { name: "controlDeMasas", label: "Control de masas", tipo: "rango" },
];

export const TITULO_ESTADISTICAS = "Estadísticas";

/**
 * Datos de un miembro que el registro de relaciones no declara, porque en el panel
 * se editan en el formulario de la organización y no en el de conexiones. En la
 * propuesta van junto al resto: `- Miembros: Kael (Rango: Capitán; Facción: Norte)`.
 */
export const EXTRAS_JERARQUIA: Record<string, CampoLista[]> = {
  org_jerarquia: [
    { name: "rango", label: "Rango" },
    { name: "faccion", label: "Facción" },
    { name: "tituloApodo", label: "Título o apodo" },
  ],
  familia_jerarquia: [
    { name: "rango", label: "Rango" },
    { name: "faccion", label: "Facción" },
  ],
  gremio_jerarquia: [
    { name: "rango", label: "Rango" },
    { name: "faccion", label: "Facción" },
  ],
};

/** Una fila de lista escrita en una línea, tal como va en la propuesta y en `pnpm lore ficha`. */
export function lineaDeFila(def: ListaDef, fila: { nombre: string; valores: Record<string, string>; texto?: string | null; oculto?: boolean }): string {
  const extras = def.campos.filter((c) => fila.valores[c.name]).map((c) => `${c.label}: ${fila.valores[c.name]}`);
  const parentesis = extras.length ? ` (${extras.join("; ")})` : "";
  const texto = def.texto && fila.texto ? `: ${fila.texto.replace(/\s+/g, " ").trim()}` : "";
  return `- ${fila.nombre}${parentesis}${texto}${fila.oculto ? " 🔒" : ""}`.replace(/^- {2}/, "- ");
}
