/**
 * Registro de relaciones del mundo. Cada arista se declara **una vez**, con
 * nombre para sus dos extremos, y de aquí salen el editor de las dos fichas, los
 * bloques públicos y el grafo del Atlas.
 *
 * Para añadir una relación nueva:
 *   - Si sólo necesita "qué tipo de vínculo es" y una nota, usa `medio: "vinculo"`
 *     y no hace falta migrar la base.
 *   - Si necesita campos propios (una rareza, un rango), crea su tabla, dale sus
 *     claves foráneas y regístrala en `lib/relaciones/tablas.ts`.
 *
 * Client-safe: sólo datos.
 */
import type { RelacionDef, BloqueRelacion } from "./tipos";

const NOTA = { name: "nota", label: "Nota", tipo: "text" } as const;
const RAREZA = ["Común", "Poco común", "Raro", "Épico", "Legendario"];

export const RELACIONES: RelacionDef[] = [
  // ── Personaje ↔ mundo ─────────────────────────────────────────────────────
  {
    id: "personaje_nacion",
    medio: "tabla",
    a: { entidad: "personajes", titulo: "Naciones", icon: "Globe2", orden: 30 },
    b: { entidad: "naciones", titulo: "Personajes", icon: "Users", orden: 20 },
    campos: [
      { name: "tipo", label: "Vínculo", tipo: "text", destacado: true },
      { name: "descripcion", label: "Descripción", tipo: "text" },
    ],
  },
  {
    id: "personaje_raza",
    medio: "tabla",
    a: { entidad: "personajes", titulo: "Razas", icon: "Rabbit", orden: 31 },
    b: { entidad: "razas", titulo: "Personajes", icon: "Users", orden: 20 },
    campos: [
      { name: "esMixta", label: "Mestizaje", tipo: "checkbox" },
      NOTA,
    ],
  },
  {
    id: "org_jerarquia",
    medio: "tabla",
    a: {
      entidad: "organizaciones",
      titulo: "Miembros",
      icon: "Users",
      orden: 20,
      // La organización tiene su propio editor con rangos, facciones y orden.
      editorPropio: true,
    },
    b: { entidad: "personajes", titulo: "Organizaciones", icon: "Building2", orden: 32 },
    campos: [
      { name: "rol", label: "Rol", tipo: "text", destacado: true },
      { name: "tipo", label: "Tipo", tipo: "text" },
      { name: "descripcion", label: "Descripción", tipo: "text" },
    ],
    ordenable: true,
  },
  {
    id: "familia_jerarquia",
    medio: "tabla",
    a: { entidad: "familias", titulo: "Miembros", icon: "Users", orden: 20, editorPropio: true },
    b: { entidad: "personajes", titulo: "Familias", icon: "Network", orden: 33 },
    campos: [
      { name: "tituloNobiliario", label: "Título nobiliario", tipo: "text", destacado: true },
      { name: "tituloFamilia", label: "Título en la familia", tipo: "text" },
    ],
    ordenable: true,
  },
  {
    id: "gremio_jerarquia",
    medio: "tabla",
    a: { entidad: "gremio", titulo: "Miembros", icon: "Users", orden: 20, editorPropio: true },
    b: { entidad: "personajes", titulo: "Gremio", icon: "Landmark", orden: 34 },
    campos: [{ name: "tituloApodo", label: "Título o apodo", tipo: "text", destacado: true }],
    ordenable: true,
  },
  {
    id: "personaje_objeto",
    medio: "tabla",
    a: { entidad: "personajes", titulo: "Objetos", icon: "Sword", orden: 40 },
    b: { entidad: "artefactos", titulo: "Portadores", icon: "Users", orden: 20 },
    campos: [NOTA],
    ordenable: true,
  },
  {
    id: "personaje_evento",
    medio: "tabla",
    a: { entidad: "personajes", titulo: "Eventos clave", icon: "Clock", orden: 41 },
    b: { entidad: "timeline", titulo: "Personajes", icon: "Users", orden: 20 },
    campos: [NOTA],
    ordenable: true,
  },
  {
    id: "relaciones",
    medio: "tabla",
    a: { entidad: "personajes", titulo: "Relaciones", icon: "Heart", orden: 35 },
    b: { entidad: "personajes", titulo: "Relaciones", icon: "Heart", orden: 35 },
    campos: [
      { name: "tipoRelacion", label: "Relación", tipo: "text", destacado: true },
      { name: "subtipoRelacion", label: "Matiz", tipo: "text" },
      { name: "descripcion", label: "Descripción", tipo: "text" },
    ],
    reciproca: {
      campo: "tipoRelacion",
      inverso: {
        Padre: "Hijo", Madre: "Hijo", Hijo: "Padre", Hija: "Padre",
        Maestro: "Discípulo", Discípulo: "Maestro",
        Mentor: "Protegido", Protegido: "Mentor",
        Señor: "Vasallo", Vasallo: "Señor",
      },
    },
  },
  // ── Mundo ↔ mundo ─────────────────────────────────────────────────────────
  {
    id: "nacion_organizacion",
    medio: "tabla",
    a: { entidad: "naciones", titulo: "Organizaciones", icon: "Building2", orden: 21 },
    b: { entidad: "organizaciones", titulo: "Naciones", icon: "Globe2", orden: 21 },
    campos: [
      { name: "tipo", label: "Vínculo", tipo: "text", destacado: true },
      { name: "descripcion", label: "Descripción", tipo: "text" },
    ],
  },
  {
    id: "nacion_raza",
    medio: "tabla",
    a: { entidad: "naciones", titulo: "Razas", icon: "Rabbit", orden: 22 },
    b: { entidad: "razas", titulo: "Naciones", icon: "Globe2", orden: 21 },
    campos: [{ name: "tipo", label: "Tipo o rol", tipo: "text", destacado: true }],
  },
  {
    id: "nacion_diplomacia",
    medio: "tabla",
    a: { entidad: "naciones", titulo: "Diplomacia", icon: "Landmark", orden: 23, hint: "Relación con otras naciones" },
    b: { entidad: "naciones", titulo: "Diplomacia", icon: "Landmark", orden: 23 },
    campos: [
      { name: "tipo", label: "Relación", tipo: "select", opciones: ["Aliada", "Rival", "Neutral", "Vasalla", "Soberana", "En guerra"], destacado: true },
      NOTA,
    ],
    reciproca: { campo: "tipo", inverso: { Vasalla: "Soberana", Soberana: "Vasalla" } },
  },
  {
    id: "bestia_nacion",
    medio: "tabla",
    a: { entidad: "bestias", titulo: "Hábitat · Naciones", icon: "Globe2", orden: 20 },
    b: { entidad: "naciones", titulo: "Bestias", icon: "PawPrint", orden: 24 },
    campos: [NOTA],
  },
  {
    id: "bestia_region",
    medio: "tabla",
    a: { entidad: "bestias", titulo: "Hábitat · Regiones", icon: "MapPinned", orden: 21 },
    b: { entidad: "regiones", titulo: "Bestias", icon: "PawPrint", orden: 20 },
    campos: [NOTA],
  },
  {
    id: "bestia_drop",
    medio: "tabla",
    a: { entidad: "bestias", titulo: "Drops", icon: "Gem", orden: 22 },
    b: { entidad: "minerales", titulo: "Soltado por", icon: "PawPrint", orden: 20 },
    campos: [
      { name: "rareza", label: "Rareza", tipo: "select", opciones: RAREZA, destacado: true },
      NOTA,
    ],
    ordenable: true,
  },
  {
    id: "bestia_relacion",
    medio: "tabla",
    a: { entidad: "bestias", titulo: "Bestias relacionadas", icon: "Network", orden: 23 },
    b: { entidad: "bestias", titulo: "Bestias relacionadas", icon: "Network", orden: 23 },
    campos: [
      { name: "tipo", label: "Relación", tipo: "select", opciones: ["Depredador", "Presa", "Subespecie", "Especie madre", "Evolución", "Forma previa", "Simbiótica", "Rival"], destacado: true },
      NOTA,
    ],
    reciproca: {
      campo: "tipo",
      inverso: {
        Depredador: "Presa", Presa: "Depredador",
        Subespecie: "Especie madre", "Especie madre": "Subespecie",
        Evolución: "Forma previa", "Forma previa": "Evolución",
      },
    },
  },
  {
    id: "mineral_artefacto",
    medio: "tabla",
    a: { entidad: "minerales", titulo: "Forjado en", icon: "Sword", orden: 21 },
    b: { entidad: "artefactos", titulo: "Materiales", icon: "Gem", orden: 21 },
    campos: [NOTA],
  },
  // ── Narrativa ─────────────────────────────────────────────────────────────
  {
    id: "capitulo_personaje",
    medio: "tabla",
    a: { entidad: "capitulos", titulo: "Personajes", icon: "Users", orden: 20 },
    b: { entidad: "personajes", titulo: "Capítulos", icon: "BookOpen", orden: 42 },
    campos: [{ name: "rolEnCapitulo", label: "Rol en el capítulo", tipo: "text", destacado: true }],
  },
  {
    id: "personaje_cancion",
    medio: "tabla",
    a: { entidad: "personajes", titulo: "Canciones", icon: "Music", orden: 43 },
    b: { entidad: "canciones", titulo: "Personajes", icon: "Users", orden: 20 },
    campos: [{ name: "contexto", label: "Contexto", tipo: "text", destacado: true }],
  },
  {
    id: "capitulo_cancion",
    medio: "tabla",
    a: { entidad: "capitulos", titulo: "Canciones", icon: "Music", orden: 21 },
    b: { entidad: "canciones", titulo: "Capítulos", icon: "BookOpen", orden: 21 },
    campos: [{ name: "contexto", label: "Contexto", tipo: "text", destacado: true }],
  },

  // ── Elementos (catálogo unificado) ────────────────────────────────────────
  // Una entrada por entidad porque la tabla es polimórfica: comparten tabla y
  // se distinguen por `entidad_tipo`.
  ...(
    [
      ["bestias", "Bestias", "PawPrint"],
      ["razas", "Razas", "Rabbit"],
      ["personajes", "Personajes", "Users"],
      ["naciones", "Naciones", "Globe2"],
      ["artefactos", "Artefactos", "Sword"],
      ["minerales", "Minerales", "Gem"],
    ] as const
  ).map(
    ([entidad, plural, icon], i): RelacionDef => ({
      id: `entidad_elemento:${entidad}`,
      medio: "tabla",
      a: { entidad, titulo: "Afinidades y debilidades", icon: "Sparkles", orden: 50 },
      // El catálogo lista una sección por tipo de ficha, no seis veces lo mismo.
      b: { entidad: "elementos", titulo: plural, icon, orden: 20 + i, sinPublico: true },
      campos: [
        { name: "relacion", label: "Tipo", tipo: "select", opciones: ["Afinidad", "Debilidad", "Resistencia"], destacado: true },
      ],
      fueraDelAtlas: true,
    }),
  ),

  // ── Relaciones nuevas, sobre la tabla genérica ────────────────────────────
  {
    id: "personaje_locacion",
    medio: "vinculo",
    relacion: "personaje_locacion",
    a: { entidad: "personajes", titulo: "Lugares", icon: "MapPin", orden: 36 },
    b: { entidad: "locaciones", titulo: "Personajes", icon: "Users", orden: 20 },
    campos: [
      { name: "tipo", label: "Vínculo", tipo: "select", opciones: ["Reside", "Nació", "Opera", "Murió", "Exiliado", "De paso"], destacado: true },
      NOTA,
    ],
  },
  {
    id: "personaje_bestia",
    medio: "vinculo",
    relacion: "personaje_bestia",
    a: { entidad: "personajes", titulo: "Bestias", icon: "PawPrint", orden: 37 },
    b: { entidad: "bestias", titulo: "Personajes", icon: "Users", orden: 24 },
    campos: [
      { name: "tipo", label: "Vínculo", tipo: "select", opciones: ["Montura", "Familiar", "Némesis", "Domesticada", "Cazador"], destacado: true },
      NOTA,
    ],
  },
  {
    id: "mision_bestia",
    medio: "vinculo",
    relacion: "mision_bestia",
    a: { entidad: "misiones", titulo: "Bestias", icon: "PawPrint", orden: 21 },
    b: { entidad: "bestias", titulo: "Misiones", icon: "Swords", orden: 25 },
    campos: [{ name: "tipo", label: "Papel", tipo: "select", opciones: ["Objetivo", "Amenaza", "Aliada"], destacado: true }, NOTA],
  },
  {
    id: "mision_locacion",
    medio: "vinculo",
    relacion: "mision_locacion",
    a: { entidad: "misiones", titulo: "Lugares", icon: "MapPin", orden: 22 },
    b: { entidad: "locaciones", titulo: "Misiones", icon: "Swords", orden: 21 },
    campos: [{ name: "tipo", label: "Papel", tipo: "select", opciones: ["Escenario", "Punto de partida", "Destino"], destacado: true }, NOTA],
  },
  {
    id: "mision_organizacion",
    medio: "vinculo",
    relacion: "mision_organizacion",
    a: { entidad: "misiones", titulo: "Organizaciones", icon: "Building2", orden: 23 },
    b: { entidad: "organizaciones", titulo: "Misiones", icon: "Swords", orden: 23 },
    campos: [{ name: "tipo", label: "Papel", tipo: "select", opciones: ["Encarga", "Respalda", "Se opone"], destacado: true }, NOTA],
  },
  {
    id: "organizacion_relacion",
    medio: "vinculo",
    relacion: "organizacion_relacion",
    a: { entidad: "organizaciones", titulo: "Otras organizaciones", icon: "Network", orden: 24 },
    b: { entidad: "organizaciones", titulo: "Otras organizaciones", icon: "Network", orden: 24 },
    campos: [
      { name: "tipo", label: "Relación", tipo: "select", opciones: ["Aliada", "Rival", "Filial", "Matriz", "Escisión", "Origen", "Infiltrada"], destacado: true },
      NOTA,
    ],
    reciproca: {
      campo: "tipo",
      inverso: { Filial: "Matriz", Matriz: "Filial", Escisión: "Origen", Origen: "Escisión" },
    },
  },
  {
    id: "familia_nacion",
    medio: "vinculo",
    relacion: "familia_nacion",
    a: { entidad: "familias", titulo: "Naciones", icon: "Globe2", orden: 21 },
    b: { entidad: "naciones", titulo: "Familias", icon: "Network", orden: 25 },
    campos: [{ name: "tipo", label: "Vínculo", tipo: "select", opciones: ["Gobierna", "Nobleza", "Exiliada", "Originaria"], destacado: true }, NOTA],
  },
  {
    id: "familia_organizacion",
    medio: "vinculo",
    relacion: "familia_organizacion",
    a: { entidad: "familias", titulo: "Organizaciones", icon: "Building2", orden: 22 },
    b: { entidad: "organizaciones", titulo: "Familias", icon: "Network", orden: 25 },
    campos: [{ name: "tipo", label: "Vínculo", tipo: "select", opciones: ["Fundadora", "Financia", "Controla", "Enfrentada"], destacado: true }, NOTA],
  },
  // Sedes y feudos: dónde se asienta una organización o una familia.
  ...(["locaciones", "regiones"] as const).flatMap((lugar): RelacionDef[] =>
    (["organizaciones", "familias"] as const).map((quien) => ({
      id: `sede:${lugar}:${quien}`,
      medio: "vinculo" as const,
      relacion: `sede_${lugar}_${quien}`,
      a: { entidad: lugar, titulo: quien === "organizaciones" ? "Organizaciones" : "Familias", icon: quien === "organizaciones" ? "Building2" : "Network", orden: quien === "organizaciones" ? 22 : 23 },
      b: { entidad: quien, titulo: lugar === "locaciones" ? "Sedes" : "Territorios", icon: lugar === "locaciones" ? "MapPin" : "MapPinned", orden: lugar === "locaciones" ? 26 : 27 },
      campos: [
        { name: "tipo", label: "Tipo", tipo: "select" as const, opciones: ["Sede", "Cuartel", "Feudo", "Refugio", "Presencia"], destacado: true },
        NOTA,
      ],
    })),
  ),
  // Fichas que pueden citar cualquier otra ficha del mundo.
  ...([
    ["lore", "Menciona", "Aparece en", "ScrollText", "menciona"],
    ["timeline", "Participantes", "Cronología", "Clock", "participa"],
    ["demonios", "Vinculado a", "Lords Demonio", "Flame", "demonio"],
    ["conceptos", "Encarnado en", "Conceptos", "Lightbulb", "concepto"],
    ["magia", "Practicado por", "Magia", "Sparkles", "magia"],
  ] as const).map(([entidad, tituloA, tituloB, icon, rel]): RelacionDef => ({
    id: `ref:${entidad}`,
    medio: "vinculo",
    relacion: rel,
    a: { entidad, titulo: tituloA, icon: "Link2", orden: 25 },
    b: { entidad: "*", titulo: tituloB, icon, orden: 60 },
    campos: [
      { name: "tipo", label: "Matiz", tipo: "text" },
      NOTA,
    ],
  })),
  // ── Referencias simples ───────────────────────────────────────────────────
  // Una columna de clave foránea, no una tabla N:M. Se registran igual que el
  // resto para que el reverso exista: desde una moneda se ven los minerales que
  // la usan, desde un capítulo los eventos que lo citan.
  ...(
    [
      ["raza_padre", "razas", "razaPadreId", "razas", "Deriva de", "GitBranch", "Sub-razas y variantes", "Rabbit"],
      ["magia_padre", "magia", "fundamentoPadreId", "magia", "Deriva de", "GitBranch", "Ramas derivadas", "Sparkles"],
      ["mineral_moneda", "minerales", "valorMonedaId", "economia", "Moneda de referencia", "Coins", "Minerales valorados", "Gem"],
      ["mision_encargante", "misiones", "personajeId", "personajes", "Encargada por", "UserRound", "Misiones que encarga", "Swords"],
      ["evento_capitulo", "timeline", "capituloId", "capitulos", "Capítulo", "BookOpen", "Eventos del capítulo", "Clock"],
      ["artefacto_propietario", "artefactos", "propietarioId", "personajes", "Propietario actual", "UserRound", "Objetos en propiedad", "Sword"],
      ["nacimiento_nacion", "personajes", "lugarNacimientoNacionId", "naciones", "Nació en (nación)", "Globe2", "Nacidos aquí", "Star"],
      ["nacimiento_region", "personajes", "lugarNacimientoRegionId", "regiones", "Nació en (región)", "MapPinned", "Nacidos aquí", "Star"],
      ["nacimiento_locacion", "personajes", "lugarNacimientoLocacionId", "locaciones", "Nació en (locación)", "MapPin", "Nacidos aquí", "Star"],
      ["region_nacion", "regiones", "nacionId", "naciones", "Nación", "Globe2", "Regiones", "MapPinned"],
      ["locacion_nacion", "locaciones", "nacionId", "naciones", "Nación", "Globe2", "Locaciones", "MapPin"],
      ["locacion_region", "locaciones", "regionId", "regiones", "Región", "MapPinned", "Locaciones", "MapPin"],
      ["locacion_evento", "locaciones", "eventoId", "timeline", "Evento asociado", "Clock", "Locaciones", "MapPin"],
    ] as const
  ).map(
    ([id, entA, columna, entB, tituloA, iconA, tituloB, iconB], i): RelacionDef => ({
      id,
      medio: "referencia",
      columna,
      a: { entidad: entA, titulo: tituloA, icon: iconA, orden: 70 + i },
      b: { entidad: entB, titulo: tituloB, icon: iconB, orden: 28 + i },
      campos: [],
    }),
  ),

];

