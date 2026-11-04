/**
 * Comprueba lo puro de la bandeja de propuestas (docs/area-ia.md, Fase 5): el lector del
 * formato, las fechas escritas, la comparación y la reescritura del archivo. No toca la
 * base. Sale con código 1 si algo falla.
 *
 *     pnpm --silent probar-propuestas
 *
 * Los nombres del ejemplo son los de docs/propuestas-formato.md: no es lore.
 */
import { formatoFecha } from "@/lib/fechas/formato";
import { leerFecha } from "@/lib/fechas/leer";
import type { Calendario, Fecha } from "@/lib/fechas/tipos";
import { bloquePendiente, estaVacio, reemplazarBloque } from "@/lib/propuestas/archivo";
import { diferencias } from "@/lib/propuestas/diff";
import { leerFila, leerPropuesta } from "@/lib/propuestas/formato";

let fallos = 0;
function igual(nombre: string, obtenido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a === b) return;
  fallos++;
  console.log(`✗ ${nombre}\n    obtenido: ${a}\n    esperado: ${b}`);
}

// ── Formato ────────────────────────────────────────────────────────────────

const EJEMPLO = `<!-- 2026-11-03 · entrevista sobre la Orden -->

## Personaje: Kael Varn · nueva
- Estado: borrador
- Apellido: Varn
- Género: Masculino
- Ocupación: Cartógrafo (opción nueva)
- Edad (texto): 34 🔒

### Historia
Primer párrafo.

- Una lista dentro del texto: no es un campo.

Segundo párrafo con [[oculto]]un secreto[[/oculto]].

### Miedos 🔒
A las alturas.

### Conexiones
- Organizaciones: ORDEN ABISAL (Rol: Ex miembro; Rango: Capitán) 🔒
- Nació en (nación): SYLVATERRA
- Relaciones: Alhaitham #33 (Relación: Rival; Matiz: Antiguo amigo)
- quitar Objetos: Clorofilo Refulgente

### Fechas
- Nacimiento: Año -34 🔒
- Muerte: 20 de Mes 3, año 12 ★

### Habilidades
- Puño de Ceniza (Categoría: Técnicas; Tipo: Elemental; Elemento: Fuego): Golpea y quema: mucho. 🔒
- quitar Salto

### Estadísticas 🔒
- Fuerza: 7
- C. a cuerpo: S

### Notas de autor
Lo que solo ve el autor.
<!-- vacío: Título -->

<!-- 2026-11-04 · otra cosa -->

## Personaje #33: Alhaitham · cambios
- Ocupación (detalle): (vaciar)

### Historia (añadir)
Otro párrafo más.

### Algo que no existe
Texto raro.

## Organización: ORDEN ABISAL · nueva

### Rangos
- Gran Maestre
- Capitán

### Facciones
- Ala Norte (Color: #5b8def)

### Historial
- Fundador (Rol: Líder; Periodo: Era vieja; Destacado: Fundó la orden) 🔒

### Conexiones
- Miembros: Anciano sin nombre (sin ficha; Rango: Capitán)

## Familia: CASA VARN · nueva

### Árbol genealógico
- Aldric (Generación: 0; Estado: Fallecido)
- Kael Varn (Generación: 1; Padre: Aldric) 🔒

## Página de lore: Un tema · nueva
### Introducción
Texto de la introducción.

### Sección: Un apartado (Tipo: Cita) 🔒
Primera línea.
Segunda línea.

## Acto: Despertar · nueva
- Capítulo: Prólogo

### Fragmentos
- Primer tramo (POV: Kael Varn; Enlace: https://ejemplo.test/a; Fecha: Año 3) 🔒
- (POV: Alhaitham)

## Suelto: La traición de la Orden
Una idea sin sitio todavía.

## Esto no es una cabecera
Texto.

## Dragón: Nadie · nueva
- Fuego: mucho
`;

