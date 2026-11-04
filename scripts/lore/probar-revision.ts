/**
 * Comprueba las reglas de la revisión del lore (docs/area-ia.md, Fase 6) con una wiki
 * inventada: no toca la base. Sale con código 1 si algo falla.
 *
 *     pnpm --silent probar-revision
 *
 * Los nombres son de ejemplo: no es lore.
 */
import { claves } from "@/lib/fechas/calendario";
import type { Calendario, Fecha } from "@/lib/fechas/tipos";
import { aplicarExcepciones, delTema, informeCompleto, leerExcepciones, resumenParaChat } from "./revision/informe";
import { fichasDelTema, nombra, revisar } from "./revision/reglas";
import type { AristaFoto, FechaFoto, FichaFoto, Foto, TextoFicha } from "./revision/tipos";

let fallos = 0;
function igual(nombre: string, obtenido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a === b) return;
  fallos++;
  console.log(`✗ ${nombre}\n    obtenido: ${a}\n    esperado: ${b}`);
}

const CAL: Calendario = { segmentos: [{ id: 1, orden: 0, nombre: "Mes", dias: 360, tipo: "mes" }], diasSemana: [], eras: [{ id: 1, orden: 0, nombre: "Primera", abreviatura: null, anioInicio: null }] };

function ficha(entidad: string, id: number, nombre: string, extra: Partial<FichaFoto> & { texto?: Record<string, string> } = {}): FichaFoto {
  const { texto, ...resto } = extra;
  const ocultos = resto.ocultos ?? new Set<string>();
  const textos: TextoFicha[] = Object.entries(texto ?? {}).map(([campo, t]) => ({ campo, rotulo: campo, texto: t, oculto: ocultos.has(campo), privado: false, largo: t.length > 80 || campo === "historia" || campo === "descripcion" }));
  return { entidad, id, nombre, estado: "publicado", enPapelera: false, publica: true, valores: {}, textos, ocultos, ...resto };
}

function arista(relId: string, filaId: number, a: [string, number], b: [string, number] | null, extra: Partial<AristaFoto> = {}): AristaFoto {
  return { relId, filaId, a: { entidad: a[0], id: a[1] }, b: b ? { entidad: b[0], id: b[1] } : null, nombreLibre: null, campos: {}, oculto: false, ...extra };
}

function fecha(entidad: string, id: number, rol: string, anio: number, extra: Partial<FechaFoto> = {}): FechaFoto {
  const f: Fecha = { ini: { anio, segmentoId: null, dia: null }, fin: null, aproximada: false };
  const k = claves(CAL, f);
  return { entidad, id, rol, fecha: f, claveIni: k.ini, claveFin: k.fin, oculto: false, texto: `Año ${anio}`, ...extra };
}

function foto(p: Partial<Foto>): Foto {
  return { fichas: [], aristas: [], fechas: [], arbol: [], fragmentos: [], fases: [], polimorficas: [], vinculosRaros: [], fueraDeCatalogo: [], calendario: CAL, ...p };
}

/** Las claves de los hallazgos de una categoría. */
function claveDe(f: Foto, categoria: string): string[] {
  return revisar(f)
    .hallazgos.filter((h) => h.categoria === categoria)
    .map((h) => h.clave.replace(`${categoria}/`, ""))
    .sort();
}

// ── Buscar nombres ──────────────────────────────────────────────────────────

igual("nombra: con mayúscula y sin acentos", nombra("Vino de Pérez y de la Orden Abisal.", "ORDEN ABISAL"), true);
igual("nombra: una palabra común en minúscula no cuenta", nombra("Bajo la luna llena.", "Luna"), false);
igual("nombra: dentro de otra palabra no cuenta", nombra("Los Lunáticos llegaron.", "Luna"), false);
igual("nombra: los nombres muy cortos no se buscan", nombra("Vio a Ana.", "Ana"), false);
igual("nombra: con acento en el texto y sin él en el nombre", nombra("Llegó Álvaro.", "Alvaro"), true);

// ── Fechas ──────────────────────────────────────────────────────────────────

const ana = ficha("personajes", 1, "Ana Prado");
const evento = ficha("timeline", 10, "La Batalla");

