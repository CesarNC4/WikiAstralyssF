/**
 * El informe de una revisión y la lista de excepciones (docs/area-ia.md, Fase 6). Puro:
 * recibe y devuelve texto. Quien lee y escribe los archivos es `orden.ts`.
 */
import { moldeDe } from "@/lib/propuestas/moldes";
import { CATEGORIAS, type Categoria, type Gravedad, type Hallazgo, type ResumenHuecos } from "./tipos";

export const CABECERA_EXCEPCIONES = `# Excepciones de la revisión del lore

Lo que parece un fallo pero es a propósito. Una línea por excepción, con la clave que
da el informe entre comillas invertidas y el motivo detrás. \`pnpm --silent lore revisar\`
no vuelve a contarlas, y avisa si alguna ya no corresponde a nada.

`;

/** Las claves de un archivo de excepciones, con su motivo. */
export function leerExcepciones(texto: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*-\s*`([^`]+)`\s*(?:[—–:-]\s*)?(.*)$/);
    if (m) out.set(m[1], m[2].trim());
  }
  return out;
}

export function aplicarExcepciones(hallazgos: Hallazgo[], excepciones: Map<string, string>) {
  const vistas = new Set<string>();
  const visibles: Hallazgo[] = [];
  for (const h of hallazgos) {
    if (excepciones.has(h.clave)) vistas.add(h.clave);
    else visibles.push(h);
  }
  return { visibles, omitidos: vistas.size, vencidas: [...excepciones.keys()].filter((k) => !vistas.has(k)) };
}

/** Lo que no queda dentro del tema se quita, salvo lo que no es de ninguna ficha. */
export function delTema(hallazgos: Hallazgo[], claves: Set<string>): Hallazgo[] {
  return hallazgos.filter((h) => h.fichas.some((f) => claves.has(`${f.entidad}#${f.id}`)));
}

const ORDEN_GRAVEDAD: Record<Gravedad, number> = { alta: 0, media: 1, baja: 2 };