const p = leerPropuesta(EJEMPLO);
igual("nº de fichas", p.fichas.length, 6);
igual("sueltos", p.sueltos.map((s) => [s.titulo, s.texto]), [["La traición de la Orden", "Una idea sin sitio todavía."]]);
igual("bloques raros", p.raros.length, 2);

const kael = p.fichas[0];
igual("kael: cabecera", [kael.entidad, kael.id, kael.nombre, kael.modo, kael.estado], ["personajes", null, "Kael Varn", "nueva", "borrador"]);
const dato = (ficha: typeof kael, rotulo: string, clase?: string) => ficha.datos.find((d) => d.rotulo === rotulo && (!clase || d.clase === clase))!;
igual("campo de una línea", [dato(kael, "Apellido").campo, dato(kael, "Apellido").valor], ["surname", "Varn"]);
igual("opción nueva", [dato(kael, "Ocupación").valor, dato(kael, "Ocupación").opcionNueva], ["Cartógrafo", true]);
igual("candado en línea", [dato(kael, "Edad (texto)").valor, dato(kael, "Edad (texto)").oculto], ["34", true]);
igual(
  "texto largo con lista dentro",
  dato(kael, "Historia").valor,
  "Primer párrafo.\n\n- Una lista dentro del texto: no es un campo.\n\nSegundo párrafo con [[oculto]]un secreto[[/oculto]].",
);
igual("candado en encabezado", [dato(kael, "Miedos").valor, dato(kael, "Miedos").oculto], ["A las alturas.", true]);

const org = dato(kael, "Organizaciones");
igual("conexión", [org.clase, org.nombre, org.oculto, org.subcampos], ["conexion", "ORDEN ABISAL", true, [{ label: "Rol", valor: "Ex miembro" }, { label: "Rango", valor: "Capitán" }]]);
igual("título con paréntesis", [dato(kael, "Nació en (nación)").clase, dato(kael, "Nació en (nación)").nombre], ["conexion", "SYLVATERRA"]);
igual("nombre con id", [dato(kael, "Relaciones").nombre, dato(kael, "Relaciones").idFicha], ["Alhaitham", 33]);
igual("quitar conexión", [dato(kael, "Objetos").clase, dato(kael, "Objetos").nombre], ["quitar", "Clorofilo Refulgente"]);
igual("fecha oculta", [dato(kael, "Nacimiento").valor, dato(kael, "Nacimiento").oculto], ["Año -34", true]);
igual("fecha importante", [dato(kael, "Muerte").valor, dato(kael, "Muerte").importante], ["20 de Mes 3, año 12", true]);

const habs = kael.datos.filter((d) => d.lista === "habilidades");
igual("habilidad", [habs[0].clase, habs[0].nombre, habs[0].valor, habs[0].oculto, habs[0].subcampos?.length], ["lista", "Puño de Ceniza", "Golpea y quema: mucho.", true, 3]);
igual("quitar de una lista", [habs[1].clase, habs[1].nombre], ["quitar-lista", "Salto"]);
const st = dato(kael, "Estadísticas");
igual("estadísticas", [st.clase, st.oculto, st.subcampos], ["estadisticas", true, [{ label: "Fuerza", valor: "7" }, { label: "C. a cuerpo", valor: "S" }]]);
igual("notas sin comentarios", dato(kael, "Notas de autor").valor, "Lo que solo ve el autor.");

const alhaitham = p.fichas[1];
igual("cambios", [alhaitham.modo, alhaitham.id], ["cambios", 33]);
igual("vaciar", dato(alhaitham, "Ocupación (detalle)").vaciar, true);
igual("añadir", [dato(alhaitham, "Historia").anadir, dato(alhaitham, "Historia").valor], [true, "Otro párrafo más."]);
igual("sección desconocida", dato(alhaitham, "Algo que no existe").clase, "desconocido");