igual(
  "muerte antes de nacer",
  claveDe(foto({ fichas: [ana], fechas: [fecha("personajes", 1, "nacimiento", 50), fecha("personajes", 1, "muerte", 20)] }), "fechas"),
  ["fin-antes-de-inicio:personajes#1"],
);
igual(
  "misma fecha o en orden: nada",
  claveDe(foto({ fichas: [ana], fechas: [fecha("personajes", 1, "nacimiento", 20), fecha("personajes", 1, "muerte", 20)] }), "fechas"),
  [],
);
igual(
  "fechas imprecisas que podrían cuadrar: nada",
  claveDe(
    foto({
      fichas: [ana],
      fechas: [
        { ...fecha("personajes", 1, "nacimiento", 10), claveIni: 3600, claveFin: 7199 },
        { ...fecha("personajes", 1, "muerte", 15), claveIni: 3600, claveFin: 7199 },
      ],
    }),
    "fechas",
  ),
  [],
);
const fotoEvento = (anioEvento: number, extra: Partial<FichaFoto> = {}) =>
  foto({
    fichas: [{ ...ana, ...extra }, evento],
    aristas: [arista("personaje_evento", 1, ["personajes", 1], ["timeline", 10])],
    fechas: [fecha("personajes", 1, "nacimiento", 0), fecha("personajes", 1, "muerte", 30), fecha("timeline", 10, "principal", anioEvento)],
  });
igual("evento antes de nacer", claveDe(fotoEvento(-5), "fechas"), ["evento-antes-de-nacer:1:timeline#10"]);
igual("evento tras morir", claveDe(fotoEvento(40), "fechas"), ["evento-tras-morir:1:timeline#10"]);
igual("evento en vida", claveDe(fotoEvento(10), "fechas"), []);
igual("un no-muerto sí actúa tras morir", claveDe(fotoEvento(40, { valores: { estadoVital: "No-muerto" } }), "fechas"), []);

const orden = ficha("organizaciones", 20, "ORDEN UNO");
igual(
  "miembro muerto antes de la fundación",
  claveDe(
    foto({
      fichas: [ana, orden],
      aristas: [arista("org_jerarquia", 1, ["organizaciones", 20], ["personajes", 1])],
      fechas: [fecha("personajes", 1, "muerte", -100), fecha("organizaciones", 20, "fundacion", 0)],
    }),
    "fechas",
  ),
  ["miembro-muerto-antes:1:organizaciones#20"],
);

const beto = ficha("personajes", 2, "Beto Prado");
const familia = ficha("familias", 30, "CASA PRADO", { valores: { apellido: "Prado" } });
const arbol = [
  { id: 1, familiaId: 30, nombre: "Ana Prado", personajeId: 1, padreId: null, madreId: null },
  { id: 2, familiaId: 30, nombre: "Beto Prado", personajeId: 2, padreId: 1, madreId: null },
];
igual(
  "progenitor más joven, según el árbol",
  claveDe(foto({ fichas: [ana, beto, familia], arbol, fechas: [fecha("personajes", 1, "nacimiento", 50), fecha("personajes", 2, "nacimiento", 10)] }), "fechas"),
  ["progenitor-menor:1:2"],
);
igual(
  "progenitor muerto hace más de un año",
  claveDe(foto({ fichas: [ana, beto, familia], arbol, fechas: [fecha("personajes", 1, "muerte", 5), fecha("personajes", 2, "nacimiento", 10)] }), "fechas"),
  ["progenitor-muerto:1:2"],
);
igual(
  "progenitor que muere el año de antes: nada",
  claveDe(foto({ fichas: [ana, beto, familia], arbol, fechas: [fecha("personajes", 1, "muerte", 9), fecha("personajes", 2, "nacimiento", 10)] }), "fechas"),
  [],
);
igual(
  "una relación «Padre» no entra en la regla de fechas",
  claveDe(
    foto({
      fichas: [ana, beto],
      aristas: [arista("relaciones", 1, ["personajes", 1], ["personajes", 2], { campos: { tipoRelacion: "Padre" } })],
      fechas: [fecha("personajes", 1, "nacimiento", 50), fecha("personajes", 2, "nacimiento", 10)],
    }),
    "fechas",
  ),
  [],
);
igual(
  "vivo con fecha de muerte",
  claveDe(foto({ fichas: [{ ...ana, valores: { estadoVital: "Vivo" } }], fechas: [fecha("personajes", 1, "muerte", 5)] }), "fechas"),
  ["vivo-con-muerte:1"],
);