/** Entidad comodín: la relación acepta fichas de cualquier tipo. */
export const CUALQUIERA = "*";

const PORID = new Map(RELACIONES.map((r) => [r.id, r]));

export function getRelacion(id: string): RelacionDef | undefined {
  return PORID.get(id);
}

function aBloque(rel: RelacionDef, lado: "a" | "b"): BloqueRelacion {
  const propio = lado === "a" ? rel.a : rel.b;
  const otro = lado === "a" ? rel.b : rel.a;
  return {
    relId: rel.id,
    lado,
    objetivo: otro.entidad,
    titulo: propio.titulo,
    icon: propio.icon,
    hint: propio.hint,
    orden: propio.orden,
    campos: rel.campos,
    ordenable: rel.ordenable ?? false,
    editorPropio: propio.editorPropio ?? false,
    sinPublico: propio.sinPublico ?? false,
    reflexiva: rel.a.entidad === rel.b.entidad,
    // El lado que posee la clave foránea sólo puede apuntar a una ficha.
    unico: rel.medio === "referencia" && lado === "a",
  };
}

/**
 * Todos los bloques de relación de una ficha, ya resueltos al lado que le toca
 * y ordenados. Aquí es donde una única declaración se convierte en los dos
 * sentidos: una relación cuyos dos extremos son la misma entidad aporta un solo
 * bloque, no dos iguales.
 */