const orden = p.fichas[2];
igual("rangos", orden.datos.filter((d) => d.lista === "rangos").map((d) => d.nombre), ["Gran Maestre", "Capitán"]);
igual("facción con color", orden.datos.find((d) => d.lista === "facciones")?.subcampos, [{ label: "Color", valor: "#5b8def" }]);
igual("historial", [dato(orden, "Historial").nombre, dato(orden, "Historial").oculto, dato(orden, "Historial").subcampos?.length], ["Fundador", true, 3]);
igual("miembro sin ficha", [dato(orden, "Miembros").nombre, dato(orden, "Miembros").sinFicha], ["Anciano sin nombre", true]);

const casa = p.fichas[3];
igual("árbol", casa.datos.map((d) => [d.nombre, d.oculto]), [["Aldric", false], ["Kael Varn", true]]);

const pagina = p.fichas[4];
const sec = pagina.datos.find((d) => d.lista === "secciones")!;
igual("sección de lore", [sec.nombre, sec.valor, sec.oculto, sec.subcampos], ["Un apartado", "Primera línea.\nSegunda línea.", true, [{ label: "Tipo", valor: "Cita" }]]);

const acto = p.fichas[5];
const frag = acto.datos.filter((d) => d.lista === "fragmentos");
igual("fragmento", [frag[0].nombre, frag[0].oculto, frag[0].subcampos?.find((s) => s.label === "Enlace")?.valor], ["Primer tramo", true, "https://ejemplo.test/a"]);
igual("fragmento sin título", [frag[1].nombre, frag[1].subcampos], ["", [{ label: "POV", valor: "Alhaitham" }]]);

igual("fila con paréntesis en el nombre", leerFila("Kael (el joven) (Rol: X)").nombre, "Kael (el joven)");
igual("fila con estado detrás", leerFila("Kael (Rol: X) [borrador]").nombre, "Kael");

// Los rótulos repetidos en una ficha se distinguen por cómo viene el valor.
const raza = leerPropuesta(`## Raza: Prueba · nueva
- Longevidad: 80
- Longevidad: Larga
`).fichas[0];
igual("rótulo repetido", raza.datos.map((d) => d.campo), ["statLongevidad", "longevidad"]);
igual("«Estado» que es un campo", leerPropuesta(`## Organización: X · nueva
- Estado: Activa
`).fichas[0].datos[0].campo, "estado");

// ── Fechas ─────────────────────────────────────────────────────────────────

const cal: Calendario = {
  segmentos: [
    { id: 1, orden: 1, nombre: "Mes 1", dias: 30, tipo: "mes" },
    { id: 2, orden: 2, nombre: "Mes a medias", dias: 30, tipo: "mes" },
    { id: 3, orden: 3, nombre: "Noches de Ceniza", dias: 5, tipo: "intercalar" },
  ],
  diasSemana: ["Uno", "Dos"],
  eras: [
    { id: 1, orden: 1, nombre: "Era Primordial", abreviatura: "E.P.", anioInicio: null },
    { id: 2, orden: 2, nombre: "Era Actual", abreviatura: "E.A.", anioInicio: 100 },
  ],
};

const ext = (anio: number, segmentoId: number | null = null, dia: number | null = null) => ({ anio, segmentoId, dia });
const CASOS: Fecha[] = [
  { ini: ext(1203), fin: null, aproximada: false },
  { ini: ext(-34), fin: null, aproximada: true },
  { ini: ext(5, 1), fin: null, aproximada: false },
  { ini: ext(5, 1, 20), fin: null, aproximada: false },
  { ini: ext(5, 3, 2), fin: null, aproximada: false },
  { ini: ext(10), fin: ext(15), aproximada: false },
  { ini: ext(5, 2, 3), fin: ext(5, 2, 9), aproximada: false },
  { ini: ext(5, 1), fin: ext(5, 2), aproximada: false },
  { ini: ext(5, 1, 3), fin: ext(5, 2, 4), aproximada: true },
  { ini: ext(-100, 1, 12), fin: ext(-98, 2), aproximada: false },
];
for (const f of CASOS) {
  const texto = formatoFecha(cal, f, "absoluto");
  igual(`fecha «${texto}»`, leerFecha(cal, texto), f);
}
igual("fecha en eras", leerFecha(cal, "Año 5 E.A.")?.ini.anio, 104);
igual("salida de lore ficha", leerFecha(cal, "Año 5 E.A. (absoluto: Año 104) ★ importante")?.ini.anio, 104);
igual("fecha ininteligible", leerFecha(cal, "hace mucho"), null);
igual("mes que no existe", leerFecha(cal, "Mes 9, año 3"), null);