// ── Conexiones ──────────────────────────────────────────────────────────────

const naciones = [ficha("naciones", 1, "UNO"), ficha("naciones", 2, "DOS")];
igual(
  "recíproca sin la fila de vuelta",
  claveDe(foto({ fichas: naciones, aristas: [arista("nacion_diplomacia", 7, ["naciones", 1], ["naciones", 2], { campos: { tipo: "Aliada" } })] }), "conexiones"),
  ["sin-reflejo:nacion_diplomacia:7"],
);
igual(
  "recíproca que casa",
  claveDe(
    foto({
      fichas: naciones,
      aristas: [
        arista("nacion_diplomacia", 7, ["naciones", 1], ["naciones", 2], { campos: { tipo: "Vasalla" } }),
        arista("nacion_diplomacia", 8, ["naciones", 2], ["naciones", 1], { campos: { tipo: "Soberana" } }),
      ],
    }),
    "conexiones",
  ),
  [],
);
igual(
  "recíprocas que se contradicen",
  claveDe(
    foto({
      fichas: naciones,
      aristas: [
        arista("nacion_diplomacia", 7, ["naciones", 1], ["naciones", 2], { campos: { tipo: "Aliada" } }),
        arista("nacion_diplomacia", 8, ["naciones", 2], ["naciones", 1], { campos: { tipo: "Enemiga" } }),
      ],
    }),
    "conexiones",
  ),
  ["se-contradicen:nacion_diplomacia:1:2"],
);
igual(
  "los personajes no necesitan la fila de vuelta",
  claveDe(foto({ fichas: [ana, beto], aristas: [arista("relaciones", 1, ["personajes", 1], ["personajes", 2], { campos: { tipoRelacion: "Rival" } })] }), "conexiones"),
  [],
);
igual(
  "relación con otro género en la vuelta: casa",
  claveDe(
    foto({
      fichas: [ana, beto],
      aristas: [
        arista("relaciones", 1, ["personajes", 1], ["personajes", 2], { campos: { tipoRelacion: "Madre" } }),
        arista("relaciones", 2, ["personajes", 2], ["personajes", 1], { campos: { tipoRelacion: "Hija" } }),
      ],
    }),
    "conexiones",
  ),
  [],
);
const razas = [ficha("razas", 1, "ALFA"), ficha("razas", 2, "BETA")];
igual(
  "derivación en círculo",
  claveDe(foto({ fichas: razas, aristas: [arista("raza_padre", 1, ["razas", 1], ["razas", 2]), arista("raza_padre", 2, ["razas", 2], ["razas", 1])] }), "conexiones"),
  ["ciclo:raza_padre:1"],
);
igual(
  "locación cuya región es de otra nación",
  claveDe(
    foto({
      fichas: [...naciones, ficha("regiones", 5, "NORTE", { valores: { nacionId: 2 } }), ficha("locaciones", 6, "PUERTO", { valores: { nacionId: 1, regionId: 5 } })],
    }),
    "conexiones",
  ),
  ["lugar-contradice:6"],
);
igual(
  "apellido de una familia sin ser miembro",
  claveDe(foto({ fichas: [{ ...ana, valores: { surname: "Prado" } }, familia] }), "conexiones"),
  ["apellido-sin-familia:1:30"],
);
igual(
  "nombre suelto de quien tiene ficha",
  claveDe(foto({ fichas: [ana, orden], aristas: [arista("org_jerarquia", 3, ["organizaciones", 20], null, { nombreLibre: "ana prado" })] }), "conexiones"),
  ["nombre-suelto:org_jerarquia:3"],
);

igual(
  "dos fichas del mismo tipo con el mismo nombre",
  claveDe(foto({ fichas: [ficha("timeline", 1, "La Promesa"), ficha("timeline", 2, "la promesa"), ficha("personajes", 3, "La Promesa")] }), "conexiones"),
  ["nombre-repetido:timeline:la promesa"],
);

// ── Referencias ─────────────────────────────────────────────────────────────

