/**
 * Las comprobaciones de la revisión del lore (docs/area-ia.md, Fase 6). Puras: reciben
 * una foto y devuelven hallazgos. Una regla nueva es una función más aquí, con su caso
 * en `probar-revision.ts`.
 *
 * Criterio (decisiones del autor, 2026-11-04):
 *  - Fechas: solo lo imposible. En un mundo con razas milenarias, una edad enorme no es
 *    un fallo. Entre fechas imprecisas solo se avisa si no cuadran de ninguna manera.
 *  - El parentesco se comprueba en el árbol genealógico, donde padre y madre son
 *    explícitos: una relación "Padre" entre personajes no dice en qué sentido se lee.
 *  - Lo que parece un fallo puede ser a propósito: para eso están las excepciones, y
 *    por eso la clave de cada hallazgo es estable.
 */
import { etiquetaInversa } from "@/lib/catalogos";
import { claves, diasPorAnio, validarFecha } from "@/lib/fechas/calendario";
import { rolesDe } from "@/lib/fechas/roles";
import { moldeDe } from "@/lib/propuestas/moldes";
import { hashTexto, normalizar } from "@/lib/propuestas/tipos";
import { bloquesDe, RELACIONES, terminoInverso } from "@/lib/relaciones/registro";
import { ABRE_TROZO, censurarTexto, CIERRA_TROZO } from "@/lib/visibilidad";
import type { AristaFoto, Categoria, FechaFoto, FichaFoto, Foto, Gravedad, Hallazgo, RefFicha, ResumenHuecos } from "./tipos";

// ── Utilidades ───────────────────────────────────────────────────────────────

const claveFicha = (entidad: string, id: number) => `${entidad}#${id}`;

/** "Personaje #1 Ana Prado". */
export function etiqueta(f: RefFicha): string {
  return `${moldeDe(f.entidad)?.singular ?? f.entidad} #${f.id} ${f.nombre}`;
}

function sinMarcaAlias(nombre: string): string {
  return nombre.replace(/^\?+\s*/, "").trim();
}

/** Minúsculas y sin acentos, carácter a carácter: las posiciones siguen valiendo en el original. */
function plano(texto: string): string {
  let out = "";
  for (const c of texto) {
    const base = c.normalize("NFD")[0].toLowerCase();
    out += base.length === c.length ? base : c;
  }
  return out;
}

const esLetraONumero = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

/**
 * Si un texto nombra algo: palabra entera, sin distinguir acentos, y con la primera letra
 * en mayúscula en el texto. Así "Luna" no salta con "la luna", y "ORDEN ABISAL" sí
 * salta con "Orden Abisal".
 */
export function nombra(texto: string, nombre: string): boolean {
  const aguja = plano(nombre);
  if (aguja.length < 4) return false;
  const pajar = plano(texto);
  for (let i = pajar.indexOf(aguja); i !== -1; i = pajar.indexOf(aguja, i + 1)) {
    if (esLetraONumero(pajar[i - 1]) || esLetraONumero(pajar[i + aguja.length])) continue;
    if (texto[i] !== texto[i].toLowerCase()) return true;
  }
  return false;
}

/** Si un texto contiene un secreto tal cual: como `nombra`, pero da igual la mayúscula. */
function contieneLiteral(texto: string, secreto: string): boolean {
  const aguja = plano(secreto);
  const pajar = plano(texto);
  for (let i = pajar.indexOf(aguja); i !== -1; i = pajar.indexOf(aguja, i + 1)) {
    if (!esLetraONumero(pajar[i - 1]) && !esLetraONumero(pajar[i + aguja.length])) return true;
  }
  return false;
}

class Indice {
  readonly fichas = new Map<string, FichaFoto>();
  readonly fechas = new Map<string, FechaFoto>();
  readonly aristasDe = new Map<string, AristaFoto[]>();
  readonly D: number;
  readonly foto: Foto;

  constructor(foto: Foto) {
    this.foto = foto;
    for (const f of foto.fichas) this.fichas.set(claveFicha(f.entidad, f.id), f);
    for (const f of foto.fechas) this.fechas.set(`${claveFicha(f.entidad, f.id)}:${f.rol}`, f);
    for (const a of foto.aristas) (this.aristasDe.get(a.relId) ?? this.aristasDe.set(a.relId, []).get(a.relId)!).push(a);
    this.D = diasPorAnio(foto.calendario);
  }

  ficha(entidad: string, id: number | null | undefined): FichaFoto | undefined {
    return id == null ? undefined : this.fichas.get(claveFicha(entidad, id));
  }
  fecha(entidad: string, id: number, rol: string): FechaFoto | undefined {
    return this.fechas.get(`${claveFicha(entidad, id)}:${rol}`);
  }
  de(entidad: string): FichaFoto[] {
    return this.foto.fichas.filter((f) => f.entidad === entidad && !f.enPapelera);
  }
  aristas(relId: string): AristaFoto[] {
    return this.aristasDe.get(relId) ?? [];
  }
}

class Coleccion {
  readonly lista: Hallazgo[] = [];
  private vistas = new Set<string>();
  private categoria: Categoria;
  constructor(categoria: Categoria) {
    this.categoria = categoria;
  }
  add(clave: string, gravedad: Gravedad, texto: string, fichas: (FichaFoto | RefFicha)[]) {
    const completa = `${this.categoria}/${clave}`;
    if (this.vistas.has(completa)) return;
    this.vistas.add(completa);
    this.lista.push({
      clave: completa,
      categoria: this.categoria,
      gravedad,
      texto,
      fichas: fichas.map((f) => ({ entidad: f.entidad, id: f.id, nombre: f.nombre })),
    });
  }
}

/** Una cita corta del texto, para el informe. */
const cita = (t: string) => {
  const linea = t.replace(/\s+/g, " ").trim();
  return linea.length > 60 ? `${linea.slice(0, 57)}…` : linea;
};

// ── Secretos en riesgo ───────────────────────────────────────────────────────

/** Los textos que ve un lector, ya sin los trozos ocultos. */
function textosPublicos(ix: Indice) {
  const out: { ficha: FichaFoto; rotulo: string; campo: string; texto: string }[] = [];
  for (const f of ix.foto.fichas) {
    if (!f.publica) continue;
    for (const t of f.textos) {
      if (t.oculto || t.privado) continue;
      const texto = censurarTexto(t.texto);
      if (texto.trim()) out.push({ ficha: f, rotulo: t.rotulo, campo: t.campo, texto });
    }
  }
  return out;
}

/** Los valores secretos que se pueden buscar: datos cortos ocultos y trozos `[[oculto]]` cortos. */
function secretosBuscables(ix: Indice) {
  const out: { ficha: FichaFoto; rotulo: string; campo: string; valor: string }[] = [];
  const REGEX_TROZO = /\[\[oculto\]\]([\s\S]*?)\[\[\/oculto\]\]/gi;
  const vale = (v: string) => v.length >= 4 && v.length <= 80;
  for (const f of ix.foto.fichas) {
    if (f.enPapelera) continue;
    for (const t of f.textos) {
      if (t.privado) continue;
      const valor = t.texto.trim();
      if (t.oculto && !t.largo && vale(valor)) out.push({ ficha: f, rotulo: t.rotulo, campo: t.campo, valor });
      for (const m of t.texto.matchAll(REGEX_TROZO)) {
        const trozo = m[1].trim();
        if (vale(trozo)) out.push({ ficha: f, rotulo: `${t.rotulo} (trozo oculto)`, campo: t.campo, valor: trozo });
      }
    }
  }
  return out;
}