// ── Comparación ────────────────────────────────────────────────────────────

const tramos = (a: string, b: string) => diferencias(a, b)?.map((t) => [t.tipo, t.texto]);
igual("iguales", tramos("uno dos", "uno dos"), [["igual", "uno dos"]]);
igual("cambio", tramos("uno dos tres", "uno cuatro tres"), [["igual", "uno "], ["anadido", "cuatro"], ["quitado", "dos"], ["igual", " tres"]]);
igual("reconstruye lo nuevo", diferencias("a b c d", "a x c e f")?.filter((t) => t.tipo !== "quitado").map((t) => t.texto).join(""), "a x c e f");
igual("reconstruye lo viejo", diferencias("a b c d", "a x c e f")?.filter((t) => t.tipo !== "anadido").map((t) => t.texto).join(""), "a b c d");

// ── Archivo ────────────────────────────────────────────────────────────────

const ARCHIVO = "<!-- origen -->\n\n## Uno\n- a: 1\n\n<!-- otra -->\n\n## Dos\n- b: 2\n";
igual("quitar un bloque", reemplazarBloque(ARCHIVO, "## Uno\n- a: 1", null), "<!-- otra -->\n\n## Dos\n- b: 2\n");
igual("cambiar un bloque", reemplazarBloque(ARCHIVO, "## Dos\n- b: 2", "## Dos\n- c: 3"), "<!-- origen -->\n\n## Uno\n- a: 1\n\n<!-- otra -->\n\n## Dos\n- c: 3\n");
igual("bloque que ya no está", reemplazarBloque(ARCHIVO, "## Tres", null), null);
igual("respeta CRLF", reemplazarBloque("## Uno\r\n- a: 1\r\n\r\n## Dos\r\n- b: 2\r\n", "## Uno\n- a: 1", null), "## Dos\r\n- b: 2\r\n");
const sinNada = reemplazarBloque("<!-- origen -->\n\n## Uno\n- a: 1\n", "## Uno\n- a: 1", null)!;
igual("archivo que se queda vacío", [sinNada, estaVacio(sinNada)], ["", true]);
igual("no está vacío", estaVacio(ARCHIVO), false);
igual(
  "bloque con lo pendiente",
  bloquePendiente("## Personaje #1: X · cambios", [
    { raw: "- Apellido: Y", seccion: null },
    { raw: "### Historia\nTexto.", seccion: null },
    { raw: "- Relaciones: Z", seccion: "### Conexiones" },
    { raw: "- Razas: W", seccion: "### Conexiones" },
  ]),
  "## Personaje #1: X · cambios\n- Apellido: Y\n\n### Historia\nTexto.\n\n### Conexiones\n- Relaciones: Z\n- Razas: W",
);
// Lo que se reescribe se vuelve a poder leer.
const vuelta = leerPropuesta(bloquePendiente("## Personaje #1: X · cambios", [{ raw: "- Relaciones: Z (Relación: Rival) 🔒", seccion: "### Conexiones" }])).fichas[0];
igual("lo pendiente sigue siendo una propuesta", [vuelta.id, vuelta.datos[0].clase, vuelta.datos[0].oculto], [1, "conexion", true]);

if (fallos) {
  console.log(`\n${fallos} comprobaciones fallidas.`);
  process.exit(1);
}
console.log("Todo bien.");