igual(
  "conexión a una ficha que no existe",
  claveDe(foto({ fichas: [ana], aristas: [arista("personaje_raza", 1, ["personajes", 1], ["razas", 99])] }), "referencias"),
  ["conexion-rota:personaje_raza:1"],
);
igual(
  "conexión a la papelera y a un borrador",
  claveDe(
    foto({
      fichas: [ana, ficha("razas", 1, "ALFA", { enPapelera: true, publica: false }), ficha("razas", 2, "BETA", { estado: "borrador", publica: false })],
      aristas: [arista("personaje_raza", 1, ["personajes", 1], ["razas", 1]), arista("personaje_raza", 2, ["personajes", 1], ["razas", 2])],
    }),
    "referencias",
  ),
  ["conexion-a-papelera:personaje_raza:1", "enlaza-a-no-publica:personaje_raza:2"],
);
igual(
  "un catálogo conectado con un borrador: el lector nunca ve ese lado",
  claveDe(
    foto({
      fichas: [ficha("elementos", 10, "Neutro"), ficha("minerales", 1, "Hierro", { estado: "borrador", publica: false })],
      aristas: [arista("entidad_elemento:minerales", 14, ["minerales", 1], ["elementos", 10])],
    }),
    "referencias",
  ),
  [],
);
igual(
  "enlaces dentro de un texto",
  claveDe(
    foto({
      fichas: [
        ficha("lore", 1, "Tema", { texto: { descripcion: "Ver [a](/personajes/1), [b](/personajes/99) y [c](/razas/2)." } }),
        ana,
        ficha("razas", 2, "BETA", { estado: "borrador", publica: false }),
      ],
    }),
    "referencias",
  ),
  ["enlace-no-publico:lore#1:descripcion:/razas/2", "enlace-roto:lore#1:descripcion:/personajes/99"],
);
igual(
  "fecha cuya posición no coincide",
  claveDe(foto({ fichas: [ana], fechas: [{ ...fecha("personajes", 1, "nacimiento", 5), claveIni: 1 }] }), "referencias"),
  ["fecha-desordenada:personajes#1:nacimiento"],
);
igual("fila polimórfica huérfana", claveDe(foto({ polimorficas: [{ tabla: "Una nota de autor", filaId: 4, entidad: "razas", id: 99 }] }), "referencias"), ["huerfana:Una nota de autor:4"]);

// ── Secretos ────────────────────────────────────────────────────────────────

const alias = ficha("personajes", 3, "El Forastero", { ocultos: new Set(["nombreReal"]), texto: { nombreReal: "Darius Vael" } });
const cronica = (texto: string, extra: Partial<FichaFoto> = {}) => ficha("timeline", 11, "Crónica", { texto: { descripcion: texto }, ...extra });
const clavesSecreto = (f: Foto) => claveDe(f, "secretos").map((c) => c.split(":")[0]);

