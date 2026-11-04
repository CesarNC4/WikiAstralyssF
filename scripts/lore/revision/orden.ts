/**
 * Las órdenes de la revisión en `pnpm --silent lore` (docs/area-ia.md, Fase 6). La base
 * solo se lee. Lo único que se escribe es el informe, en `lore/revisiones/` (fuera de git).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { moldeDe } from "@/lib/propuestas/moldes";
import { leerFoto } from "./foto";
import { aplicarExcepciones, CABECERA_EXCEPCIONES, delTema, informeCompleto, leerExcepciones, resumenParaChat } from "./informe";
import { fichasDelTema, revisar } from "./reglas";

const CARPETA = join("lore", "revisiones");
const EXCEPCIONES = join(CARPETA, "excepciones.md");

/** Un archivo nuevo por revisión: cada informe se puede haber completado a mano o con la lectura de textos. */
function rutaLibre(fecha: string, tema: string | null): string {
  const base = `${fecha}${tema ? `-${tema.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : ""}`;
  let ruta = join(CARPETA, `${base}.md`);
  for (let n = 2; existsSync(ruta); n++) ruta = join(CARPETA, `${base}-${n}.md`);
  return ruta;
}

export async function ordenRevisar(args: string[]) {
  const tema = args.join(" ").trim() || null;
  mkdirSync(CARPETA, { recursive: true });
  if (!existsSync(EXCEPCIONES)) writeFileSync(EXCEPCIONES, CABECERA_EXCEPCIONES);

  const foto = await leerFoto();
  const { hallazgos, resumen } = revisar(foto);
  const excepciones = leerExcepciones(readFileSync(EXCEPCIONES, "utf8"));
  const fichas = tema ? fichasDelTema(foto, tema) : [];
  const claves = new Set(fichas.map((f) => `${f.entidad}#${f.id}`));

  // Las excepciones se comparan con todo: que un tema no las incluya no las hace viejas.
  const todas = aplicarExcepciones(hallazgos, excepciones);
  const fecha = new Date().toLocaleDateString("sv-SE");
  const datos = {
    fecha,
    tema,
    visibles: tema ? delTema(todas.visibles, claves) : todas.visibles,
    omitidos: tema ? delTema(hallazgos.filter((h) => excepciones.has(h.clave)), claves).length : todas.omitidos,
    vencidas: todas.vencidas,
    resumen,
    fichasTema: fichas.map((f) => ({ entidad: f.entidad, id: f.id, nombre: f.nombre })),
  };
  const ruta = rutaLibre(fecha, tema);
  writeFileSync(ruta, informeCompleto(datos));
  console.log(resumenParaChat(datos, ruta.replaceAll("\\", "/")));
}

/**
 * Los textos de la wiki, para leerlos en busca de contradicciones. Sin tipo, cuánto hay de
 * cada uno, para repartir la lectura; con tipo, los textos de ese tipo.
 */
export async function ordenTextos(entidad: string | undefined) {
  const foto = await leerFoto();
  const conTexto = foto.fichas.filter((f) => !f.enPapelera && f.textos.some((t) => t.largo && t.texto.trim()));
  if (!entidad) {
    const porTipo = new Map<string, { fichas: number; caracteres: number }>();
    for (const f of conTexto) {
      const r = porTipo.get(f.entidad) ?? { fichas: 0, caracteres: 0 };
      porTipo.set(f.entidad, r);
      r.fichas++;
      r.caracteres += f.textos.reduce((n, t) => n + (t.largo ? t.texto.length : 0), 0);
    }
    console.log("Texto de la wiki, por tipo de ficha:\n");
    for (const [k, r] of [...porTipo].sort((a, b) => b[1].caracteres - a[1].caracteres)) {
      console.log(`  ${k.padEnd(16)} ${String(r.fichas).padStart(4)} fichas  ${String(r.caracteres).padStart(8)} caracteres`);
    }
    return;
  }
  for (const f of conTexto.filter((x) => x.entidad === entidad)) {
    console.log(`\n## ${moldeDe(entidad)?.singular ?? entidad} #${f.id}: ${f.nombre}${f.estado ? ` · ${f.estado}` : ""}`);
    for (const t of f.textos) if (t.largo && t.texto.trim()) console.log(`\n### ${t.rotulo}${t.oculto ? " 🔒" : ""}\n${t.texto.trim()}`);
  }
}