function porCategoria(hallazgos: Hallazgo[]): [Categoria, Hallazgo[]][] {
  return (Object.keys(CATEGORIAS) as Categoria[]).map((c) => [
    c,
    hallazgos.filter((h) => h.categoria === c).sort((a, b) => ORDEN_GRAVEDAD[a.gravedad] - ORDEN_GRAVEDAD[b.gravedad]),
  ]);
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function lineaHuecos(r: ResumenHuecos): string {
  const partes: string[] = [];
  if (r.vacias) partes.push(`${r.vacias} ${r.vacias === 1 ? "vacía" : "vacías"}${r.vaciasPublicas ? ` (${r.vaciasPublicas} ${r.vaciasPublicas === 1 ? "publicada" : "publicadas"})` : ""}`);
  if (r.aMedias) partes.push(`${r.aMedias} a medias${r.aMediasPublicas ? ` (${r.aMediasPublicas} ${r.aMediasPublicas === 1 ? "publicada" : "publicadas"})` : ""}`);
  return partes.join(", ");
}

const nombreTipo = (entidad: string) => moldeDe(entidad)?.singular ?? entidad;

export interface DatosInforme {
  fecha: string;
  tema: string | null;
  visibles: Hallazgo[];
  omitidos: number;
  vencidas: string[];
  resumen: ResumenHuecos[];
  fichasTema: { entidad: string; id: number; nombre: string }[];
}

/** El archivo con todo el detalle. */
export function informeCompleto(d: DatosInforme): string {
  const l: string[] = [];
  l.push(`# Revisión del lore${d.tema ? ` · ${d.tema}` : ""} · ${d.fecha}`, "");
  l.push(`Comprobaciones automáticas: ${plural(d.visibles.length, "aviso", "avisos")}${d.omitidos ? `, sin contar ${plural(d.omitidos, "excepción", "excepciones")}` : ""}.`);
  l.push("Puede citar datos ocultos: este archivo no sale del equipo del autor.", "");
  l.push("Si algo es a propósito, su clave va a `lore/revisiones/excepciones.md`.", "");

  for (const [cat, lista] of porCategoria(d.visibles)) {
    l.push(`## ${CATEGORIAS[cat]} (${lista.length})`, "");
    if (cat === "huecos" && !d.tema) {
      const conAlgo = d.resumen.filter((r) => r.vacias || r.aMedias);
      if (conAlgo.length) {
        l.push("| Tipo | Fichas | Publicadas | Estado |", "|---|---|---|---|");
        for (const r of conAlgo) l.push(`| ${nombreTipo(r.entidad)} | ${r.total} | ${r.publicas} | ${lineaHuecos(r)} |`);
        l.push("", "Los borradores y lo oculto solo se cuentan; abajo van, una a una, las publicadas.", "");
      }
    }
    if (!lista.length) {
      l.push("Nada.", "");
      continue;
    }
    for (const h of lista) l.push(`- **${h.gravedad}** · ${h.texto} \`${h.clave}\``);
    l.push("");
  }

  if (d.tema) {
    l.push(`## Fichas del tema (${d.fichasTema.length})`, "");
    for (const f of d.fichasTema) l.push(`- ${nombreTipo(f.entidad)} #${f.id} ${f.nombre}`);
    l.push("");
  }
  if (d.vencidas.length) {
    l.push(`## Excepciones que ya no corresponden a nada (${d.vencidas.length})`, "");
    for (const k of d.vencidas) l.push(`- \`${k}\``);
    l.push("");
  }
  return `${l.join("\n").trimEnd()}\n`;
}

const MAX_GRAVES_EN_CHAT = 15;

/** Lo que se enseña en el chat. El detalle está en el archivo. */
export function resumenParaChat(d: DatosInforme, ruta: string): string {
  const l: string[] = [];
  const graves = d.visibles.filter((h) => h.gravedad === "alta");
  l.push(`Revisión ${d.tema ? `de «${d.tema}»` : "de toda la wiki"}: ${plural(d.visibles.length, "aviso", "avisos")}, ${graves.length} ${graves.length === 1 ? "grave" : "graves"}.${d.omitidos ? ` ${plural(d.omitidos, "excepción omitida", "excepciones omitidas")}.` : ""}`, "");
  for (const [cat, lista] of porCategoria(d.visibles)) {
    const nAlta = lista.filter((h) => h.gravedad === "alta").length;
    l.push(`  ${CATEGORIAS[cat].padEnd(36)} ${String(lista.length).padStart(4)}${nAlta ? `  (${nAlta} ${nAlta === 1 ? "grave" : "graves"})` : ""}`);
  }
  if (!d.tema) {
    const conAlgo = d.resumen.filter((r) => r.vacias || r.aMedias);
    if (conAlgo.length) {
      l.push("", "Fichas vacías o a medias:");
      for (const r of conAlgo) l.push(`  ${nombreTipo(r.entidad).padEnd(24)} ${String(r.total).padStart(4)} ${r.total === 1 ? "ficha: " : "fichas:"} ${lineaHuecos(r)}`);
    }
  }
  if (graves.length) {
    l.push("", "Lo grave:");
    for (const h of graves.slice(0, MAX_GRAVES_EN_CHAT)) l.push(`  - ${h.texto}`);
    if (graves.length > MAX_GRAVES_EN_CHAT) l.push(`  … y ${graves.length - MAX_GRAVES_EN_CHAT} más en el archivo.`);
  }
  if (d.vencidas.length) l.push("", `${plural(d.vencidas.length, "excepción ya no corresponde", "excepciones ya no corresponden")} a nada: míralo en el archivo.`);
  if (d.tema) {
    l.push("", `Fichas del tema (${d.fichasTema.length}), para leerlas con \`pnpm --silent lore ficha <tipo> <id>\`:`);
    for (const f of d.fichasTema.slice(0, 60)) l.push(`  ${f.entidad} #${f.id} ${f.nombre}`);
    if (d.fichasTema.length > 60) l.push(`  … y ${d.fichasTema.length - 60} más en el archivo.`);
  }
  l.push("", `Informe: ${ruta}`);
  return l.join("\n");
}