igual("dato oculto en un texto público", clavesSecreto(foto({ fichas: [alias, cronica("Y entonces llegó darius vael a la ciudad.")] })), ["dato-en-texto"]);
igual("dato oculto dentro de un trozo oculto del otro texto: nada", clavesSecreto(foto({ fichas: [alias, cronica("Llegó [[oculto]]Darius Vael[[/oculto]] a la ciudad.")] })), []);
igual("dato oculto en un borrador: nada", clavesSecreto(foto({ fichas: [alias, cronica("Llegó Darius Vael.", { publica: false, estado: "borrador" })] })), []);
igual(
  "trozo oculto repetido en público",
  clavesSecreto(foto({ fichas: [ficha("razas", 1, "ALFA", { texto: { descripcion: "Su rey es [[oculto]]Darius Vael[[/oculto]], según dicen." } }), cronica("Llegó Darius Vael.")] })),
  ["dato-en-texto"],
);
igual(
  "conexión oculta contada en público",
  clavesSecreto(
    foto({
      fichas: [ficha("personajes", 1, "Ana Prado", { texto: { historia: "Trabaja para la Orden Uno desde hace años, sin que nadie lo sepa." } }), orden],
      aristas: [arista("org_jerarquia", 1, ["organizaciones", 20], ["personajes", 1], { oculto: true })],
    }),
  ),
  ["conexion-en-texto"],
);
igual(
  "ficha oculta nombrada en público",
  clavesSecreto(foto({ fichas: [ficha("personajes", 4, "Ofelia", { estado: "oculto", publica: false }), cronica("Ofelia lo sabía.")] })),
  ["ficha-oculta-en-texto"],
);
igual(
  "muerte oculta delatada por el estado vital",
  clavesSecreto(foto({ fichas: [{ ...ana, valores: { estadoVital: "Fallecido" } }], fechas: [fecha("personajes", 1, "muerte", 5, { oculto: true })] })),
  ["muerte-delatada"],
);
const acto = ficha("actos", 40, "Acto Uno");
const fragmento = ficha("fragmentos", 41, "Fragmento", { ocultos: new Set(["personajeId"]), estado: "publicado" });
igual(
  "POV oculto en el fragmento y visible en el acto",
  clavesSecreto(
    foto({
      fichas: [ana, acto, fragmento],
      fragmentos: [{ id: 41, actoId: 40, personajeId: 1, titulo: null }],
      aristas: [arista("acto_pov", 1, ["actos", 40], ["personajes", 1])],
    }),
  ),
  ["pov-delatado"],
);
igual(
  "POV oculto también en el acto: nada",
  clavesSecreto(
    foto({
      fichas: [ana, acto, fragmento],
      fragmentos: [{ id: 41, actoId: 40, personajeId: 1, titulo: null }],
      aristas: [arista("acto_pov", 1, ["actos", 40], ["personajes", 1], { oculto: true })],
    }),
  ),
  [],
);
igual(
  "fecha oculta en el fragmento y visible en el acto",
  clavesSecreto(
    foto({
      fichas: [acto, ficha("fragmentos", 41, "Fragmento")],
      fragmentos: [{ id: 41, actoId: 40, personajeId: null, titulo: null }],
      fechas: [fecha("fragmentos", 41, "principal", 5, { oculto: true }), fecha("actos", 40, "principal", 5)],
    }),
  ),
  ["fecha-delatada"],
);
igual("trozo sin cerrar", clavesSecreto(foto({ fichas: [cronica("Uno [[oculto]]dos, y sigue.")] })), ["trozo-sin-cerrar"]);
igual("cierre suelto", clavesSecreto(foto({ fichas: [cronica("Uno dos[[/oculto]] y sigue.")] })), ["cierre-suelto"]);

// ── Taller ──────────────────────────────────────────────────────────────────

const capUno = ficha("capitulos", 1, "Uno", { valores: { libro: "L", orden: 0 } });
const capDos = ficha("capitulos", 2, "Dos", { estado: "borrador", publica: false, valores: { libro: "L", orden: 1 } });
const actoUno = ficha("actos", 1, "Primero", { valores: { capituloId: 1, numeroOrden: 0 } });
const actoDos = ficha("actos", 2, "Segundo", { valores: { capituloId: 2, numeroOrden: 0 } });
const tallerBase = { fichas: [capUno, capDos, actoUno, actoDos] };
igual("acto publicado en un capítulo en borrador", claveDe(foto(tallerBase), "taller"), ["acto-publicado-sin-capitulo:2"]);
const hilo = (valores: Record<string, unknown>) => ficha("hilos", 5, "Hilo", { publica: false, estado: "borrador", valores });
igual(
  "hilo cerrado antes de abrirse",
  claveDe(foto({ ...tallerBase, fichas: [...tallerBase.fichas, hilo({ actoAperturaId: 2, actoCierreId: 1 })] }), "taller").filter((c) => c.startsWith("hilo")),
  ["hilo-al-reves:5"],
);
igual(
  "hilo sin cerrar",
  claveDe(foto({ ...tallerBase, fichas: [...tallerBase.fichas, hilo({ actoAperturaId: 1, estado: "Abierto" })] }), "taller").filter((c) => c.startsWith("hilo")),
  ["hilo-sin-cerrar:5"],
);
igual(
  "hilo con cierre y estado abierto",
  claveDe(foto({ ...tallerBase, fichas: [...tallerBase.fichas, hilo({ actoAperturaId: 1, actoCierreId: 2, estado: "Abierto" })] }), "taller").filter((c) => c.startsWith("hilo")),
  ["hilo-estado-contradice:5"],
);
igual(
  "hoja cuyo acto no es de su capítulo",
  claveDe(foto({ ...tallerBase, fichas: [...tallerBase.fichas, ficha("hojas", 6, "Hoja", { publica: false, valores: { arcoId: 1, actoId: 2, capituloId: 1 } })] }), "taller").filter((c) => c.startsWith("hoja")),
  ["hoja-capitulo-contradice:6"],
);
igual(
  "acto con una fase de otra plantilla",
  claveDe(
    foto({
      fases: [{ id: 1, plantillaId: 9 }],
      fichas: [ficha("capitulos", 1, "Uno", { valores: { plantillaId: 8, libro: "L", orden: 0 } }), ficha("actos", 1, "Primero", { valores: { capituloId: 1, faseId: 1, numeroOrden: 0 } })],
    }),
    "taller",
  ),
  ["acto-fase-ajena:1"],
);