export function secretos(ix: Indice): Hallazgo[] {
  const h = new Coleccion("secretos");
  const publicos = textosPublicos(ix);

  // Un dato oculto escrito tal cual en un texto público.
  for (const s of secretosBuscables(ix)) {
    for (const p of publicos) {
      if (!contieneLiteral(p.texto, s.valor)) continue;
      h.add(
        `dato-en-texto:${claveFicha(s.ficha.entidad, s.ficha.id)}:${s.campo}:${hashTexto(s.valor)}:${claveFicha(p.ficha.entidad, p.ficha.id)}:${p.campo}`,
        "alta",
        `«${cita(s.valor)}» está oculto en ${etiqueta(s.ficha)} (${s.rotulo}), pero sale en un texto público: ${etiqueta(p.ficha)} · ${p.rotulo}.`,
        [s.ficha, p.ficha],
      );
    }
  }

  // Una conexión oculta que un texto público cuenta igualmente.
  for (const a of ix.foto.aristas) {
    if (!a.oculto || !a.b) continue;
    const fa = ix.ficha(a.a.entidad, a.a.id);
    const fb = ix.ficha(a.b.entidad, a.b.id);
    if (!fa || !fb) continue;
    for (const [uno, otro] of [[fa, fb], [fb, fa]] as const) {
      for (const p of publicos) {
        if (p.ficha !== uno || !nombra(p.texto, sinMarcaAlias(otro.nombre))) continue;
        h.add(
          `conexion-en-texto:${a.relId}:${a.filaId}:${claveFicha(uno.entidad, uno.id)}:${p.campo}`,
          "media",
          `La conexión entre ${etiqueta(fa)} y ${etiqueta(fb)} está oculta, pero ${uno.nombre} nombra a ${otro.nombre} en un texto público (${p.rotulo}).`,
          [fa, fb],
        );
      }
    }
  }

  // Una ficha oculta que se nombra en público.
  const ocultas = ix.foto.fichas.filter((f) => f.estado === "oculto" && !f.enPapelera);
  for (const o of ocultas) {
    const nombre = sinMarcaAlias(o.nombre);
    for (const p of publicos) {
      if (p.ficha === o || !nombra(p.texto, nombre)) continue;
      h.add(
        `ficha-oculta-en-texto:${claveFicha(o.entidad, o.id)}:${claveFicha(p.ficha.entidad, p.ficha.id)}:${p.campo}`,
        "media",
        `${etiqueta(o)} es una ficha oculta, pero se la nombra en un texto público: ${etiqueta(p.ficha)} · ${p.rotulo}.`,
        [o, p.ficha],
      );
    }
  }

  // Un dato público que delata a uno oculto.
  for (const p of ix.de("personajes")) {
    const muerte = ix.fecha("personajes", p.id, "muerte");
    const nace = ix.fecha("personajes", p.id, "nacimiento");
    const vital = String(p.valores.estadoVital ?? "");
    if (p.publica && muerte?.oculto && vital === "Fallecido" && !p.ocultos.has("estadoVital")) {
      h.add(`muerte-delatada:${p.id}`, "alta", `${etiqueta(p)}: la fecha de muerte está oculta, pero su estado vital público dice «Fallecido».`, [p]);
    }
    if (p.publica && muerte && !muerte.oculto && p.ocultos.has("estadoVital")) {
      h.add(`estado-delatado:${p.id}`, "alta", `${etiqueta(p)}: el estado vital está oculto, pero su fecha de muerte es pública.`, [p]);
    }
    if (p.publica && nace?.oculto && String(p.valores.edad ?? "").trim() && !p.ocultos.has("edad")) {
      h.add(`edad-delata:${p.id}`, "media", `${etiqueta(p)}: el nacimiento está oculto, pero la edad escrita a mano es pública.`, [p]);
    }
  }

  // Fragmentos: el acto enseña lo que su fragmento oculta. A mano en el taller no se oculta solo.
  for (const fr of ix.foto.fragmentos) {
    const acto = ix.ficha("actos", fr.actoId);
    const fichaFr = ix.ficha("fragmentos", fr.id);
    if (!acto || !fichaFr || acto.enPapelera) continue;
    const gravedad: Gravedad = acto.publica ? "alta" : "media";
    const cuando = acto.publica ? "" : " Aún no se ve porque el acto no es público.";
    if (fichaFr.ocultos.has("personajeId") && fr.personajeId != null) {
      const visibleEnActo = ix.aristas("acto_pov").find((a) => a.a.id === fr.actoId && a.b?.id === fr.personajeId && !a.oculto);
      if (visibleEnActo) {
        const pj = ix.ficha("personajes", fr.personajeId);
        h.add(`pov-delatado:${fr.id}`, gravedad, `En ${etiqueta(acto)}, un fragmento oculta su POV, pero el bloque POV del acto enseña a ${pj?.nombre ?? `#${fr.personajeId}`}.${cuando}`, [acto, ...(pj ? [pj] : [])]);
      }
    }
    const fechaFr = ix.fecha("fragmentos", fr.id, "principal");
    const fechaActo = ix.fecha("actos", fr.actoId, "principal");
    if (fechaFr?.oculto && fechaActo && !fechaActo.oculto) {
      h.add(`fecha-delatada:${fr.id}`, gravedad, `En ${etiqueta(acto)}, un fragmento oculta su fecha, pero la fecha del acto (${fechaActo.texto}) sale de ella y es pública.${cuando}`, [acto]);
    }
  }

  // Marcas de trozo oculto mal cerradas.
  for (const f of ix.foto.fichas) {
    if (f.enPapelera) continue;
    for (const t of f.textos) {
      if (!t.texto.includes("[[")) continue;
      const abre = t.texto.split(ABRE_TROZO).length - 1;
      const cierra = t.texto.split(CIERRA_TROZO).length - 1;
      if (abre > cierra) {
        h.add(`trozo-sin-cerrar:${claveFicha(f.entidad, f.id)}:${t.campo}`, "media", `${etiqueta(f)} · ${t.rotulo}: un trozo [[oculto]] no se cierra, así que se oculta todo lo que sigue hasta el final.`, [f]);
      }
      if (censurarTexto(t.texto).includes(CIERRA_TROZO)) {
        h.add(`cierre-suelto:${claveFicha(f.entidad, f.id)}:${t.campo}`, "alta", `${etiqueta(f)} · ${t.rotulo}: hay un [[/oculto]] sin apertura, y el lector lo ve tal cual.`, [f]);
      }
    }
  }
  return h.lista;
}

// ── Fechas imposibles ────────────────────────────────────────────────────────

/** Estados en los que seguir actuando tras la muerte no es imposible. */
const VUELVEN_DE_LA_MUERTE = new Set(["No-muerto", "Renacido"]);

const anteriorDelTodo = (a: FechaFoto, b: FechaFoto) => a.claveFin < b.claveIni;

export function fechas(ix: Indice): Hallazgo[] {
  const h = new Coleccion("fechas");
  const { foto } = ix;

  // La fecha que cierra una ficha es anterior a la que la abre.
  for (const f of foto.fichas) {
    const roles = rolesDe(f.entidad);
    if (roles.length !== 2) continue;
    const ini = ix.fecha(f.entidad, f.id, roles[0].rol);
    const fin = ix.fecha(f.entidad, f.id, roles[1].rol);
    if (ini && fin && anteriorDelTodo(fin, ini)) {
      h.add(`fin-antes-de-inicio:${claveFicha(f.entidad, f.id)}`, "alta", `${etiqueta(f)}: ${roles[1].etiqueta} (${fin.texto}) es anterior a ${roles[0].etiqueta} (${ini.texto}).`, [f]);
    }
  }

  // La fecha de un personaje frente a lo que le rodea.
  const fueraDeVida = (personajeId: number, otro: FichaFoto, fechaOtro: FechaFoto, que: string, clave: string) => {
    const p = ix.ficha("personajes", personajeId);
    if (!p) return;
    const nace = ix.fecha("personajes", p.id, "nacimiento");
    const muere = ix.fecha("personajes", p.id, "muerte");
    if (nace && anteriorDelTodo(fechaOtro, nace)) {
      h.add(`${clave}-antes-de-nacer:${p.id}:${claveFicha(otro.entidad, otro.id)}`, "alta", `${etiqueta(p)} ${que} ${etiqueta(otro)} (${fechaOtro.texto}), pero nace en ${nace.texto}.`, [p, otro]);
    }
    if (muere && anteriorDelTodo(muere, fechaOtro) && !VUELVEN_DE_LA_MUERTE.has(String(p.valores.estadoVital ?? ""))) {
      h.add(`${clave}-tras-morir:${p.id}:${claveFicha(otro.entidad, otro.id)}`, "alta", `${etiqueta(p)} ${que} ${etiqueta(otro)} (${fechaOtro.texto}), pero muere en ${muere.texto}.`, [p, otro]);
    }
  };

  const conEvento = (personajeId: number | undefined, eventoId: number | undefined) => {
    if (personajeId == null || eventoId == null) return;
    const ev = ix.ficha("timeline", eventoId);
    const fe = ev && ix.fecha("timeline", ev.id, "principal");
    if (ev && fe) fueraDeVida(personajeId, ev, fe, "participa en", "evento");
  };
  for (const a of ix.aristas("personaje_evento")) conEvento(a.a.id, a.b?.id);
  for (const a of ix.aristas("ref:timeline")) if (a.b?.entidad === "personajes") conEvento(a.b.id, a.a.id);

  const conActo = (personajeId: number | undefined | null, actoId: number) => {
    if (personajeId == null) return;
    const acto = ix.ficha("actos", actoId);
    const fa = acto && ix.fecha("actos", acto.id, "principal");
    if (acto && fa) fueraDeVida(personajeId, acto, fa, "aparece en", "acto");
  };
  for (const relId of ["acto_pov", "acto_personaje"]) for (const a of ix.aristas(relId)) conActo(a.b?.id, a.a.id);
  for (const fr of foto.fragmentos) {
    const fichaFr = ix.ficha("fragmentos", fr.id);
    const ff = ix.fecha("fragmentos", fr.id, "principal");
    if (fichaFr && ff && fr.personajeId != null) fueraDeVida(fr.personajeId, ix.ficha("actos", fr.actoId) ?? fichaFr, ff, "es POV de un fragmento de", "fragmento");
  }

  // Quien pertenece a algo o lo posee tiene que coincidir con ello en algún momento.
  const coincidir = (personajeId: number | undefined, otro: FichaFoto | undefined, rolIni: string, rolFin: string, que: string, clave: string) => {
    const p = ix.ficha("personajes", personajeId);
    if (!p || !otro) return;
    const nace = ix.fecha("personajes", p.id, "nacimiento");
    const muere = ix.fecha("personajes", p.id, "muerte");
    const ini = ix.fecha(otro.entidad, otro.id, rolIni);
    const fin = ix.fecha(otro.entidad, otro.id, rolFin);
    if (muere && ini && anteriorDelTodo(muere, ini)) {
      h.add(`${clave}-muerto-antes:${p.id}:${claveFicha(otro.entidad, otro.id)}`, "alta", `${etiqueta(p)} ${que} ${etiqueta(otro)}, pero muere (${muere.texto}) antes de ${ini.texto}, cuando empieza.`, [p, otro]);
    }
    if (nace && fin && anteriorDelTodo(fin, nace)) {
      h.add(`${clave}-nacido-despues:${p.id}:${claveFicha(otro.entidad, otro.id)}`, "alta", `${etiqueta(p)} ${que} ${etiqueta(otro)}, pero nace (${nace.texto}) después de ${fin.texto}, cuando termina.`, [p, otro]);
    }
  };
  for (const [relId, entidad] of [["org_jerarquia", "organizaciones"], ["familia_jerarquia", "familias"], ["gremio_jerarquia", "gremio"]] as const) {
    for (const a of ix.aristas(relId)) coincidir(a.b?.id, ix.ficha(entidad, a.a.id), "fundacion", "caida", "es miembro de", "miembro");
  }
  for (const a of ix.aristas("personaje_objeto")) coincidir(a.a.id, a.b ? ix.ficha("artefactos", a.b.id) : undefined, "creacion", "destruccion", "tiene", "objeto");
  for (const a of ix.aristas("artefacto_propietario")) coincidir(a.b?.id, ix.ficha("artefactos", a.a.id), "creacion", "destruccion", "es propietario de", "propietario");

  // Nacer en un lugar que ya no existía.
  for (const [relId, entidad, rolFin] of [["nacimiento_nacion", "naciones", "caida"], ["nacimiento_region", "regiones", "destruccion"], ["nacimiento_locacion", "locaciones", "destruccion"]] as const) {
    for (const a of ix.aristas(relId)) {
      const p = ix.ficha("personajes", a.a.id);
      const lugar = a.b ? ix.ficha(entidad, a.b.id) : undefined;
      const nace = p && ix.fecha("personajes", p.id, "nacimiento");
      const fin = lugar && ix.fecha(entidad, lugar.id, rolFin);
      if (p && lugar && nace && fin && anteriorDelTodo(fin, nace)) {
        h.add(`nace-en-lugar-destruido:${p.id}:${claveFicha(entidad, lugar.id)}`, "alta", `${etiqueta(p)} nace en ${etiqueta(lugar)} (${nace.texto}), que ya había desaparecido (${fin.texto}).`, [p, lugar]);
      }
    }
  }

  // Árbol genealógico: padre y madre son explícitos.
  const porId = new Map(foto.arbol.map((n) => [n.id, n]));
  for (const n of foto.arbol) {
    const hijo = ix.ficha("personajes", n.personajeId);
    const naceHijo = hijo && ix.fecha("personajes", hijo.id, "nacimiento");
    if (!hijo || !naceHijo) continue;
    for (const progId of [n.padreId, n.madreId]) {
      const prog = progId != null ? porId.get(progId) : undefined;
      const fp = ix.ficha("personajes", prog?.personajeId);
      if (!fp) continue;
      const naceProg = ix.fecha("personajes", fp.id, "nacimiento");
      const muereProg = ix.fecha("personajes", fp.id, "muerte");
      if (naceProg && anteriorDelTodo(naceHijo, naceProg)) {
        h.add(`progenitor-menor:${fp.id}:${hijo.id}`, "alta", `${etiqueta(fp)} (nace en ${naceProg.texto}) figura en el árbol como progenitor de ${etiqueta(hijo)}, que nace antes (${naceHijo.texto}).`, [fp, hijo]);
      }
      // Con un año de margen: quien muere antes del parto sigue pudiendo ser progenitor.
      if (muereProg && muereProg.claveFin + ix.D < naceHijo.claveIni) {
        h.add(`progenitor-muerto:${fp.id}:${hijo.id}`, "alta", `${etiqueta(fp)} (muere en ${muereProg.texto}) figura en el árbol como progenitor de ${etiqueta(hijo)}, que nace más de un año después (${naceHijo.texto}).`, [fp, hijo]);
      }
    }
  }

  for (const p of ix.de("personajes")) {
    const muere = ix.fecha("personajes", p.id, "muerte");
    if (muere && p.valores.estadoVital === "Vivo") {
      h.add(`vivo-con-muerte:${p.id}`, "alta", `${etiqueta(p)}: el estado vital dice «Vivo», pero tiene fecha de muerte (${muere.texto}).`, [p]);
    }
    if (ix.fecha("personajes", p.id, "nacimiento") && String(p.valores.edad ?? "").trim()) {
      h.add(`edad-y-nacimiento:${p.id}`, "baja", `${etiqueta(p)}: tiene nacimiento y además edad escrita a mano («${cita(String(p.valores.edad))}»). La edad a mano es solo para quien no tiene fecha.`, [p]);
    }
  }
  return h.lista;
}

// ── Conexiones ───────────────────────────────────────────────────────────────

/** El mismo término sin género, para comparar recíprocas. */
const CANON: Record<string, string> = { Madre: "Padre", Hija: "Hijo" };
const canon = (t: string) => CANON[t] ?? t;

/** Si dos términos son el reflejo uno del otro. */
function casan(relId: string, ida: string, vuelta: string): boolean {
  const rel = RELACIONES.find((r) => r.id === relId)!;
  const inversos = [terminoInverso(rel, ida), relId === "relaciones" ? etiquetaInversa(ida) : null];
  return inversos.some((i) => i != null && canon(i) === canon(vuelta));
}

/** Busca un ciclo en un grafo dirigido; devuelve los nodos del ciclo. */
function ciclos(aristas: [number, number][]): number[][] {
  const salen = new Map<number, number[]>();
  for (const [a, b] of aristas) (salen.get(a) ?? salen.set(a, []).get(a)!).push(b);
  const hechos = new Set<number>();
  const out: number[][] = [];
  const pila: number[] = [];
  const visitar = (n: number) => {
    const i = pila.indexOf(n);
    if (i !== -1) {
      out.push(pila.slice(i));
      return;
    }
    if (hechos.has(n)) return;
    pila.push(n);
    for (const m of salen.get(n) ?? []) visitar(m);
    pila.pop();
    hechos.add(n);
  };
  for (const n of salen.keys()) visitar(n);
  return out;
}

export function conexiones(ix: Indice): Hallazgo[] {
  const h = new Coleccion("conexiones");
  const { foto } = ix;

  for (const rel of RELACIONES) {
    const filas = ix.aristas(rel.id);
    if (!filas.length) continue;

    // Reflexivas: consigo misma, y duplicadas.
    const vistas = new Map<string, AristaFoto>();
    for (const a of filas) {
      if (!a.b) continue;
      const fa = ix.ficha(a.a.entidad, a.a.id);
      const fb = ix.ficha(a.b.entidad, a.b.id);
      if (!fa || !fb) continue;
      if (a.a.entidad === a.b.entidad && a.a.id === a.b.id) {
        h.add(`consigo-misma:${rel.id}:${a.filaId}`, "alta", `${etiqueta(fa)} está conectada consigo misma (${rel.a.titulo}).`, [fa]);
      }
      const firma = `${claveFicha(a.a.entidad, a.a.id)}>${claveFicha(a.b.entidad, a.b.id)}:${JSON.stringify(a.campos)}`;
      if (vistas.has(firma)) {
        h.add(`duplicada:${rel.id}:${a.filaId}`, "baja", `${etiqueta(fa)} y ${etiqueta(fb)} tienen dos veces la misma conexión (${rel.a.titulo}).`, [fa, fb]);
      }
      vistas.set(firma, a);
    }

    // Recíprocas. Los personajes no necesitan la fila de vuelta (su ficha lee la inversa),
    // pero si existe tiene que casar.
    if (rel.reciproca) {
      const campo = rel.reciproca.campo;
      for (const ida of filas) {
        if (!ida.b || ida.a.id === ida.b.id) continue;
        const fa = ix.ficha(ida.a.entidad, ida.a.id);
        const fb = ix.ficha(ida.b.entidad, ida.b.id);
        if (!fa || !fb) continue;
        const vueltas = filas.filter((v) => v.b && v.a.id === ida.b!.id && v.b.id === ida.a.id);
        const termino = ida.campos[campo] ?? "";
        if (!vueltas.length) {
          if (rel.id !== "relaciones") {
            h.add(`sin-reflejo:${rel.id}:${ida.filaId}`, "media", `${etiqueta(fa)} tiene «${termino}» con ${etiqueta(fb)}, pero ${fb.nombre} no tiene la conexión de vuelta (${rel.a.titulo}).`, [fa, fb]);
          }
          continue;
        }
        if (!termino) continue;
        const conTermino = vueltas.filter((v) => v.campos[campo]);
        if (conTermino.length && !conTermino.some((v) => casan(rel.id, termino, v.campos[campo]))) {
          const [menor, mayor] = ida.a.id < ida.b.id ? [ida.a.id, ida.b.id] : [ida.b.id, ida.a.id];
          h.add(
            `se-contradicen:${rel.id}:${menor}:${mayor}`,
            "alta",
            `${etiqueta(fa)} y ${etiqueta(fb)} se contradicen (${rel.a.titulo}): una dice «${termino}» y la otra «${conTermino[0].campos[campo]}».`,
            [fa, fb],
          );
        }
      }
    }
  }

  // Derivaciones en círculo.
  for (const relId of ["raza_padre", "magia_padre"]) {
    const entidad = relId === "raza_padre" ? "razas" : "magia";
    const pares = ix.aristas(relId).filter((a) => a.b).map((a) => [a.a.id, a.b!.id] as [number, number]);
    for (const ciclo of ciclos(pares)) {
      if (ciclo.length < 2) continue; // Consigo misma ya se ha contado.
      const fichas = ciclo.map((id) => ix.ficha(entidad, id)).filter((f): f is FichaFoto => !!f);
      h.add(`ciclo:${relId}:${Math.min(...ciclo)}`, "alta", `Derivación en círculo: ${fichas.map((f) => f.nombre).join(" → ")} → ${fichas[0]?.nombre}.`, fichas);
    }
  }
  const pares = foto.arbol.flatMap((n) => [n.padreId, n.madreId].filter((p): p is number => p != null).map((p) => [n.id, p] as [number, number]));
  const porId = new Map(foto.arbol.map((n) => [n.id, n]));
  for (const ciclo of ciclos(pares)) {
    const familia = ix.ficha("familias", porId.get(ciclo[0])?.familiaId);
    h.add(`arbol-ciclo:${Math.min(...ciclo)}`, "alta", `Árbol genealógico en círculo${familia ? ` en ${etiqueta(familia)}` : ""}: ${ciclo.map((id) => porId.get(id)?.nombre ?? id).join(" → ")}.`, familia ? [familia] : []);
  }

  // Lugares que no encajan.
  const nacionDeRegion = (id: unknown) => (id == null ? undefined : ix.ficha("regiones", Number(id))?.valores.nacionId);
  for (const l of ix.de("locaciones")) {
    const delaRegion = nacionDeRegion(l.valores.regionId);
    if (l.valores.nacionId != null && delaRegion != null && Number(l.valores.nacionId) !== Number(delaRegion)) {
      const n1 = ix.ficha("naciones", Number(l.valores.nacionId));
      const n2 = ix.ficha("naciones", Number(delaRegion));
      h.add(`lugar-contradice:${l.id}`, "alta", `${etiqueta(l)} está en ${n1?.nombre ?? "una nación"}, pero su región es de ${n2?.nombre ?? "otra"}.`, [l]);
    }
  }
  for (const p of ix.de("personajes")) {
    const { lugarNacimientoNacionId: nacion, lugarNacimientoRegionId: region, lugarNacimientoLocacionId: locacion } = p.valores;
    const lugar = locacion != null ? ix.ficha("locaciones", Number(locacion)) : undefined;
    const contra = (que: string) => h.add(`nacimiento-contradice:${p.id}:${que}`, "alta", `${etiqueta(p)}: el lugar de nacimiento no encaja (${que}).`, [p]);
    if (lugar && region != null && lugar.valores.regionId != null && Number(lugar.valores.regionId) !== Number(region)) contra("la locación es de otra región");
    if (lugar && nacion != null && lugar.valores.nacionId != null && Number(lugar.valores.nacionId) !== Number(nacion)) contra("la locación es de otra nación");
    const nr = nacionDeRegion(region);
    if (nacion != null && nr != null && Number(nr) !== Number(nacion)) contra("la región es de otra nación");
  }

  // Conexiones que faltan.
  const familias = ix.de("familias");
  const miembros = new Set(ix.aristas("familia_jerarquia").filter((a) => a.b).map((a) => `${a.a.id}:${a.b!.id}`));
  for (const p of ix.de("personajes")) {
    const apellido = normalizar(String(p.valores.surname ?? ""));
    if (apellido.length < 3) continue;
    for (const f of familias) {
      const deLaFamilia = [f.valores.apellido, f.nombre].some((x) => normalizar(String(x ?? "")) === apellido);
      if (deLaFamilia && !miembros.has(`${f.id}:${p.id}`)) {
        h.add(`apellido-sin-familia:${p.id}:${f.id}`, "media", `${etiqueta(p)} se apellida ${String(p.valores.surname)}, pero no consta como miembro de ${etiqueta(f)}.`, [p, f]);
      }
    }
  }
  for (const n of foto.arbol) {
    if (n.personajeId == null || miembros.has(`${n.familiaId}:${n.personajeId}`)) continue;
    const f = ix.ficha("familias", n.familiaId);
    const p = ix.ficha("personajes", n.personajeId);
    if (f && p) h.add(`arbol-sin-miembro:${n.id}`, "baja", `${etiqueta(p)} está en el árbol de ${etiqueta(f)}, pero no entre sus miembros.`, [p, f]);
  }

  // Dos fichas del mismo tipo con el mismo nombre.
  const repetidas = new Map<string, FichaFoto[]>();
  for (const f of foto.fichas) {
    if (f.enPapelera || f.entidad === "fragmentos") continue;
    const k = `${f.entidad}:${normalizar(sinMarcaAlias(f.nombre))}`;
    repetidas.set(k, [...(repetidas.get(k) ?? []), f]);
  }
  for (const [k, lista] of repetidas) {
    if (lista.length < 2) continue;
    h.add(`nombre-repetido:${k}`, "media", `Hay ${lista.length} fichas de tipo ${moldeDe(lista[0].entidad)?.singular ?? lista[0].entidad} llamadas «${lista[0].nombre}»: ${lista.map((f) => `#${f.id}`).join(", ")}.`, lista);
  }

  // Un nombre suelto para quien sí tiene ficha.
  const porNombre = new Map<string, FichaFoto[]>();
  for (const p of ix.de("personajes")) {
    const k = normalizar(sinMarcaAlias(p.nombre));
    porNombre.set(k, [...(porNombre.get(k) ?? []), p]);
  }
  for (const a of foto.aristas) {
    if (a.b || !a.nombreLibre) continue;
    const hay = porNombre.get(normalizar(a.nombreLibre));
    const duena = ix.ficha(a.a.entidad, a.a.id);
    if (hay?.length && duena) {
      h.add(`nombre-suelto:${a.relId}:${a.filaId}`, "media", `${etiqueta(duena)} tiene a «${a.nombreLibre}» como nombre suelto (sin ficha), pero existe ${etiqueta(hay[0])}.`, [duena, hay[0]]);
    }
  }
  return h.lista;
}

// ── Referencias rotas ────────────────────────────────────────────────────────

/** Ruta pública → entidad, para reconocer enlaces escritos dentro de un texto. */
const RUTAS: Record<string, string> = {
  personajes: "personajes", naciones: "naciones", organizaciones: "organizaciones", familias: "familias", razas: "razas",
  bestias: "bestias", minerales: "minerales", artefactos: "artefactos", locaciones: "locaciones", regiones: "regiones",
  misiones: "misiones", timeline: "timeline", demonios: "demonios", conceptos: "conceptos", magia: "magia",
  capitulos: "capitulos", arcos: "arcos", canciones: "canciones",
};

export function referencias(ix: Indice): Hallazgo[] {
  const h = new Coleccion("referencias");
  const { foto } = ix;

  for (const a of foto.aristas) {
    const fa = ix.ficha(a.a.entidad, a.a.id);
    const fb = a.b ? ix.ficha(a.b.entidad, a.b.id) : null;
    const rel = RELACIONES.find((r) => r.id === a.relId);
    const titulo = rel?.a.titulo ?? a.relId;
    const tituloB = rel?.b.titulo ?? a.relId;
    if (!fa) {
      h.add(`conexion-rota:${a.relId}:${a.filaId}`, "alta", `Una conexión (${titulo}) sale de ${a.a.entidad} #${a.a.id}, que ya no existe${fb ? ` y llega a ${etiqueta(fb)}` : ""}.`, fb ? [fb] : []);
      continue;
    }
    if (a.b && !fb) {
      h.add(`conexion-rota:${a.relId}:${a.filaId}`, "alta", `${etiqueta(fa)} tiene una conexión (${titulo}) a ${a.b.entidad} #${a.b.id}, que ya no existe.`, [fa]);
      continue;
    }
    if (!fb) continue;
    if (!fa.enPapelera && fb.enPapelera) {
      h.add(`conexion-a-papelera:${a.relId}:${a.filaId}`, "media", `${etiqueta(fa)} tiene una conexión (${titulo}) a ${etiqueta(fb)}, que está en la papelera.`, [fa, fb]);
    }
    if (fb.enPapelera === false && fa.enPapelera) {
      h.add(`conexion-a-papelera:${a.relId}:${a.filaId}`, "media", `${etiqueta(fb)} tiene una conexión (${titulo}) con ${etiqueta(fa)}, que está en la papelera.`, [fa, fb]);
    }
    // Una ficha pública enlaza a otra que el lector no puede ver, y la conexión desaparece sin más.
    if (!a.oculto && !rel?.a.sinPublico && fa.publica && !fb.publica && !fb.enPapelera && fb.estado !== null) {
      h.add(`enlaza-a-no-publica:${a.relId}:${a.filaId}`, "baja", `${etiqueta(fa)} está conectada (${titulo}) con ${etiqueta(fb)}, que está en ${fb.estado}: el lector no ve esa conexión.`, [fa, fb]);
    }
    if (!a.oculto && !rel?.b.sinPublico && fb.publica && !fa.publica && !fa.enPapelera && fa.estado !== null) {
      h.add(`enlaza-a-no-publica:${a.relId}:${a.filaId}:b`, "baja", `${etiqueta(fb)} está conectada (${tituloB}) con ${etiqueta(fa)}, que está en ${fa.estado}: el lector no ve esa conexión.`, [fa, fb]);
    }
  }

  for (const v of foto.vinculosRaros) {
    h.add(`vinculo-sin-registro:${v.filaId}`, "media", `La fila ${v.filaId} de vínculos es de una relación que el registro no conoce («${v.relacion ?? "vacía"}»).`, []);
  }
  for (const p of foto.polimorficas) {
    if (!ix.ficha(p.entidad, p.id)) {
      h.add(`huerfana:${p.tabla}:${p.filaId}`, "media", `${p.tabla} (fila ${p.filaId}) es de ${p.entidad} #${p.id}, que ya no existe.`, []);
    }
  }
  for (const c of foto.fueraDeCatalogo) {
    h.add(`fuera-de-catalogo:${c.tabla}.${c.columna}:${c.valor}`, "media", `${c.tabla}.${c.columna}: ${c.n === 1 ? "1 ficha guarda" : `${c.n} fichas guardan`} «${c.valor}», que no está en el catálogo «${c.catalogo}». El desplegable lo enseña en blanco.`, []);
  }

  // Fechas que el calendario ya no reconoce.
  for (const f of foto.fechas) {
    const ficha = ix.ficha(f.entidad, f.id);
    const errores = validarFecha(foto.calendario, f.fecha);
    if (errores.length) {
      h.add(`fecha-invalida:${claveFicha(f.entidad, f.id)}:${f.rol}`, "alta", `${ficha ? etiqueta(ficha) : `${f.entidad} #${f.id}`}, fecha «${f.rol}»: ${errores[0]}`, ficha ? [ficha] : []);
      continue;
    }
    const k = claves(foto.calendario, f.fecha);
    if (k.ini !== f.claveIni || k.fin !== f.claveFin) {
      h.add(`fecha-desordenada:${claveFicha(f.entidad, f.id)}:${f.rol}`, "media", `${ficha ? etiqueta(ficha) : `${f.entidad} #${f.id}`}, fecha «${f.rol}»: su posición guardada no coincide con el calendario. Se ordena mal en la cronología; guardarla otra vez lo arregla.`, ficha ? [ficha] : []);
    }
    if (!ficha) h.add(`fecha-huerfana:${f.entidad}#${f.id}:${f.rol}`, "media", `Hay una fecha «${f.rol}» de ${f.entidad} #${f.id}, que ya no existe.`, []);
  }

  // Enlaces escritos dentro de los textos.
  const REGEX_ENLACE = /\]\(\/([a-z]+)\/([\w-]+)[^)]*\)/g;
  for (const f of foto.fichas) {
    if (f.enPapelera) continue;
    for (const t of f.textos) {
      for (const m of t.texto.matchAll(REGEX_ENLACE)) {
        const [, ruta, id] = m;
        const entidad = ruta === "lore" ? "lore" : RUTAS[ruta];
        if (!entidad) continue;
        const destino = entidad === "lore" ? foto.fichas.find((x) => x.entidad === "lore" && x.valores.slug === id) : /^\d+$/.test(id) ? ix.ficha(entidad, Number(id)) : undefined;
        if (!destino || destino.enPapelera) {
          h.add(`enlace-roto:${claveFicha(f.entidad, f.id)}:${t.campo}:/${ruta}/${id}`, "media", `${etiqueta(f)} · ${t.rotulo}: enlaza a /${ruta}/${id}, que no existe.`, [f]);
        } else if (f.publica && !destino.publica && !t.oculto && !t.privado) {
          h.add(`enlace-no-publico:${claveFicha(f.entidad, f.id)}:${t.campo}:/${ruta}/${id}`, "media", `${etiqueta(f)} · ${t.rotulo}: enlaza a ${etiqueta(destino)}, que no es pública.`, [f, destino]);
        }
      }
    }
  }
  return h.lista;
}

// ── Coherencia del taller ────────────────────────────────────────────────────

export function taller(ix: Indice): Hallazgo[] {
  const h = new Coleccion("taller");
  const capitulo = (id: unknown) => (id == null ? undefined : ix.ficha("capitulos", Number(id)));
  const acto = (id: unknown) => (id == null ? undefined : ix.ficha("actos", Number(id)));
  const numero = (x: unknown) => (x == null ? null : Number(x));

  /** Si un acto va antes que otro leyendo la historia en orden; null si no se puede saber. */
  const antes = (a: FichaFoto, b: FichaFoto): boolean | null => {
    const ca = capitulo(a.valores.capituloId);
    const cb = capitulo(b.valores.capituloId);
    if (!ca || !cb || ca.valores.libro !== cb.valores.libro) return null;
    if (ca.id !== cb.id) return Number(ca.valores.orden) < Number(cb.valores.orden);
    return Number(a.valores.numeroOrden) < Number(b.valores.numeroOrden);
  };

  for (const a of ix.de("actos")) {
    const c = capitulo(a.valores.capituloId);
    if (a.valores.capituloId == null) h.add(`acto-sin-capitulo:${a.id}`, "media", `${etiqueta(a)} no está en ningún capítulo.`, [a]);
    if (c?.enPapelera) h.add(`acto-en-capitulo-borrado:${a.id}`, "media", `${etiqueta(a)} está en ${etiqueta(c)}, que está en la papelera.`, [a, c]);
    if (a.estado === "publicado" && c && !c.publica && !c.enPapelera) {
      h.add(`acto-publicado-sin-capitulo:${a.id}`, "media", `${etiqueta(a)} está publicado, pero su capítulo (${c.nombre}) no, así que nadie lo ve.`, [a, c]);
    }
    const plantilla = c?.valores.plantillaId;
    if (plantilla != null) {
      const fase = ix.foto.fases.find((f) => f.id === numero(a.valores.faseId));
      if (a.valores.faseId == null) h.add(`acto-sin-fase:${a.id}`, "baja", `${etiqueta(a)} no tiene fase, y su capítulo usa una plantilla de estructura.`, [a]);
      else if (!fase || fase.plantillaId !== Number(plantilla)) h.add(`acto-fase-ajena:${a.id}`, "media", `${etiqueta(a)} tiene una fase que no es de la plantilla de su capítulo.`, [a]);
    }
  }

  for (const c of ix.de("capitulos")) {
    const actos = ix.de("actos").filter((a) => numero(a.valores.capituloId) === c.id);
    if (c.publica && !actos.some((a) => a.publica)) {
      h.add(`capitulo-publicado-sin-actos:${c.id}`, "media", `${etiqueta(c)} está publicado, pero no tiene ningún acto publicado.`, [c]);
    }
  }

  for (const hoja of ix.de("hojas")) {
    const arco = ix.ficha("arcos", numero(hoja.valores.arcoId));
    if (arco?.enPapelera) h.add(`hoja-en-arco-borrado:${hoja.id}`, "media", `${etiqueta(hoja)} está en ${etiqueta(arco)}, que está en la papelera.`, [hoja, arco]);
    const a = acto(hoja.valores.actoId);
    if (a && hoja.valores.capituloId != null && numero(a.valores.capituloId) !== numero(hoja.valores.capituloId)) {
      const c = capitulo(hoja.valores.capituloId);
      h.add(`hoja-capitulo-contradice:${hoja.id}`, "media", `${etiqueta(hoja)} apunta a ${c?.nombre ?? "un capítulo"}, pero su acto (${a.nombre}) es de otro.`, [hoja, a]);
    }
  }

  for (const ev of ix.de("timeline")) {
    const a = acto(ev.valores.actoId);
    if (a && ev.valores.capituloId != null && numero(a.valores.capituloId) !== numero(ev.valores.capituloId)) {
      h.add(`evento-capitulo-contradice:${ev.id}`, "media", `${etiqueta(ev)} apunta a un capítulo, pero su acto (${a.nombre}) es de otro.`, [ev, a]);
    }
  }

  for (const hilo of ix.de("hilos")) {
    const abre = acto(hilo.valores.actoAperturaId);
    const cierra = acto(hilo.valores.actoCierreId);
    if (abre && cierra && antes(cierra, abre)) {
      h.add(`hilo-al-reves:${hilo.id}`, "alta", `${etiqueta(hilo)} se cierra en ${cierra.nombre}, antes de abrirse en ${abre.nombre}.`, [hilo, abre, cierra]);
    }
    for (const [a, capId, cual] of [[abre, hilo.valores.capituloAperturaId, "apertura"], [cierra, hilo.valores.capituloCierreId, "cierre"]] as const) {
      if (a && capId != null && numero(a.valores.capituloId) !== numero(capId)) {
        h.add(`hilo-capitulo-contradice:${hilo.id}:${cual}`, "media", `${etiqueta(hilo)}: el capítulo de ${cual} no es el de su acto (${a.nombre}).`, [hilo, a]);
      }
    }
    const tieneCierre = hilo.valores.actoCierreId != null || hilo.valores.capituloCierreId != null;
    const tieneApertura = hilo.valores.actoAperturaId != null || hilo.valores.capituloAperturaId != null;
    const estado = String(hilo.valores.estado ?? "");
    if (tieneCierre && estado === "Abierto") h.add(`hilo-estado-contradice:${hilo.id}`, "media", `${etiqueta(hilo)} tiene acto de cierre, pero su estado sigue en «Abierto».`, [hilo]);
    if (!tieneCierre && /^cerrad/i.test(estado)) h.add(`hilo-estado-contradice:${hilo.id}`, "media", `${etiqueta(hilo)} dice estar cerrado, pero no consta dónde se cierra.`, [hilo]);
    if (tieneApertura && !tieneCierre && !/^cerrad/i.test(estado)) h.add(`hilo-sin-cerrar:${hilo.id}`, "baja", `${etiqueta(hilo)} se abre${abre ? ` en ${abre.nombre}` : ""} y sigue sin cerrar.`, [hilo]);
  }

  for (const fr of ix.foto.fragmentos) {
    if (fr.personajeId == null) continue;
    const enBloque = ix.aristas("acto_pov").some((a) => a.a.id === fr.actoId && a.b?.id === fr.personajeId);
    const a = acto(fr.actoId);
    const p = ix.ficha("personajes", fr.personajeId);
    if (!enBloque && a && p) h.add(`pov-sin-bloque:${fr.id}`, "baja", `${p.nombre} es POV de un fragmento de ${etiqueta(a)}, pero no está en el bloque POV del acto.`, [a, p]);
  }
  return h.lista;
}

// ── Menciones sin conexión ───────────────────────────────────────────────────

/** Nombres comunes como ficha ("Fuego"), con demasiadas falsas alarmas o sin conexión posible. */
const NO_SE_BUSCAN = new Set(["elementos", "economia", "fragmentos", "hojas", "hilos"]);
/**
 * Nombrar una página de lore no pide conexión: "Menciona" dice a quién nombra la página,
 * no quién la nombra a ella. Sus textos sí se miran.
 */
const NO_SON_OBJETIVO = new Set([...NO_SE_BUSCAN, "lore"]);

export function menciones(ix: Indice): Hallazgo[] {
  const h = new Coleccion("menciones");
  const { foto } = ix;

  const conectadas = new Set<string>();
  for (const a of foto.aristas) {
    if (!a.b) continue;
    conectadas.add(`${claveFicha(a.a.entidad, a.a.id)}|${claveFicha(a.b.entidad, a.b.id)}`);
    conectadas.add(`${claveFicha(a.b.entidad, a.b.id)}|${claveFicha(a.a.entidad, a.a.id)}`);
  }

  /** Por qué bloque se conecta un tipo de ficha con otro, si se puede. */
  const bloquePara = new Map<string, string | null>();
  const como = (de: string, a: string) => {
    const k = `${de}>${a}`;
    if (!bloquePara.has(k)) bloquePara.set(k, bloquesDe(de).find((b) => (b.objetivo === a || b.objetivo === "*") && !b.editorPropio)?.titulo ?? null);
    return bloquePara.get(k)!;
  };

  const objetivos = foto.fichas
    .filter((f) => !f.enPapelera && !NO_SON_OBJETIVO.has(f.entidad))
    .map((f) => ({ ficha: f, nombre: sinMarcaAlias(f.nombre) }))
    .filter((o) => o.nombre.length >= 4);

  for (const f of foto.fichas) {
    if (f.enPapelera || NO_SE_BUSCAN.has(f.entidad)) continue;
    const textos = f.textos.filter((t) => !t.privado && t.largo);
    if (!textos.length) continue;
    for (const o of objetivos) {
      if (o.ficha === f) continue;
      if (conectadas.has(`${claveFicha(f.entidad, f.id)}|${claveFicha(o.ficha.entidad, o.ficha.id)}`)) continue;
      const bloque = como(f.entidad, o.ficha.entidad);
      const inverso = bloque ? null : como(o.ficha.entidad, f.entidad);
      if (!bloque && !inverso) continue;
      const t = textos.find((x) => nombra(x.texto, o.nombre));
      if (!t) continue;
      const via = bloque ? `«${bloque}» en ${f.nombre}` : `«${inverso}» en ${o.ficha.nombre}`;
      h.add(`${claveFicha(f.entidad, f.id)}:${claveFicha(o.ficha.entidad, o.ficha.id)}`, "baja", `${etiqueta(f)} · ${t.rotulo} nombra a ${etiqueta(o.ficha)}, pero no están conectadas (se haría con ${via}).`, [f, o.ficha]);
    }
  }
  return h.lista;
}

// ── Guía de estilo y restos de prueba ────────────────────────────────────────

const EN_MAYUSCULAS = new Set(["naciones", "organizaciones", "razas", "regiones", "locaciones", "familias", "gremio"]);
const CON_INICIAL = new Set(["personajes", "bestias", "magia", "elementos", "artefactos", "minerales", "timeline"]);

const NOMBRE_DE_PRUEBA = /^(prueba|test|ejemplo|asdf|qwerty)\b/i;
const TEXTO_DE_PRUEBA = /^(hola|prueba|test|asdf|qwerty|lorem|aba|ejemplo|pendiente|todo|tbd|relleno)[\s.!]*$|lorem ipsum|hola,? c[oó]mo est/i;

/** Algo tecleado al azar ("qgewg", "rrrrrrr"): letras repetidas, o casi sin vocales. */
function pareceTecleado(texto: string): boolean {
  if (texto.length > 40) return false;
  const letras = plano(texto).replace(/[^\p{L}]/gu, "");
  if (letras.length < 3) return false;
  const vocales = letras.replace(/[^aeiou]/g, "").length;
  return /(.)\1{3,}/.test(letras) || /[^aeiou]{5,}/.test(letras) || vocales / letras.length < 0.25;
}
const RESTO_HTML = /<\/?(p|div|span|br|strong|em|b|i|u|ul|ol|li|font|h[1-6]|table|tr|td|a)\b[^>]*>|&(nbsp|amp|quot|lt|gt);|\\"|^\s*•/im;
/** Hablarle al lector. Lo que va entre comillas es un diálogo o una cita. */
const SEGUNDA_PERSONA = /(?<![\p{L}])(tú|ustedes|vosotros|usted)(?![\p{L}])/iu;
const ENTRE_COMILLAS = /"[^"]*"|«[^»]*»|“[^”]*”/g;

export function guia(ix: Indice): Hallazgo[] {
  const h = new Coleccion("guia");
  for (const f of ix.foto.fichas) {
    if (f.enPapelera) continue;
    const nombre = sinMarcaAlias(f.nombre);
    if (EN_MAYUSCULAS.has(f.entidad) && nombre !== nombre.toLocaleUpperCase("es")) {
      h.add(`mayusculas:${claveFicha(f.entidad, f.id)}`, "baja", `${etiqueta(f)}: el nombre de ${moldeDe(f.entidad)?.singular.toLowerCase() ?? f.entidad} va en MAYÚSCULAS.`, [f]);
    }
    const primera = [...nombre].find((c) => /\p{L}/u.test(c));
    if (CON_INICIAL.has(f.entidad) && primera && primera === primera.toLowerCase() && primera !== primera.toUpperCase()) {
      h.add(`inicial:${claveFicha(f.entidad, f.id)}`, "baja", `${etiqueta(f)}: el nombre empieza en minúscula.`, [f]);
    }
    if (f.entidad === "personajes" && f.nombre.startsWith("?")) {
      h.add(`alias-pendiente:${f.id}`, "media", `${etiqueta(f)}: «???» en el nombre. Va como alias, con la identidad en «Nombre real» (oculto).`, [f]);
    }
    if (NOMBRE_DE_PRUEBA.test(nombre)) {
      h.add(`nombre-de-prueba:${claveFicha(f.entidad, f.id)}`, "media", `${etiqueta(f)}: parece un resto de prueba por su nombre.`, [f]);
    }
    for (const t of f.textos) {
      if (!t.largo || !t.texto.trim()) continue;
      const texto = t.texto.trim();
      if (TEXTO_DE_PRUEBA.test(texto) || pareceTecleado(texto)) {
        h.add(`texto-de-prueba:${claveFicha(f.entidad, f.id)}:${t.campo}`, "media", `${etiqueta(f)} · ${t.rotulo}: parece un resto de prueba («${cita(texto)}»).`, [f]);
      } else if (texto.split(/\s+/).length <= 3) {
        h.add(`texto-muy-corto:${claveFicha(f.entidad, f.id)}:${t.campo}`, "baja", `${etiqueta(f)} · ${t.rotulo}: muy corto para un texto; quizá un resto de prueba («${cita(texto)}»).`, [f]);
      }
      if (RESTO_HTML.test(texto)) {
        h.add(`resto-html:${claveFicha(f.entidad, f.id)}:${t.campo}`, "media", `${etiqueta(f)} · ${t.rotulo}: tiene restos de HTML o viñetas pegadas.`, [f]);
      }
      if (!t.privado && SEGUNDA_PERSONA.test(texto.replace(ENTRE_COMILLAS, ""))) {
        h.add(`habla-al-lector:${claveFicha(f.entidad, f.id)}:${t.campo}`, "baja", `${etiqueta(f)} · ${t.rotulo}: parece hablarle al lector, y la guía no lo admite.`, [f]);
      }
    }
  }
  return h.lista;
}

// ── Fichas a medias ──────────────────────────────────────────────────────────

/** Lo que una ficha empezada no debería dejar sin decir, además de su texto principal. */
function faltaEsencial(ix: Indice, f: FichaFoto): string[] {
  const falta: string[] = [];
  const conexion = (relId: string, lado: "a" | "b" = "a") =>
    ix.aristas(relId).some((a) => (lado === "a" ? a.a.id === f.id && a.a.entidad === f.entidad : a.b?.id === f.id && a.b.entidad === f.entidad));
  const fecha = (rol: string) => !!ix.fecha(f.entidad, f.id, rol);
  if (f.entidad === "personajes") {
    if (!fecha("nacimiento") && !String(f.valores.edad ?? "").trim()) falta.push("nacimiento o edad");
    if (!conexion("personaje_raza")) falta.push("raza");
    if (f.valores.estadoVital === "Fallecido" && !fecha("muerte")) falta.push("fecha de muerte");
  }
  if (f.entidad === "timeline" && !fecha("principal")) falta.push("fecha (no entra en la cronología)");
  if (f.entidad === "actos") {
    if (!fecha("principal")) falta.push("fecha");
    if (!conexion("acto_pov")) falta.push("POV");
  }
  if (f.entidad === "regiones" && f.valores.nacionId == null) falta.push("nación");
  if (f.entidad === "locaciones" && f.valores.nacionId == null && f.valores.regionId == null) falta.push("nación o región");
  if (f.entidad === "capitulos" && !ix.de("actos").some((a) => Number(a.valores.capituloId) === f.id)) falta.push("actos");
  return falta;
}

const SIN_MOLDE_DE_TEXTO = new Set(["fragmentos", "elementos", "economia"]);

export function huecos(ix: Indice): { hallazgos: Hallazgo[]; resumen: ResumenHuecos[] } {
  const h = new Coleccion("huecos");
  const { foto } = ix;
  const conConexion = new Set<string>();
  for (const a of foto.aristas) {
    conConexion.add(claveFicha(a.a.entidad, a.a.id));
    if (a.b) conConexion.add(claveFicha(a.b.entidad, a.b.id));
  }
  const conFecha = new Set(foto.fechas.map((f) => claveFicha(f.entidad, f.id)));

  const resumen = new Map<string, ResumenHuecos>();
  for (const f of foto.fichas) {
    if (f.enPapelera || SIN_MOLDE_DE_TEXTO.has(f.entidad)) continue;
    const r = resumen.get(f.entidad) ?? { entidad: f.entidad, total: 0, publicas: 0, vacias: 0, vaciasPublicas: 0, aMedias: 0, aMediasPublicas: 0 };
    resumen.set(f.entidad, r);
    r.total++;
    if (f.publica) r.publicas++;

    const clave = claveFicha(f.entidad, f.id);
    const tieneTexto = f.textos.some((t) => t.largo && !t.privado && t.texto.trim());
    const tieneHijos =
      (f.entidad === "capitulos" && ix.de("actos").some((a) => Number(a.valores.capituloId) === f.id)) ||
      (f.entidad === "arcos" && ix.de("hojas").some((x) => Number(x.valores.arcoId) === f.id));
    const vacia = !tieneTexto && !tieneHijos && !conConexion.has(clave) && !conFecha.has(clave) && !f.valores.imagenUrl;
    if (vacia) {
      r.vacias++;
      if (f.publica) {
        r.vaciasPublicas++;
        h.add(`vacia:${clave}`, "baja", `${etiqueta(f)}: publicada y vacía, solo tiene el nombre.`, [f]);
      }
      continue;
    }
    const falta = faltaEsencial(ix, f);
    if (!tieneTexto && !tieneHijos) falta.unshift("texto");
    if (falta.length) {
      r.aMedias++;
      if (f.publica) {
        r.aMediasPublicas++;
        h.add(`a-medias:${clave}`, "baja", `${etiqueta(f)}: publicada y le falta ${falta.join(", ")}.`, [f]);
      }
    }
  }

  foto.calendario.eras.forEach((era, i) => {
    if (i > 0 && era.anioInicio == null) {
      h.add(`era-sin-inicio:${era.id}`, "media", `La era «${era.nombre}» no tiene año de inicio, así que se ignora al escribir las fechas.`, []);
    }
  });

  return { hallazgos: h.lista, resumen: [...resumen.values()] };
}

// ── Todo junto ───────────────────────────────────────────────────────────────

export function revisar(foto: Foto): { hallazgos: Hallazgo[]; resumen: ResumenHuecos[] } {
  const ix = new Indice(foto);
  const { hallazgos: deHuecos, resumen } = huecos(ix);
  return {
    hallazgos: [...secretos(ix), ...fechas(ix), ...conexiones(ix), ...referencias(ix), ...taller(ix), ...menciones(ix), ...guia(ix), ...deHuecos],
    resumen,
  };
}

/** Las fichas que toca un tema: lo llevan en el nombre o lo nombran en un texto. */
export function fichasDelTema(foto: Foto, tema: string): FichaFoto[] {
  const aguja = plano(tema);
  return foto.fichas.filter((f) => !f.enPapelera && (plano(f.nombre).includes(aguja) || f.textos.some((t) => plano(t.texto).includes(aguja))));
}
