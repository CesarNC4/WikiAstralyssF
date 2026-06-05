/**
 * Registro central de entidades públicas (§3, §5, §8).
 * Metadatos puros (sin Drizzle) que alimentan navegación, cabeceras de índice,
 * acentos de color y la presentación de resultados de búsqueda.
 */

export type EntityGroup = "personajes" | "mundo" | "lore" | "explorar";

export type EntityKey =
  | "personajes"
  | "naciones"
  | "organizaciones"
  | "familias"
  | "razas"
  | "bestias"
  | "minerales"
  | "conceptos"
  | "magia"
  | "lore"
  | "misiones"
  | "timeline"
  | "mapa";

export interface EntityMeta {
  key: EntityKey;
  /** Etiqueta plural (índice, nav). */
  plural: string;
  /** Etiqueta singular (resultado de búsqueda, breadcrumb). */
  singular: string;
  /** Segmento de ruta base. */
  route: string;
  /** Token de color de acento (clase Tailwind del design system). */
  accent: string;
  /** Nombre de icono de lucide-react. */
  icon: string;
  group: EntityGroup;
  /** Frase breve para cabecera del índice. */
  tagline: string;
  /** ¿Tiene página índice navegable con cards? */
  hasIndex: boolean;
}

export const ENTITIES: Record<EntityKey, EntityMeta> = {
  personajes: {
    key: "personajes",
    plural: "Personajes",
    singular: "Personaje",
    route: "/personajes",
    accent: "text-primary",
    icon: "Users",
    group: "personajes",
    tagline: "Las almas que habitan Astralys.",
    hasIndex: true,
  },
  naciones: {
    key: "naciones",
    plural: "Naciones",
    singular: "Nación",
    route: "/naciones",
    accent: "text-secondary",
    icon: "Globe2",
    group: "mundo",
    tagline: "Reinos, imperios y territorios del mundo.",
    hasIndex: true,
  },
  organizaciones: {
    key: "organizaciones",
    plural: "Organizaciones",
    singular: "Organización",
    route: "/organizaciones",
    accent: "text-accent",
    icon: "Building2",
    group: "mundo",
    tagline: "Facciones, órdenes y poderes ocultos.",
    hasIndex: true,
  },
  familias: {
    key: "familias",
    plural: "Familias",
    singular: "Familia",
    route: "/familias",
    accent: "text-accent-warm",
    icon: "Network",
    group: "mundo",
    tagline: "Linajes y casas que mueven la historia.",
    hasIndex: true,
  },
  razas: {
    key: "razas",
    plural: "Razas",
    singular: "Raza",
    route: "/razas",
    accent: "text-secondary",
    icon: "Rabbit",
    group: "mundo",
    tagline: "Pueblos y especies del cosmos.",
    hasIndex: true,
  },
  bestias: {
    key: "bestias",
    plural: "Bestias",
    singular: "Bestia",
    route: "/bestias",
    accent: "text-error",
    icon: "PawPrint",
    group: "mundo",
    tagline: "Criaturas y amenazas del mundo salvaje.",
    hasIndex: true,
  },
  minerales: {
    key: "minerales",
    plural: "Minerales",
    singular: "Mineral",
    route: "/minerales",
    accent: "text-rarity-raro",
    icon: "Gem",
    group: "mundo",
    tagline: "Materiales y reliquias de la tierra.",
    hasIndex: true,
  },
  conceptos: {
    key: "conceptos",
    plural: "Conceptos",
    singular: "Concepto",
    route: "/conceptos",
    accent: "text-primary-glow",
    icon: "Lightbulb",
    group: "lore",
    tagline: "Ideas y principios que rigen Astralys.",
    hasIndex: true,
  },
  magia: {
    key: "magia",
    plural: "Magia",
    singular: "Fundamento",
    route: "/magia",
    accent: "text-primary",
    icon: "Sparkles",
    group: "lore",
    tagline: "Los fundamentos de lo arcano.",
    hasIndex: true,
  },
  lore: {
    key: "lore",
    plural: "Lore",
    singular: "Página",
    route: "/lore",
    accent: "text-accent",
    icon: "ScrollText",
    group: "lore",
    tagline: "Crónicas y conocimiento del mundo.",
    hasIndex: true,
  },
  misiones: {
    key: "misiones",
    plural: "Misiones",
    singular: "Misión",
    route: "/misiones",
    accent: "text-warning",
    icon: "Swords",
    group: "lore",
    tagline: "Contratos, encargos y aventuras.",
    hasIndex: true,
  },
  timeline: {
    key: "timeline",
    plural: "Cronología",
    singular: "Evento",
    route: "/timeline",
    accent: "text-secondary",
    icon: "Clock",
    group: "explorar",
    tagline: "La historia de Astralys en el tiempo.",
    hasIndex: false,
  },
  mapa: {
    key: "mapa",
    plural: "Mapa",
    singular: "Región",
    route: "/mapa",
    accent: "text-accent",
    icon: "Map",
    group: "explorar",
    tagline: "El mundo de Astralys, región a región.",
    hasIndex: false,
  },
};

export const ENTITY_LIST = Object.values(ENTITIES);

export const NAV_GROUPS: { id: EntityGroup; label: string; keys: EntityKey[] }[] = [
  { id: "personajes", label: "Personajes", keys: ["personajes"] },
  {
    id: "mundo",
    label: "Mundo",
    keys: ["naciones", "razas", "organizaciones", "familias", "bestias", "minerales"],
  },
  { id: "lore", label: "Lore", keys: ["conceptos", "magia", "lore", "misiones"] },
  { id: "explorar", label: "Explorar", keys: ["timeline", "mapa"] },
];

export function entityByKey(key: string): EntityMeta | undefined {
  return ENTITIES[key as EntityKey];
}