// ── Menciones ───────────────────────────────────────────────────────────────

igual(
  "un texto nombra una ficha sin conexión",
  claveDe(foto({ fichas: [ficha("personajes", 1, "Ana Prado", { texto: { historia: "Nació en la nación de Sylvia, al norte de todo." } }), ficha("naciones", 2, "SYLVIA")] }), "menciones"),
  ["personajes#1:naciones#2"],
);
igual(
  "con la conexión hecha: nada",
  claveDe(
    foto({
      fichas: [ficha("personajes", 1, "Ana Prado", { texto: { historia: "Nació en la nación de Sylvia, al norte de todo." } }), ficha("naciones", 2, "SYLVIA")],
      aristas: [arista("personaje_nacion", 1, ["personajes", 1], ["naciones", 2])],
    }),
    "menciones",
  ),
  [],
);
igual(
  "nombrar una página de lore no pide conexión",
  claveDe(foto({ fichas: [ficha("organizaciones", 1, "UNA", { texto: { descripcion: "Nació en tiempos de Altavera, antes de que todo cambiara para siempre." } }), ficha("lore", 2, "Altavera")] }), "menciones"),
  [],
);
igual(
  "tipos sin ninguna conexión posible: nada",
  claveDe(foto({ fichas: [ficha("minerales", 1, "Hierro", { texto: { descripcion: "Se extrae en la nación de Sylvia desde hace siglos, según cuentan." } }), ficha("naciones", 2, "SYLVIA")] }), "menciones"),
  [],
);

// ── Guía ────────────────────────────────────────────────────────────────────

igual(
  "mayúsculas, inicial, alias y restos de prueba",
  claveDe(
    foto({
      fichas: [
        ficha("naciones", 1, "Sylvia"),
        ficha("personajes", 2, "ana"),
        ficha("personajes", 3, "???Sombra"),
        ficha("bestias", 4, "Prueba 2"),
        ficha("razas", 5, "ALFA", { texto: { descripcion: "Hola como estan" } }),
        ficha("razas", 6, "BETA", { texto: { descripcion: "<p>Un pueblo</p> muy antiguo que vive en el bosque desde siempre, según las crónicas." } }),
        ficha("razas", 7, "GAMMA", { texto: { descripcion: "Si tú lo ves, corre lejos porque es un pueblo peligroso y bastante antiguo." } }),
        ficha("razas", 8, "DELTA", { texto: { descripcion: 'Su lema dice "tú no pasarás" y lo repiten en cada batalla, desde siempre.' } }),
      ],
    }),
    "guia",
  ),
  [
    "alias-pendiente:3",
    "habla-al-lector:razas#7:descripcion",
    "inicial:personajes#2",
    "mayusculas:naciones#1",
    "nombre-de-prueba:bestias#4",
    "resto-html:razas#6:descripcion",
    "texto-de-prueba:razas#5:descripcion",
  ],
);

igual(
  "un texto que empieza por «Todo» o una palabra suelta no son restos de prueba",
  claveDe(foto({ fichas: [ficha("razas", 1, "ALFA", { texto: { descripcion: "Todo lo que ocurre en este mundo sucede por una razón que nadie recuerda ya." } }), ficha("razas", 2, "BETA", { texto: { descripcion: "Subsuelo" } }), ficha("razas", 3, "GAMMA", { texto: { descripcion: "Grandes." } })] }), "guia"),
  ["texto-muy-corto:razas#2:descripcion", "texto-muy-corto:razas#3:descripcion"],
);
igual(
  "texto tecleado al azar",
  claveDe(foto({ fichas: [ficha("razas", 1, "ALFA", { texto: { descripcion: "rgshbwssssss" } }), ficha("razas", 2, "BETA", { texto: { descripcion: "qgewg" } })] }), "guia"),
  ["texto-de-prueba:razas#1:descripcion", "texto-de-prueba:razas#2:descripcion"],
);

// ── Fichas a medias ─────────────────────────────────────────────────────────

