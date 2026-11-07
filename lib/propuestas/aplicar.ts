import "server-only";
import { revalidatePath } from "next/cache";
import { and, asc, eq, getTableName, max, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { ZodType } from "zod";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { cambiarEstadoFamilia, cambiarEstadoOrg } from "@/lib/actions/complejas";
import { cambiarEstadoEntidad } from "@/lib/actions/entidades";
import { guardarFechaFicha, marcarFechaOculta } from "@/lib/actions/fechas";
import { cambiarEstadoLore } from "@/lib/actions/lore";
import { guardarNota, leerNota } from "@/lib/actions/notas";
import { cambiarEstadoPersonaje } from "@/lib/actions/personajes";
import { crearActo, crearCapitulo, crearFragmento, guardarActo, guardarCapitulo, guardarFragmento, borrarFragmento } from "@/lib/actions/taller";
import { crearBorradorRapido } from "@/lib/actions/vinculos";
import { getEntidadConfig } from "@/lib/admin/fields";
import { revalidarFicha } from "@/lib/admin/revalidarFicha";
import { leerFecha } from "@/lib/fechas/leer";
import { rolesDe } from "@/lib/fechas/roles";
import { getCalendario } from "@/lib/queries/fechas";
import { calcularPoderDeCombate } from "@/lib/poderCombate";
import { Directorio, entidadDeRef, tablaEntidad, textoDeValor } from "@/lib/queries/propuestas";
import { camposOcultos, escribirCampoOculto } from "@/lib/queries/visibilidad";
import { actualizarVinculo, borrarVinculo, crearVinculo, crearVinculoLibre, leerFilas, marcarVinculoOculto } from "@/lib/relaciones/consultas";
import { bloquesDe, CUALQUIERA } from "@/lib/relaciones/registro";
import { infoDe } from "@/lib/relaciones/tablas";
import { slugify } from "@/lib/utils";
import { buildEntidadSchema } from "@/lib/validation/entidad";
import { loreSchema } from "@/lib/validation/lore";
import { estadisticasSchema, personajeSchema } from "@/lib/validation/personaje";
import { BLOQUES_OCULTABLES } from "@/lib/visibilidad";
import { ESTADISTICAS, EXTRAS_JERARQUIA, TIPOS_SECCION, listasDe } from "./listas";
import { GRUPO_DE_RELACION, TABLAS_GRUPO, cols, leerLista } from "./listasDb";
import { moldeDe, type CampoMolde } from "./moldes";
import { normalizar, type DatoAnalizado, type EntradaFicha, type EstadoFicha, type Objetivo, type ResultadoFicha } from "./tipos";

/**
 * Escribe una ficha propuesta (docs/area-ia.md, Fase 5). Va dato a dato y solo por las
 * vías de siempre: cada conexión, fecha o nota usa la misma función que el panel, y la
 * fila de la ficha se valida con su esquema. A diferencia de los formularios, nunca
 * borra y reinserta: lo que la propuesta no menciona no se toca.
 *
 * Un dato que falla no detiene al resto: se devuelve con su motivo y se queda en el
 * archivo. Repetir la operación no duplica, porque cada dato busca antes lo que ya hay.
 *
 * Sin `assertAdmin`: lo comprueba la Server Action que llama (`lib/actions/propuestas.ts`).
 */

type Fila = Record<string, unknown>;

class Rechazo extends Error {}

const seAplica = (d: DatoAnalizado) => d.decision === "visible" || d.decision === "oculto";

function sin(fila: Fila, ...claves: string[]): Fila {
  const copia = { ...fila };
  for (const k of claves) delete copia[k];
  return copia;
}

/** El esquema de la ficha, campo a campo: el mismo que usa su formulario. */
function esquemaDe(entidad: string): Record<string, ZodType> | null {
  if (entidad === "personajes") return personajeSchema.shape as unknown as Record<string, ZodType>;
  if (entidad === "lore") return loreSchema.shape as unknown as Record<string, ZodType>;
  const config = getEntidadConfig(entidad);
  return config ? (buildEntidadSchema(config).shape as Record<string, ZodType>) : null;
}

/** Organización, familia y gremio se validan a mano en su acción: se aplica la misma regla. */
function valorSinEsquema(c: CampoMolde, valor: string): unknown {
  if (c.tipo !== "numero") return valor.trim() || null;
  const n = parseInt(valor, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

function validar(entidad: string, c: CampoMolde, bruto: unknown): unknown {
  const forma = esquemaDe(entidad);
  if (!forma) return valorSinEsquema(c, String(bruto ?? ""));
  const esquema = forma[c.name];
  if (!esquema) throw new Rechazo(`El campo ${c.label} no se puede escribir.`);
  const r = esquema.safeParse(bruto);
  if (!r.success) throw new Rechazo(r.error.issues[0]?.message ?? `${c.label}: valor no válido.`);
  return r.data;
}

/** Añade al catálogo lo que no está en él. Idempotente, como el desplegable del panel. */
async function asegurarOpcion(catalogo: string, valor: string, grupo: string | null) {
  const v = valor.trim();
  if (!v) return;
  if (catalogo === "elementos") {
    const [el] = await db.select({ id: s.elementos.id }).from(s.elementos).where(sql`lower(${s.elementos.nombre}) = lower(${v})`).limit(1);
    if (!el) throw new Rechazo(`El elemento «${v}» no existe: créalo antes en Elementos.`);
    return;
  }
  const [ya] = await db.select({ id: s.catalogos.id }).from(s.catalogos).where(and(eq(s.catalogos.campo, catalogo), eq(s.catalogos.valor, v))).limit(1);
  if (ya) return;
  const [{ tope }] = await db.select({ tope: max(s.catalogos.orden) }).from(s.catalogos).where(eq(s.catalogos.campo, catalogo));
  await db.insert(s.catalogos).values({ campo: catalogo, valor: v, grupo, orden: (tope ?? -1) + 1 });
  revalidatePath("/admin/catalogos");
}

/** La ficha de un objetivo: la elegida, la que tenga ese nombre, o un borrador nuevo. */
async function fichaDe(dir: Directorio, o: Objetivo): Promise<{ id: number; entidad: string }> {
  const entidad = o.entidadElegida ?? o.entidad;
  if (o.id != null) return { id: o.id, entidad };
  if (!o.crear) throw new Rechazo(`«${o.nombre}»: falta elegir la ficha.`);
  if (entidad === CUALQUIERA) throw new Rechazo(`«${o.nombre}»: este bloque admite cualquier ficha, así que hay que elegirla.`);
  // Puede haber nacido hace un momento, en otra ficha de esta misma propuesta.
  const { exactas } = await dir.buscar(entidad, o.nombre);
  if (exactas.length > 1) throw new Rechazo(`«${o.nombre}»: hay varias fichas con ese nombre, elige una.`);
  if (exactas[0]) return { id: exactas[0].id, entidad };
  // Un capítulo nace en un libro y un acto en un capítulo: no valen de borrador rápido.
  if (entidad === "actos" || entidad === "capitulos") throw new Rechazo(`«${o.nombre}»: aplica antes su ficha.`);
  const creada = await crearBorradorRapido(entidad, o.nombre);
  if (!creada) throw new Rechazo(`«${o.nombre}»: no se pudo crear el borrador.`);
  return { id: creada.id, entidad };
}

// ── Campos de la ficha ─────────────────────────────────────────────────────

async function valorDeCampo(entidad: string, c: CampoMolde, d: DatoAnalizado, dir: Directorio, fila: Fila | null, conjunto: Fila): Promise<unknown> {
  if (d.vaciar) return validar(entidad, c, c.tipo === "lista" ? [] : null);
  if (c.tipo === "ficha") {
    if (!d.objetivo) return null;
    return validar(entidad, c, (await fichaDe(dir, { ...d.objetivo, entidad: entidadDeRef(c.ref) ?? d.objetivo.entidad })).id);
  }
  if (c.tipo === "si-no") return validar(entidad, c, /^(s[ií]|true|1)$/i.test(d.valor.trim()));
  if (c.tipo === "lista") {
    const valores = d.valor.split(",").map((v) => v.trim()).filter(Boolean);
    if (c.catalogo) for (const v of valores) await asegurarOpcion(c.catalogo, v, null);
    return validar(entidad, c, valores);
  }
  if (c.tipo === "opcion" && c.catalogo && d.valor.trim()) {
    // Una opción dependiente va al grupo del campo del que depende (la variante, de su tipo).
    const padre = getEntidadConfig(entidad)?.fields.find((f) => f.name === c.name)?.dependeDe;
    const grupo = padre ? textoDeValor(conjunto[padre] ?? fila?.[padre]) || null : null;
    await asegurarOpcion(c.catalogo, d.valor, grupo);
  }
  if (c.opciones) {
    const fija = getEntidadConfig(entidad)?.fields.find((f) => f.name === c.name)?.opciones?.find((o) => normalizar(o.etiqueta) === normalizar(d.valor));
    if (fija) return validar(entidad, c, fija.valor);
  }
  if (d.anadir) {
    const previo = textoDeValor(fila?.[c.name]);
    if (previo.includes(d.valor.trim())) return validar(entidad, c, previo);
    return validar(entidad, c, previo ? `${previo}\n\n${d.valor.trim()}` : d.valor.trim());
  }
  return validar(entidad, c, d.valor);
}

/** Compone "Tipo (Variante)", como el formulario: lo leen la ficha pública y su enlace. */
function derivados(entidad: string, conjunto: Fila, fila: Fila | null) {
  if (entidad !== "personajes") return;
  const combinar = (tipo: string, variante: string, destino: string) => {
    if (!(tipo in conjunto) && !(variante in conjunto)) return;
    const t = (tipo in conjunto ? conjunto[tipo] : fila?.[tipo]) as string | null | undefined;
    const v = (variante in conjunto ? conjunto[variante] : fila?.[variante]) as string | null | undefined;
    conjunto[destino] = t ? (v ? `${t} (${v})` : t) : null;
  };
  combinar("magiaPrincipalTipo", "magiaPrincipalVariante", "tipoMagiaPrincipal");
  combinar("magiaSecundariaTipo", "magiaSecundariaVariante", "magiaSecundaria");
}

/**
 * Vacía los campos de una ficha nueva que tendrían un valor por defecto en la base
 * ("Nivel de amenaza: D"): lo mismo que hace el formulario, y una propuesta no debe
 * traer datos que nadie ha dicho. Los obligatorios se quedan con el suyo.
 */
async function sinValoresPorDefecto(entidad: string, tabla: PgTable): Promise<Fila> {
  const admitenVacio = (await db.execute(sql`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${getTableName(tabla)} and is_nullable = 'YES' and column_default is not null
  `)) as unknown as { column_name: string }[];
  const nombres = new Set(admitenVacio.map((f) => f.column_name));
  const c = cols(tabla);
  return Object.fromEntries((moldeDe(entidad)?.campos ?? []).filter((m) => c[m.name] && nombres.has(c[m.name].name)).map((m) => [m.name, null]));
}

/** Crea la fila de una ficha nueva, por la vía que le toca, y devuelve su id. */
async function crearFila(entidad: string, nombreCol: string, nombre: string, conjunto: Fila): Promise<number> {
  const tabla = tablaEntidad(entidad);
  if (!tabla) throw new Rechazo("Ese tipo de ficha no se puede crear.");
  const c = cols(tabla);

  if (entidad === "capitulos") {
    const { libro, tipo, ...resto } = conjunto;
    const r = await crearCapitulo({ titulo: nombre, libro: (libro as string) ?? null, tipo: (tipo as string) ?? null });
    if (!r.ok) throw new Rechazo(r.error);
    if (Object.keys(resto).length) {
      const g = await guardarCapitulo(r.data.id, resto);
      if (!g.ok) throw new Rechazo(g.error);
    }
    return r.data.id;
  }

  if (entidad === "actos") {
    const capituloId = conjunto.capituloId as number | null | undefined;
    if (!capituloId) throw new Rechazo("Un acto nuevo necesita su capítulo: añade «Capítulo» a la propuesta.");
    const resto = sin(conjunto, "capituloId");
    // La fase se elige en el taller; un acto nuevo empieza en la primera de la plantilla.
    const [cap] = await db.select({ plantillaId: s.capitulos.plantillaId }).from(s.capitulos).where(eq(s.capitulos.id, capituloId)).limit(1);
    const [fase] = cap?.plantillaId
      ? await db.select({ id: s.estructuraFase.id }).from(s.estructuraFase).where(eq(s.estructuraFase.plantillaId, cap.plantillaId)).orderBy(asc(s.estructuraFase.orden), asc(s.estructuraFase.id)).limit(1)
      : [];
    const r = await crearActo({ capituloId, nombre, faseId: fase?.id ?? null });
    if (!r.ok) throw new Rechazo(r.error);
    if (Object.keys(resto).length) {
      const g = await guardarActo(r.data.id, resto);
      if (!g.ok) throw new Rechazo(g.error);
    }
    return r.data.id;
  }

  const valores: Fila = { ...(await sinValoresPorDefecto(entidad, tabla)), ...conjunto, [nombreCol]: nombre };
  if (c.estadoPublicacion) valores.estadoPublicacion = "borrador";
  if (entidad === "lore") {
    valores.slug ||= slugify(nombre);
    if (!/^[a-z0-9-]+$/.test(String(valores.slug))) throw new Rechazo("El slug solo admite minúsculas, números y guiones.");
    const [ya] = await db.select({ id: s.paginasLore.id }).from(s.paginasLore).where(eq(s.paginasLore.slug, String(valores.slug))).limit(1);
    if (ya) throw new Rechazo(`Ya hay una página con el slug «${valores.slug}».`);
  }
  const [creada] = (await db.insert(tabla).values(valores as never).returning({ id: c.id })) as unknown as { id: number }[];
  return creada.id;
}

async function actualizarFila(entidad: string, id: number, conjunto: Fila) {
  if (Object.keys(conjunto).length === 0) return;
  if (entidad === "capitulos") {
    const r = await guardarCapitulo(id, conjunto);
    if (!r.ok) throw new Rechazo(r.error);
    return;
  }
  if (entidad === "actos") {
    // Mover un acto de capítulo cambia su orden y su fase: eso se hace en el taller.
    const r = await guardarActo(id, sin(conjunto, "capituloId"));
    if (!r.ok) throw new Rechazo(r.error);
    return;
  }
  const tabla = tablaEntidad(entidad)!;
  await db.update(tabla).set(conjunto as never).where(eq(cols(tabla).id, id));
}

// ── Conexiones ─────────────────────────────────────────────────────────────

/** Rango y facción de un miembro por su nombre; lo que no exista se crea al final. */
async function idDeGrupo(tabla: "rangos" | "facciones", entidad: string, grupoId: number, nombre: string): Promise<number | null> {
  const n = nombre.trim();
  if (!n) return null;
  const g = TABLAS_GRUPO[entidad];
  const t = tabla === "rangos" ? g.rangos : g.facciones;
  const c = cols(t);
  const filas = (await db.select().from(t).where(eq(c[g.fk], grupoId))) as Fila[];
  const ya = filas.find((f) => normalizar(String(f.nombre)) === normalizar(n));
  if (ya) return Number(ya.id);
  const valores: Fila = { [g.fk]: grupoId, nombre: n };
  if (tabla === "rangos") valores.peso = Math.min(1, ...filas.map((f) => Number(f.peso ?? 1))) - 1;
  const [creada] = (await db.insert(t).values(valores as never).returning({ id: c.id })) as unknown as { id: number }[];
  return creada.id;
}

async function fijarExtrasMiembro(relId: string, filaId: number, grupoId: number, d: DatoAnalizado) {
  const entidad = GRUPO_DE_RELACION[relId];
  if (!entidad) return;
  const extras = EXTRAS_JERARQUIA[relId] ?? [];
  const valor = (name: string) => d.subcampos?.find((x) => x.name === name)?.valor ?? "";
  const set: Fila = {};
  for (const e of extras) {
    const v = valor(e.name);
    if (!v) continue;
    if (e.name === "rango") set.rangoId = await idDeGrupo("rangos", entidad, grupoId, v);
    else if (e.name === "faccion") set.faccionId = await idDeGrupo("facciones", entidad, grupoId, v);
    else set[e.name] = v;
  }
  if (Object.keys(set).length === 0) return;
  const t = TABLAS_GRUPO[entidad].jerarquia;
  await db.update(t).set(set as never).where(eq(cols(t).id, filaId));
}

async function aplicarConexion(entidad: string, id: number, d: DatoAnalizado, dir: Directorio) {
  const b = bloquesDe(entidad).find((x) => x.relId === d.relId && x.lado === d.lado);
  if (!b) throw new Rechazo("Esa conexión no es de esta ficha.");
  const relId = b.relId;

  if (d.clase === "quitar") {
    if (d.filaId) await borrarVinculo(relId, d.filaId);
    return;
  }

  const propios = new Set(b.campos.map((c) => c.name));
  const campos: Record<string, string> = {};
  for (const sub of d.subcampos ?? []) {
    if (!propios.has(sub.name)) continue;
    const def = b.campos.find((c) => c.name === sub.name)!;
    if (def.tipo === "checkbox") campos[sub.name] = /^(s[ií]|true)$/i.test(sub.valor) ? "true" : "false";
    else campos[sub.name] = sub.valor;
    if (def.catalogo && sub.valor) await asegurarOpcion(def.catalogo, sub.valor, null);
  }
  const oculto = d.decision === "oculto";
  const o = d.objetivo!;

  // Nombre suelto, sin ficha.
  if (o.sinFicha) {
    let filaId = d.modoFila === "actualizar" ? (d.filaId ?? null) : null;
    if (filaId) await actualizarVinculo(relId, filaId, await conCamposActuales(relId, b.lado, id, entidad, filaId, campos));
    else filaId = await crearVinculoLibre(relId, id, o.nombre, campos, { oculto });
    if (!filaId) throw new Rechazo("Esta conexión no admite nombres sin ficha.");
    if (d.filaId) await marcarVinculoOculto(relId, filaId, oculto);
    await fijarExtrasMiembro(relId, filaId, id, d);
    return;
  }

  const destino = await fichaDe(dir, o);
  let filaId = d.modoFila === "actualizar" ? (d.filaId ?? null) : null;
  if (filaId) {
    await actualizarVinculo(relId, filaId, await conCamposActuales(relId, b.lado, id, entidad, filaId, campos));
    await marcarVinculoOculto(relId, filaId, oculto);
  } else {
    filaId = await crearVinculo(relId, b.lado, id, entidad, { id: destino.id, tipo: b.objetivo === CUALQUIERA ? destino.entidad : undefined }, campos, { oculto });
  }
  if (filaId) await fijarExtrasMiembro(relId, filaId, b.lado === "a" ? id : destino.id, d);
  revalidarFicha(destino.entidad, destino.id);
}

/** Actualizar una fila escribe todos sus campos: lo que la propuesta no trae se conserva. */
async function conCamposActuales(relId: string, lado: "a" | "b", ownerId: number, entidad: string, filaId: number, campos: Record<string, string>) {
  const fila = (await leerFilas(relId, lado, ownerId, entidad)).find((f) => f.id === filaId);
  const limpios = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== ""));
  return { ...(fila?.campos ?? {}), ...limpios };
}

// ── Fechas ─────────────────────────────────────────────────────────────────

async function aplicarFecha(entidad: string, id: number, d: DatoAnalizado) {
  const rol = rolesDe(entidad).find((r) => r.rol === d.rol);
  if (!rol) throw new Rechazo("Esa fecha no es de esta ficha.");
  const cal = await getCalendario();
  const fecha = d.vaciar ? null : leerFecha(cal, d.valor);
  if (!d.vaciar && !fecha) throw new Rechazo("No se entiende la fecha.");
  if (entidad === "actos") {
    const r = await guardarActo(id, { fecha, importante: d.importante ?? false });
    if (!r.ok) throw new Rechazo(r.error);
  } else {
    const r = await guardarFechaFicha(entidad, id, rol.rol, fecha, d.importante ?? false);
    if (!r.ok) throw new Rechazo(r.error);
  }
  if (fecha) {
    const r = await marcarFechaOculta(entidad, id, rol.rol, d.decision === "oculto");
    if (!r.ok) throw new Rechazo(r.error);
  }
}

// ── Listas ─────────────────────────────────────────────────────────────────

const subValor = (d: DatoAnalizado, name: string) => d.subcampos?.find((x) => x.name === name)?.valor.trim() ?? "";
const destacado = (v: string) => (v ? { destacado: true, motivoDestacado: normalizar(v) === "si" ? null : v } : {});

async function aplicarHabilidad(id: number, d: DatoAnalizado, dir: Directorio) {
  if (d.clase === "quitar-lista") {
    if (d.filaId) await db.delete(s.habilidades).where(eq(s.habilidades.idHabilidad, d.filaId));
    return;
  }
  const categoria = subValor(d, "categoria");
  const tipo = subValor(d, "tipo");
  const elemento = subValor(d, "elemento");
  if (categoria) await asegurarOpcion("habilidad_categoria", categoria, null);
  if (tipo) await asegurarOpcion("magia_tipo", tipo, null);

  let magiaId: number | null = d.objetivo?.id ?? null;
  if (!magiaId && d.objetivo?.crear) {
    // Como en el formulario del personaje: la técnica entra en el catálogo de magia, en borrador.
    const { exactas } = await dir.buscar("magia", d.nombre ?? "");
    if (exactas[0]) magiaId = exactas[0].id;
    else {
      const [m] = await db
        .insert(s.magiaFundamentos)
        .values({ nombre: d.nombre ?? "", naturaleza: "Tecnica", tipo: tipo || null, subcategoria: elemento || null, estadoPublicacion: "borrador" })
        .returning({ id: s.magiaFundamentos.id });
      magiaId = m.id;
    }
  }
  const valores = {
    personajeId: id,
    magiaFundamentoId: magiaId,
    categoria: categoria || "Habilidades",
    nombre: d.nombre || null,
    tipo: tipo || null,
    descripcion: d.valor.trim() || null,
    oculto: d.decision === "oculto",
  };
  if (d.filaId) await db.update(s.habilidades).set(valores).where(eq(s.habilidades.idHabilidad, d.filaId));
  else await db.insert(s.habilidades).values(valores);
}

async function aplicarRangos(entidad: string, id: number, datos: DatoAnalizado[]) {
  const g = TABLAS_GRUPO[entidad];
  const c = cols(g.rangos);
  const quitados = datos.filter((d) => d.clase === "quitar-lista" && d.filaId && seAplica(d));
  for (const d of quitados) {
    const j = cols(g.jerarquia);
    await db.update(g.jerarquia).set({ rangoId: null } as never).where(eq(j.rangoId, d.filaId!));
    await db.delete(g.rangos).where(eq(c.id, d.filaId!));
  }
  // La lista va de arriba abajo, como en el formulario; lo que ya había y no sale, debajo.
  const nuevos = datos.filter((d) => d.clase === "lista" && (seAplica(d) || d.igual)).map((d) => (d.nombre ?? "").trim()).filter(Boolean);
  const existentes = (await db.select().from(g.rangos).where(eq(c[g.fk], id))) as Fila[];
  const porNombre = new Map(existentes.map((f) => [normalizar(String(f.nombre)), f]));
  const resto = [...existentes].sort((a, b) => Number(b.peso ?? 0) - Number(a.peso ?? 0)).filter((f) => !nuevos.some((n) => normalizar(n) === normalizar(String(f.nombre))));
  const total = nuevos.length + resto.length;
  for (const [i, nombre] of nuevos.entries()) {
    const ya = porNombre.get(normalizar(nombre));
    if (ya) await db.update(g.rangos).set({ peso: total - i } as never).where(eq(c.id, Number(ya.id)));
    else await db.insert(g.rangos).values({ [g.fk]: id, nombre, peso: total - i } as never);
  }
  for (const [i, f] of resto.entries()) await db.update(g.rangos).set({ peso: resto.length - i } as never).where(eq(c.id, Number(f.id)));
}

async function aplicarFaccion(entidad: string, id: number, d: DatoAnalizado) {
  const g = TABLAS_GRUPO[entidad];
  const c = cols(g.facciones);
  if (d.clase === "quitar-lista") {
    if (!d.filaId) return;
    const j = cols(g.jerarquia);
    await db.update(g.jerarquia).set({ faccionId: null } as never).where(eq(j.faccionId, d.filaId));
    await db.delete(g.facciones).where(eq(c.id, d.filaId));
    return;
  }
  const color = subValor(d, "color") || null;
  if (d.filaId) await db.update(g.facciones).set({ color } as never).where(eq(c.id, d.filaId));
  else await db.insert(g.facciones).values({ [g.fk]: id, nombre: (d.nombre ?? "").trim(), color } as never);
}

/** La ficha a la que apunta una fila de lista, si apunta a alguna: sin ficha es solo un nombre. */
async function fichaDeFila(d: DatoAnalizado, dir: Directorio): Promise<{ id: number; nombre: string } | null> {
  const o = d.objetivo;
  if (!o || o.sinFicha || (o.id == null && !o.crear)) return null;
  const f = await fichaDe(dir, o);
  return { id: f.id, nombre: o.label ?? o.nombre };
}

async function aplicarHistorial(entidad: string, id: number, d: DatoAnalizado, dir: Directorio) {
  const g = TABLAS_GRUPO[entidad];
  if (!g.historial) throw new Rechazo("Esta ficha no tiene historial.");
  const c = cols(g.historial);
  if (d.clase === "quitar-lista") {
    if (d.filaId) await db.delete(g.historial).where(eq(c.id, d.filaId));
    return;
  }
  const ficha = await fichaDeFila(d, dir);
  const valores: Fila = {
    nombre: ficha?.nombre ?? ((d.nombre ?? "").trim() || "—"),
    personajeId: ficha?.id ?? null,
    rol: subValor(d, "rol") || null,
    periodo: subValor(d, "periodo") || null,
    estado: subValor(d, "estado"),
    notas: subValor(d, "notas") || null,
    destacado: false,
    motivoDestacado: null,
    ...destacado(subValor(d, "destacado")),
    oculto: d.decision === "oculto",
  };
  if (d.filaId) {
    await db.update(g.historial).set(valores as never).where(eq(c.id, d.filaId));
    return;
  }
  const [{ tope }] = await db.select({ tope: max(c.orden) }).from(g.historial).where(eq(c[g.fk], id));
  await db.insert(g.historial).values({ ...valores, [g.fk]: id, orden: Number(tope ?? -1) + 1 } as never);
}

/** El árbol va en dos pasadas, como el formulario: primero las personas y luego sus padres. */
async function aplicarArbol(id: number, datos: DatoAnalizado[], fallidos: Record<string, string>, aplicados: string[], dir: Directorio) {
  for (const d of datos) {
    if (d.clase !== "quitar-lista" || !d.filaId) continue;
    await db.update(s.familiaArbol).set({ padreId: null }).where(eq(s.familiaArbol.padreId, d.filaId));
    await db.update(s.familiaArbol).set({ madreId: null }).where(eq(s.familiaArbol.madreId, d.filaId));
    await db.delete(s.familiaArbol).where(eq(s.familiaArbol.id, d.filaId));
    aplicados.push(d.clave);
  }
  const filas = datos.filter((d) => d.clase === "lista");
  const ids = new Map<string, number>();
  for (const d of filas) {
    try {
      const generacion = subValor(d, "generacion");
      if (generacion && !/^-?\d+$/.test(generacion)) throw new Rechazo("La generación debe ser un número.");
      const estado = subValor(d, "estado");
      if (estado) await asegurarOpcion("estado_vital", estado, null);
      const ficha = await fichaDeFila(d, dir);
      const valores = {
        familiaId: id,
        nombre: ficha?.nombre ?? ((d.nombre ?? "").trim() || "—"),
        personajeId: ficha?.id ?? null,
        generacion: generacion ? Number(generacion) : 0,
        estado,
        notas: subValor(d, "notas") || null,
        destacado: false,
        motivoDestacado: null as string | null,
        ...destacado(subValor(d, "destacado")),
        oculto: d.decision === "oculto",
      };
      if (d.filaId) {
        await db.update(s.familiaArbol).set(valores).where(eq(s.familiaArbol.id, d.filaId));
        ids.set(normalizar(d.nombre ?? ""), d.filaId);
      } else {
        const [nueva] = await db.insert(s.familiaArbol).values(valores).returning({ id: s.familiaArbol.id });
        ids.set(normalizar(d.nombre ?? ""), nueva.id);
      }
    } catch (e) {
      fallidos[d.clave] = motivo(e);
    }
  }
  const actuales = await leerLista("familias", "arbol", id);
  const buscar = (nombre: string): number | null => {
    const n = normalizar(nombre);
    return ids.get(n) ?? actuales.find((a) => normalizar(a.nombre) === n)?.id ?? null;
  };
  for (const d of filas) {
    if (fallidos[d.clave]) continue;
    const propia = ids.get(normalizar(d.nombre ?? ""));
    const padre = subValor(d, "padre");
    const madre = subValor(d, "madre");
    const padreId = padre ? buscar(padre) : null;
    const madreId = madre ? buscar(madre) : null;
    if (padre && !padreId) fallidos[d.clave] = `No hay nadie llamado «${padre}» en el árbol.`;
    else if (madre && !madreId) fallidos[d.clave] = `No hay nadie llamada «${madre}» en el árbol.`;
    else {
      if (propia && (padre || madre)) {
        await db.update(s.familiaArbol).set({ ...(padre ? { padreId } : {}), ...(madre ? { madreId } : {}) }).where(eq(s.familiaArbol.id, propia));
      }
      aplicados.push(d.clave);
    }
  }
}

async function aplicarSeccion(id: number, d: DatoAnalizado) {
  if (d.clase === "quitar-lista") {
    if (d.filaId) await db.delete(s.paginaSecciones).where(eq(s.paginaSecciones.id, d.filaId));
    return;
  }
  const rotulo = subValor(d, "tipo");
  const tipo = rotulo ? TIPOS_SECCION.find((t) => normalizar(t.label) === normalizar(rotulo) || t.valor === normalizar(rotulo))?.valor : "texto";
  if (!tipo) throw new Rechazo(`No hay ningún tipo de sección llamado «${rotulo}».`);
  const valores = {
    titulo: (d.nombre ?? "").trim() || null,
    contenido: d.valor.trim() || null,
    tipo,
    estadoPublicacion: d.decision === "oculto" ? ("oculto" as const) : ("publicado" as const),
  };
  if (d.filaId) {
    await db.update(s.paginaSecciones).set(valores).where(eq(s.paginaSecciones.id, d.filaId));
    return;
  }
  const [{ tope }] = await db.select({ tope: max(s.paginaSecciones.orden) }).from(s.paginaSecciones).where(eq(s.paginaSecciones.paginaId, id));
  await db.insert(s.paginaSecciones).values({ ...valores, paginaId: id, orden: (tope ?? -1) + 1 });
}

async function aplicarFragmento(id: number, d: DatoAnalizado, dir: Directorio) {
  if (d.clase === "quitar-lista") {
    if (d.filaId) {
      const r = await borrarFragmento(d.filaId);
      if (!r.ok) throw new Rechazo(r.error);
    }
    return;
  }
  const cal = await getCalendario();
  const textoFecha = subValor(d, "fecha");
  const fecha = textoFecha ? leerFecha(cal, textoFecha) : undefined;
  if (textoFecha && !fecha) throw new Rechazo(`No se entiende la fecha «${textoFecha}».`);
  const pov = (await fichaDeFila(d, dir))?.id ?? null;

  // Se crea sin POV y se le pone al guardar: si un dato no vale, se borra sin dejar rastro en el acto.
  let fragmentoId = d.filaId ?? null;
  const nuevo = !fragmentoId;
  if (!fragmentoId) {
    const [{ tope }] = await db.select({ tope: max(s.actoFragmento.id) }).from(s.actoFragmento).where(eq(s.actoFragmento.actoId, id));
    const c = await crearFragmento(id, null);
    if (!c.ok) throw new Rechazo(c.error);
    fragmentoId = c.data.fragmentos.filter((f) => f.id > Number(tope ?? 0)).at(-1)?.id ?? null;
  }
  if (!fragmentoId) throw new Rechazo("No se pudo crear el fragmento.");
  const r = await guardarFragmento(fragmentoId, {
    titulo: (d.nombre ?? "").trim() || null,
    enlace: subValor(d, "enlace") || null,
    ...(d.objetivo ? { personajeId: pov } : {}),
    ...(fecha ? { fecha } : {}),
  });
  if (!r.ok) {
    if (nuevo) await borrarFragmento(fragmentoId);
    throw new Rechazo(r.error);
  }
  const povAnadido = r.data.povAnadido;
  // Un fragmento no se oculta entero: se ocultan su POV y su fecha.
  const oculto = d.decision === "oculto";
  await escribirCampoOculto("fragmentos", fragmentoId, "personajeId", !oculto);
  if (fecha) await marcarFechaOculta("fragmentos", fragmentoId, "principal", oculto);
  if (!oculto) return;
  // Su POV entra en el bloque POV del acto y la fecha del acto se calcula de la suya:
  // los dos delatarían lo que se acaba de ocultar.
  if (povAnadido && pov) {
    await db
      .update(s.vinculo)
      .set({ oculto: true })
      .where(and(eq(s.vinculo.relacion, "acto_pov"), eq(s.vinculo.origenTipo, "actos"), eq(s.vinculo.origenId, id), eq(s.vinculo.destinoTipo, "personajes"), eq(s.vinculo.destinoId, pov)));
  }
  if (fecha) await marcarFechaOculta("actos", id, "principal", true);
}

async function aplicarEstadisticas(id: number, d: DatoAnalizado) {
  const [previa] = await db.select().from(s.estadisticas).where(eq(s.estadisticas.personajeId, id)).limit(1);
  const forma = estadisticasSchema.shape as unknown as Record<string, ZodType>;
  const nuevos: Fila = {};
  for (const sub of d.subcampos ?? []) {
    if (!sub.valor.trim()) continue;
    const r = forma[sub.name]?.safeParse(sub.valor);
    if (!r?.success) throw new Rechazo(`${sub.label}: valor no válido.`);
    nuevos[sub.name] = r.data;
  }
  // Lo que no se da, vacío: `precision_val` tiene un valor por defecto en la base que el formulario nunca deja pasar.
  const vacias = Object.fromEntries(ESTADISTICAS.map((e) => [e.name, null]));
  const juntos = { ...vacias, ...sin((previa ?? {}) as Fila, "idEstadistica", "personajeId", "poderDeCombate"), ...nuevos };
  const poderDeCombate = calcularPoderDeCombate(juntos as never).total;
  if (previa) await db.update(s.estadisticas).set({ ...juntos, poderDeCombate } as never).where(eq(s.estadisticas.personajeId, id));
  else await db.insert(s.estadisticas).values({ ...juntos, poderDeCombate, personajeId: id } as never);
  const ocultas = await camposOcultos("personajes", id);
  const oculto = d.decision === "oculto";
  if (BLOQUES_OCULTABLES.personajes.some((b) => b.name === "estadisticas") && ocultas.has("estadisticas") !== oculto) {
    await escribirCampoOculto("personajes", id, "estadisticas", !oculto);
  }
}

// ── Estado ─────────────────────────────────────────────────────────────────

async function fijarEstado(entidad: string, id: number, estado: EstadoFicha) {
  if (entidad === "personajes") await cambiarEstadoPersonaje(id, estado);
  else if (entidad === "organizaciones") await cambiarEstadoOrg(id, estado);
  else if (entidad === "familias") await cambiarEstadoFamilia(id, estado);
  else if (entidad === "lore") await cambiarEstadoLore(id, estado);
  else if (entidad === "capitulos") {
    const r = await guardarCapitulo(id, { estadoPublicacion: estado });
    if (!r.ok) throw new Rechazo(r.error);
  } else if (entidad === "actos") {
    const r = await guardarActo(id, { estadoPublicacion: estado });
    if (!r.ok) throw new Rechazo(r.error);
  } else await cambiarEstadoEntidad(entidad, id, estado);
}

function motivo(e: unknown): string {
  if (e instanceof Rechazo) return e.message;
  console.error("[aplicarPropuesta]", e);
  return "No se pudo guardar este dato. Inténtalo de nuevo.";
}

/** El texto con el que un dato entra en las notas de la ficha. */
function textoParaNotas(d: DatoAnalizado): string {
  if (d.clase === "nota") return d.valor.trim();
  if (d.clase === "desconocido") return d.valor.trim() || d.raw;
  if (d.editor === "largo") return `### ${d.rotulo}\n${d.valor.trim()}`;
  if (d.editor === "fila" || d.objetivo || d.subcampos) {
    const quien = d.objetivo?.label ?? d.nombre ?? d.objetivo?.nombre ?? "";
    const subs = (d.subcampos ?? []).filter((x) => x.valor).map((x) => `${x.label}: ${x.valor}`);
    return `- ${d.rotulo}: ${[quien, ...subs, d.valor.trim()].filter(Boolean).join(" · ")}`;
  }
  return `- ${d.rotulo}: ${d.valor.trim()}`;
}

// ── La ficha entera ────────────────────────────────────────────────────────

export async function aplicarPropuesta(entrada: EntradaFicha): Promise<ResultadoFicha> {
  const { entidad } = entrada;
  const molde = moldeDe(entidad);
  const tabla = tablaEntidad(entidad);
  const aplicados: string[] = [];
  const fallidos: Record<string, string> = {};
  if (!molde || !tabla) return { ok: false, id: null, error: "Ese tipo de ficha no se puede aplicar.", fallidos, aplicados };

  const dir = new Directorio();
  const c = cols(tabla);
  const datos = entrada.datos;
  const hechos = datos.filter((d) => d.decision === "descartar").map((d) => d.clave);

  // ¿Sobre qué ficha?
  let id = entrada.id;
  let fila: Fila | null = null;
  if (id) {
    [fila] = (await db.select().from(tabla).where(eq(c.id, id)).limit(1)) as Fila[];
    fila ??= null;
    if (!fila) return { ok: false, id: null, error: `La ficha #${id} ya no existe.`, fallidos, aplicados };
  } else if (!entrada.crearOtra) {
    // Una conexión de otra ficha puede haberla creado hace un momento.
    const { exactas } = await dir.buscar(entidad, entrada.nombre);
    if (exactas.length > 1) return { ok: false, id: null, error: "Hay varias fichas con ese nombre: elige sobre cuál se aplica.", fallidos, aplicados };
    if (exactas[0]) {
      id = exactas[0].id;
      [fila] = (await db.select().from(tabla).where(eq(c.id, id)).limit(1)) as Fila[];
    }
  }

  // Los campos de la ficha van juntos en una sola escritura.
  const conjunto: Fila = {};
  const camposAplicados: DatoAnalizado[] = [];
  for (const d of datos) {
    if (d.clase !== "campo" || !seAplica(d)) continue;
    const campo = molde.campos.find((x) => x.name === d.campo);
    if (!campo) {
      fallidos[d.clave] = "Esta ficha no tiene ese campo.";
      continue;
    }
    try {
      conjunto[campo.name] = await valorDeCampo(entidad, campo, d, dir, fila, conjunto);
      camposAplicados.push(d);
    } catch (e) {
      fallidos[d.clave] = motivo(e);
    }
  }
  // El nombre de la cabecera manda en una ficha nueva, si no se reescribe abajo.
  const nombre = String(conjunto[molde.nombre] ?? fila?.[molde.nombre] ?? entrada.nombre).trim();
  if (!nombre) return { ok: false, id: null, error: "Una ficha necesita un nombre.", fallidos, aplicados };

  if (entidad === "timeline" && conjunto.actoId != null) {
    const [acto] = await db.select({ capituloId: s.actos.capituloId }).from(s.actos).where(eq(s.actos.id, Number(conjunto.actoId))).limit(1);
    if (acto) conjunto.capituloId = acto.capituloId;
  }
  derivados(entidad, conjunto, fila);

  try {
    if (id) await actualizarFila(entidad, id, conjunto);
    else {
      id = await crearFila(entidad, molde.nombre, nombre, sin(conjunto, molde.nombre));
    }
    for (const d of camposAplicados) aplicados.push(d.clave);
  } catch (e) {
    const m = motivo(e);
    if (!id) return { ok: false, id: null, error: m, fallidos, aplicados };
    for (const d of camposAplicados) fallidos[d.clave] = m;
  }

  const fichaId = id as number;

  // Candados de los campos.
  const ocultos = await camposOcultos(entidad, fichaId);
  for (const d of camposAplicados) {
    if (fallidos[d.clave] || !d.ocultable || !d.campo) continue;
    const oculto = d.decision === "oculto";
    if (ocultos.has(d.campo) !== oculto) {
      try {
        await escribirCampoOculto(entidad, fichaId, d.campo, !oculto);
      } catch (e) {
        fallidos[d.clave] = motivo(e);
      }
    }
  }

  // El orden importa: los rangos y facciones que nombran los miembros, primero.
  const rangos = datos.filter((d) => d.lista === "rangos");
  if (rangos.some(seAplica) && listasDe(entidad).some((l) => l.clase === "rangos")) {
    try {
      await aplicarRangos(entidad, fichaId, rangos);
      for (const d of rangos) if (seAplica(d)) aplicados.push(d.clave);
    } catch (e) {
      for (const d of rangos) if (seAplica(d)) fallidos[d.clave] = motivo(e);
    }
  }
  const arbol = datos.filter((d) => d.lista === "arbol" && seAplica(d));
  if (arbol.length) await aplicarArbol(fichaId, arbol, fallidos, aplicados, dir);

  for (const d of datos) {
    if (!seAplica(d)) continue;
    try {
      if (d.clase === "conexion" || d.clase === "quitar") await aplicarConexion(entidad, fichaId, d, dir);
      else if (d.clase === "fecha") await aplicarFecha(entidad, fichaId, d);
      else if (d.clase === "estadisticas") await aplicarEstadisticas(fichaId, d);
      else if (d.clase === "lista" || d.clase === "quitar-lista") {
        if (d.lista === "rangos" || d.lista === "arbol") continue;
        if (d.lista === "habilidades") await aplicarHabilidad(fichaId, d, dir);
        else if (d.lista === "facciones") await aplicarFaccion(entidad, fichaId, d);
        else if (d.lista === "historial") await aplicarHistorial(entidad, fichaId, d, dir);
        else if (d.lista === "secciones") await aplicarSeccion(fichaId, d);
        else if (d.lista === "fragmentos") await aplicarFragmento(fichaId, d, dir);
      } else continue;
      aplicados.push(d.clave);
    } catch (e) {
      fallidos[d.clave] = motivo(e);
    }
  }

  // Lo que va a las notas, en un solo añadido.
  const paraNotas = datos.filter((d) => d.decision === "notas");
  if (paraNotas.length) {
    try {
      const previa = await leerNota(entidad, fichaId);
      const nuevos = paraNotas.map(textoParaNotas).filter((t) => !previa.includes(t));
      if (nuevos.length) await guardarNota(entidad, fichaId, [previa, ...nuevos].filter(Boolean).join("\n\n"));
      for (const d of paraNotas) aplicados.push(d.clave);
    } catch (e) {
      for (const d of paraNotas) fallidos[d.clave] = motivo(e);
    }
  }
  aplicados.push(...hechos);

  // Al final: publicar por primera vez sella la fecha y avisa a Discord.
  if (entrada.estado && c.estadoPublicacion) {
    const estadoAhora = fila?.estadoPublicacion ?? "borrador";
    if (estadoAhora !== entrada.estado) {
      try {
        await fijarEstado(entidad, fichaId, entrada.estado);
      } catch (e) {
        return { ok: true, id: fichaId, error: `Se aplicó, pero no se pudo cambiar el estado: ${motivo(e)}`, fallidos, aplicados };
      }
    }
  }

  revalidarFicha(entidad, fichaId);
  revalidatePath("/");
  return { ok: true, id: fichaId, fallidos, aplicados };
}

/** Un fragmento de texto suelto: a una hoja de trama nueva o a las notas de una ficha. */
export async function aplicarSuelto(destino: { tipo: "hoja"; arcoId: number; titulo: string; texto: string } | { tipo: "nota"; entidad: string; id: number; titulo: string; texto: string }) {
  const texto = destino.texto.trim();
  if (destino.tipo === "hoja") {
    const [h] = await db
      .insert(s.tramaHojas)
      .values({ arcoId: destino.arcoId, titulo: destino.titulo.trim() || "Sin título", notasPrivadas: texto || null, estadoPublicacion: "borrador" })
      .returning({ id: s.tramaHojas.id });
    revalidatePath("/admin/taller", "layout");
    return { ruta: `/admin/taller/trama/hojas/${h.id}` };
  }
  if (!infoDe(destino.entidad)) throw new Rechazo("Esa ficha no admite notas.");
  const previa = await leerNota(destino.entidad, destino.id);
  await guardarNota(destino.entidad, destino.id, [previa, `### ${destino.titulo}\n${texto}`].filter(Boolean).join("\n\n"));
  return { ruta: null };
}