export function bloquesDe(entidad: string): BloqueRelacion[] {
  const out: BloqueRelacion[] = [];
  for (const rel of RELACIONES) {
    const esA = rel.a.entidad === entidad || rel.a.entidad === CUALQUIERA;
    const esB = rel.b.entidad === entidad || rel.b.entidad === CUALQUIERA;
    if (esA) out.push(aBloque(rel, "a"));
    // Una relación reflexiva N:M se refleja sola (marcar A rival de B deja a B
    // rival de A), así que un único bloque ya muestra los dos sentidos y dos
    // serían idénticos. Una referencia reflexiva es otra cosa: "de quién deriva"
    // y "qué deriva de esto" son listas distintas y las dos hacen falta.
    const colapsa = esA && rel.a.entidad === rel.b.entidad && rel.medio !== "referencia";
    if (esB && !colapsa) out.push(aBloque(rel, "b"));
  }
  return out.sort((x, y) => x.orden - y.orden || x.titulo.localeCompare(y.titulo));
}

/** El bloque concreto de una ficha, o undefined si esa relación no le toca. */
export function bloqueDe(entidad: string, relId: string, lado: "a" | "b"): BloqueRelacion | undefined {
  const rel = PORID.get(relId);
  if (!rel) return undefined;
  const propio = lado === "a" ? rel.a : rel.b;
  if (propio.entidad !== entidad && propio.entidad !== CUALQUIERA) return undefined;
  return aBloque(rel, lado);
}

/**
 * Término que debe llevar la fila inversa. Los tipos simétricos ("Aliada")
 * no aparecen en el mapa y se copian tal cual, que es justo lo correcto.
 */
export function terminoInverso(rel: RelacionDef, valor: string | null | undefined): string | null {
  if (!rel.reciproca) return null;
  const v = (valor ?? "").trim();
  if (!v) return null;
  return rel.reciproca.inverso[v] ?? v;
}

/** Aristas que deben aparecer en el grafo del Atlas. */
export function relacionesDelAtlas(): RelacionDef[] {
  return RELACIONES.filter((r) => !r.fueraDelAtlas);
}