const fotoHuecos = foto({
  fichas: [
    ficha("personajes", 1, "Vacía Publicada"),
    ficha("personajes", 2, "Vacía Borrador", { estado: "borrador", publica: false }),
    ficha("personajes", 3, "A Medias", { texto: { historia: "Una historia." } }),
    ficha("timeline", 4, "Evento Sin Fecha", { texto: { descripcion: "Pasó algo importante en el mundo, y lo cuentan durante mucho tiempo." } }),
    ficha("personajes", 5, "Completa", { texto: { historia: "Una historia." } }),
    ficha("razas", 6, "ALFA", { texto: { descripcion: "Un pueblo." }, publica: false, estado: "borrador" }),
    ficha("personajes", 7, "En La Papelera", { enPapelera: true, publica: false }),
  ],
  aristas: [arista("personaje_raza", 1, ["personajes", 5], ["razas", 6])],
  fechas: [fecha("personajes", 5, "nacimiento", 1)],
});
igual("huecos: una a una, solo las publicadas", claveDe(fotoHuecos, "huecos"), ["a-medias:personajes#3", "a-medias:timeline#4", "vacia:personajes#1"]);
const resumen = revisar(fotoHuecos).resumen.find((r) => r.entidad === "personajes");
igual("huecos: las cuentas incluyen los borradores y no la papelera", [resumen?.total, resumen?.publicas, resumen?.vacias, resumen?.vaciasPublicas, resumen?.aMedias], [4, 3, 2, 1, 1]);
igual(
  "un capítulo con actos no está vacío",
  claveDe(foto({ fichas: [ficha("capitulos", 1, "Uno"), ficha("actos", 2, "Primero", { texto: { descripcion: "Un resumen." }, valores: { capituloId: 1 } })], fechas: [fecha("actos", 2, "principal", 1)], aristas: [arista("acto_pov", 1, ["actos", 2], ["personajes", 9])] }), "huecos"),
  [],
);
igual(
  "era sin año de inicio",
  claveDe(foto({ calendario: { ...CAL, eras: [...CAL.eras, { id: 2, orden: 1, nombre: "Segunda", abreviatura: null, anioInicio: null }] } }), "huecos"),
  ["era-sin-inicio:2"],
);

// ── Informe y excepciones ───────────────────────────────────────────────────

const f = foto({ fichas: [ana], fechas: [fecha("personajes", 1, "nacimiento", 50), fecha("personajes", 1, "muerte", 20)] });
const { hallazgos } = revisar(f);
const claveMuerte = "fechas/fin-antes-de-inicio:personajes#1";
const exc = leerExcepciones(`# Título\n\nTexto suelto.\n\n- \`${claveMuerte}\` — Es a propósito\n- \`otra/que-no-existe:1\`\n`);
igual("excepciones: claves y motivo", [...exc], [[claveMuerte, "Es a propósito"], ["otra/que-no-existe:1", ""]]);
const conExc = aplicarExcepciones(hallazgos, exc);
igual("excepciones: se omiten y las viejas se avisan", [conExc.visibles.some((h) => h.clave === claveMuerte), conExc.omitidos, conExc.vencidas], [false, 1, ["otra/que-no-existe:1"]]);
igual("tema: solo lo de sus fichas", delTema(hallazgos, new Set(["razas#1"])), []);
igual(
  "fichas del tema: por nombre o por texto",
  fichasDelTema(foto({ fichas: [ana, cronica("Llegó Álvaro."), ficha("razas", 1, "ALVARO"), ficha("razas", 2, "OTRA")] }), "alvaro").map((x) => x.id),
  [11, 1],
);
const datosInforme = { fecha: "2026-01-01", tema: null, visibles: hallazgos, omitidos: 1, vencidas: ["x/y"], resumen: [], fichasTema: [] };
const archivo = informeCompleto(datosInforme);
igual("informe: lleva el texto y la clave", [archivo.includes("Ana Prado"), archivo.includes(claveMuerte), archivo.includes("`x/y`")], [true, true, true]);
igual("resumen: cuenta lo grave", resumenParaChat(datosInforme, "r.md").split("\n")[0], "Revisión de toda la wiki: 2 avisos, 1 grave. 1 excepción omitida.");

if (fallos) {
  console.log(`\n${fallos} comprobaciones fallidas.`);
  process.exit(1);
}
console.log("Todo bien.");
