import "server-only";
import { and, asc, eq, inArray, isNull, sql, getTableColumns, getTableName, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { getRelacion, bloquesDe, CUALQUIERA, terminoInverso } from "./registro";
import type { RelacionDef, FilaVinculo } from "./tipos";
import { infoDe, tablaDe } from "./tablas";

/**
 * Lectura genérica de relaciones. Una sola implementación sirve a las dos
 * direcciones de las 42 relaciones del registro, tanto las que viven en tabla
 * propia como las que van en la tabla `vinculo`.
 *
 * Todas las escrituras van por id de fila, nunca por la pareja origen-destino:
 * los vínculos duplicados están permitidos a propósito, así que la pareja no
 * identifica una fila.
 */

type Cols = Record<string, PgColumn>;
const cols = (t: PgTable) => getTableColumns(t) as unknown as Cols;

/** Datos de presentación de una ficha del otro extremo. */
export interface Etiqueta {
  label: string;
  detalle: string | null;
  imagenUrl: string | null;
  estado: string | null;
  ruta: string | null;
}

/**
 * Resuelve nombre, imagen y estado de varias fichas de golpe: una consulta por
 * entidad en lugar de una por fila.
 */
export async function etiquetas(entidad: string, ids: number[]): Promise<Map<number, Etiqueta>> {
  const out = new Map<number, Etiqueta>();
  const info = infoDe(entidad);
  if (!info || ids.length === 0) return out;
  const c = cols(info.tabla);
  const sel: Record<string, PgColumn> = { id: c.id, label: c[info.label] };
  if (info.detalle) sel.detalle = c[info.detalle];
  if (info.imagen) sel.imagen = c[info.imagen];
  if (info.estado) sel.estado = c.estadoPublicacion;

  const filas = await db.select(sel).from(info.tabla).where(inArray(c.id, [...new Set(ids)]));

  for (const f of filas as unknown as Record<string, unknown>[]) {
    const id = f.id as number;
    out.set(id, {
      label: (f.label as string) ?? `#${id}`,
      detalle: (f.detalle as string) ?? null,
      imagenUrl: (f.imagen as string) ?? null,
      estado: (f.estado as string) ?? null,
      ruta: info.ruta ? `${info.ruta}/${id}` : null,
    });
  }
  return out;
}

/** Qué entidad hay al otro extremo, desde el lado que mira. */
function objetivoDe(rel: RelacionDef, lado: "a" | "b"): string {
  return lado === "a" ? rel.b.entidad : rel.a.entidad;
}

function visible(e: Etiqueta): boolean {
  return e.estado === null || e.estado === "publicado";
}

export interface OpcionesLectura {
  /** Filtrar a lo que el público puede ver. */
  publico?: boolean;
  limite?: number;
}

/** Lee las filas de un bloque de relación para una ficha concreta. */
export async function leerFilas(
  relId: string,
  lado: "a" | "b",
  ownerId: number,
  opts: OpcionesLectura = {},
): Promise<FilaVinculo[]> {
  const rel = getRelacion(relId);
  if (!rel || !ownerId) return [];
  if (rel.medio === "tabla") return leerDeTabla(rel, lado, ownerId, opts);
  if (rel.medio === "referencia") return leerDeReferencia(rel, lado, ownerId, opts);
  return leerDeVinculo(rel, lado, ownerId, opts);
}

async function leerDeTabla(
  rel: RelacionDef,
  lado: "a" | "b",
  ownerId: number,
  opts: OpcionesLectura,
): Promise<FilaVinculo[]> {
  const def = tablaDe(rel.id);
  if (!def) return [];
  const c = cols(def.tabla);
  const colPropia = lado === "a" ? def.colA : def.colB;
  const colOtra = lado === "a" ? def.colB : def.colA;

  const filtros: SQL[] = [eq(c[colPropia], ownerId)];
  if (def.filtroA) filtros.push(eq(c[def.filtroA.col], def.filtroA.valor));

  const orden = def.orden ? c[def.orden] : c[def.pk];
  const brutas = (await db
    .select()
    .from(def.tabla)
    .where(and(...filtros))
    .orderBy(asc(orden))) as unknown as Record<string, unknown>[];

  const objetivo = objetivoDe(rel, lado);
  const ids = brutas.map((f) => f[colOtra]).filter((x): x is number => typeof x === "number");
  const etiq = await etiquetas(objetivo, ids);

  const out: FilaVinculo[] = [];
  for (const f of brutas) {
    const objetivoId = (f[colOtra] as number | null) ?? null;
    const e = objetivoId != null ? etiq.get(objetivoId) : undefined;
    // Fila que sólo guarda un nombre suelto: miembro de una jerarquía sin ficha.
    const libre = def.colLibre ? ((f[def.colLibre] as string) ?? null) : null;
    if (objetivoId != null && !e) continue;
    if (opts.publico && e && !visible(e)) continue;
    if (objetivoId == null && !libre) continue;

    const campos: Record<string, string> = {};
    for (const campo of rel.campos) {
      const v = f[campo.name];
      campos[campo.name] = v == null ? "" : String(v);
    }
    out.push({
      id: f[def.pk] as number,
      objetivoId: objetivoId ?? 0,
      label: e?.label ?? libre ?? "\u2014",
      imagenUrl: e?.imagenUrl ?? null,
      detalle: e?.detalle ?? null,
      estado: e?.estado ?? null,
      campos,
    });
  }
  return opts.limite ? out.slice(0, opts.limite) : out;
}

async function leerDeVinculo(
  rel: RelacionDef,
  lado: "a" | "b",
  ownerId: number,
  opts: OpcionesLectura,
): Promise<FilaVinculo[]> {
  const v = s.vinculo;
  // El lado A del registro se guarda siempre en las columnas origen_*.
  const propioTipo = lado === "a" ? v.origenTipo : v.destinoTipo;
  const propioId = lado === "a" ? v.origenId : v.destinoId;
  const otroTipo = lado === "a" ? v.destinoTipo : v.origenTipo;
  const otroId = lado === "a" ? v.destinoId : v.origenId;

  // El lado comodín acepta fichas de cualquier entidad: su tipo no se filtra
  // por una constante, ya viene fijado por la ficha que consulta.
  const miEntidad = lado === "a" ? rel.a.entidad : rel.b.entidad;
  const filtros: SQL[] = [eq(v.relacion, rel.relacion ?? rel.id), eq(propioId, ownerId)];
  if (miEntidad !== CUALQUIERA) filtros.push(eq(propioTipo, miEntidad));

  const brutas = await db
    .select({ id: v.id, otroTipo, otroId, tipo: v.tipo, nota: v.nota })
    .from(v)
    .where(and(...filtros))
    .orderBy(asc(v.orden), asc(v.id));

  // El otro extremo puede ser de varios tipos: se agrupa y se resuelve por tipo.
  const porTipo = new Map<string, number[]>();
  for (const f of brutas) {
    const t = f.otroTipo;
    if (!porTipo.has(t)) porTipo.set(t, []);
    porTipo.get(t)!.push(f.otroId);
  }
  const etiqPorTipo = new Map<string, Map<number, Etiqueta>>();
  await Promise.all([...porTipo].map(async ([t, ids]) => etiqPorTipo.set(t, await etiquetas(t, ids))));

  const out: FilaVinculo[] = [];
  for (const f of brutas) {
    const e = etiqPorTipo.get(f.otroTipo)?.get(f.otroId);
    if (!e) continue;
    if (opts.publico && !visible(e)) continue;
    out.push({
      id: f.id,
      objetivoId: f.otroId,
      label: e.label,
      imagenUrl: e.imagenUrl,
      detalle: e.detalle,
      estado: e.estado,
      campos: { tipo: f.tipo ?? "", nota: f.nota ?? "" },
      objetivoTipo: f.otroTipo,
    });
  }
  return opts.limite ? out.slice(0, opts.limite) : out;
}

// ── Escritura ───────────────────────────────────────────────────────────────

/** Valores de los campos extra de una fila, tal y como llegan del editor. */
export type Campos = Record<string, string>;

function limpio(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Traduce los campos del editor a columnas. Los `checkbox` se guardan como
 * booleano porque su columna lo es (`personaje_raza.es_mixta`).
 */
function valoresDeCampos(rel: RelacionDef, campos: Campos): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of rel.campos) {
    out[c.name] = c.tipo === "checkbox" ? campos[c.name] === "true" : limpio(campos[c.name]);
  }
  return out;
}

/** Siguiente posición libre dentro del bloque, para que lo nuevo entre al final. */
async function siguienteOrden(def: NonNullable<ReturnType<typeof tablaDe>>, colPropia: string, ownerId: number): Promise<number> {
  if (!def.orden) return 0;
  const c = cols(def.tabla);
  const [fila] = await db
    .select({ max: sql<number | null>`max(${c[def.orden]})` })
    .from(def.tabla)
    .where(eq(c[colPropia], ownerId));
  return (fila?.max ?? -1) + 1;
}

export interface DestinoNuevo {
  id: number;
  /** Sólo hace falta en las relaciones comodín, donde el tipo varía por fila. */
  tipo?: string;
}

/**
 * Crea un vínculo. Si la relación es recíproca, escribe también la fila inversa
 * con el término opuesto: marcar A como "Depredador" de B deja a B como "Presa"
 * de A sin que haya que editar la otra ficha.
 */
export async function crearVinculo(
  relId: string,
  lado: "a" | "b",
  ownerId: number,
  destino: DestinoNuevo,
  campos: Campos = {},
): Promise<void> {
  const rel = getRelacion(relId);
  if (!rel || !ownerId || !destino.id) return;

  if (rel.medio === "referencia") {
    await crearReferencia(rel, lado, ownerId, destino.id);
    return;
  }

  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id);
    if (!def) return;
    const colPropia = lado === "a" ? def.colA : def.colB;
    const colOtra = lado === "a" ? def.colB : def.colA;
    const fila: Record<string, unknown> = {
      [colPropia]: ownerId,
      [colOtra]: destino.id,
      ...valoresDeCampos(rel, campos),
    };
    if (def.filtroA) fila[def.filtroA.col] = def.filtroA.valor;
    if (def.orden) fila[def.orden] = await siguienteOrden(def, colPropia, ownerId);
    await db.insert(def.tabla).values(fila as never);
  } else {
    const miEntidad = lado === "a" ? rel.a.entidad : rel.b.entidad;
    const suEntidad = destino.tipo ?? objetivoDe(rel, lado);
    await db.insert(s.vinculo).values(
      lado === "a"
        ? { origenTipo: miEntidad, origenId: ownerId, destinoTipo: suEntidad, destinoId: destino.id, relacion: rel.relacion ?? rel.id, tipo: limpio(campos.tipo), nota: limpio(campos.nota) }
        : { origenTipo: suEntidad, origenId: destino.id, destinoTipo: miEntidad, destinoId: ownerId, relacion: rel.relacion ?? rel.id, tipo: limpio(campos.tipo), nota: limpio(campos.nota) },
    );
  }

  if (rel.reciproca) await crearReflejo(rel, lado, ownerId, destino, campos);

  if (rel.id === "personaje_objeto") {
    const [personajeId, artefactoId] = lado === "a" ? [ownerId, destino.id] : [destino.id, ownerId];
    await sincronizarPropietario(artefactoId, personajeId);
  }
}

/** Escribe la fila inversa de una relación recíproca, con el término opuesto. */
async function crearReflejo(
  rel: RelacionDef,
  lado: "a" | "b",
  ownerId: number,
  destino: DestinoNuevo,
  campos: Campos,
): Promise<void> {
  if (!rel.reciproca) return;
  const inverso = terminoInverso(rel, campos[rel.reciproca.campo]);
  const camposReflejo: Campos = { ...campos };
  if (inverso) camposReflejo[rel.reciproca.campo] = inverso;

  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id);
    if (!def) return;
    const colPropia = lado === "a" ? def.colA : def.colB;
    const colOtra = lado === "a" ? def.colB : def.colA;
    const fila: Record<string, unknown> = {
      // Los extremos se cruzan: el destino pasa a ser el dueño.
      [colPropia]: destino.id,
      [colOtra]: ownerId,
      ...valoresDeCampos(rel, camposReflejo),
    };
    if (def.filtroA) fila[def.filtroA.col] = def.filtroA.valor;
    if (def.orden) fila[def.orden] = await siguienteOrden(def, colPropia, destino.id);
    await db.insert(def.tabla).values(fila as never);
    return;
  }
  const entidad = rel.a.entidad;
  await db.insert(s.vinculo).values({
    origenTipo: entidad,
    origenId: destino.id,
    destinoTipo: entidad,
    destinoId: ownerId,
    relacion: rel.relacion ?? rel.id,
    tipo: limpio(camposReflejo.tipo),
    nota: limpio(camposReflejo.nota),
  });
}

/**
 * Localiza la fila inversa de una recíproca. Con duplicados permitidos la
 * pareja no es única, así que se coge la primera coincidencia: es la que se
 * creó junto a esta y la que el usuario espera ver desaparecer o cambiar.
 */
async function idDelReflejo(
  rel: RelacionDef,
  ownerId: number,
  destinoId: number,
  termino: string | null,
): Promise<number | null> {
  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id);
    if (!def || !rel.reciproca) return null;
    const c = cols(def.tabla);
    const filtros: SQL[] = [eq(c[def.colA], destinoId), eq(c[def.colB], ownerId)];
    if (termino) filtros.push(eq(c[rel.reciproca.campo], termino));
    const [fila] = await db
      .select({ id: c[def.pk] })
      .from(def.tabla)
      .where(and(...filtros))
      .limit(1);
    return (fila?.id as number) ?? null;
  }
  const entidad = rel.a.entidad;
  const filtros: SQL[] = [
    eq(s.vinculo.relacion, rel.relacion ?? rel.id),
    eq(s.vinculo.origenTipo, entidad),
    eq(s.vinculo.origenId, destinoId),
    eq(s.vinculo.destinoTipo, entidad),
    eq(s.vinculo.destinoId, ownerId),
  ];
  if (termino) filtros.push(eq(s.vinculo.tipo, termino));
  const [fila] = await db.select({ id: s.vinculo.id }).from(s.vinculo).where(and(...filtros)).limit(1);
  return fila?.id ?? null;
}

/** Lee los dos extremos y el término de una fila, para poder reflejarla. */
async function extremosDe(
  rel: RelacionDef,
  filaId: number,
): Promise<{ ownerId: number; destinoId: number; termino: string | null } | null> {
  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id);
    if (!def) return null;
    const c = cols(def.tabla);
    const [fila] = (await db.select().from(def.tabla).where(eq(c[def.pk], filaId)).limit(1)) as unknown as Record<string, unknown>[];
    if (!fila) return null;
    return {
      ownerId: fila[def.colA] as number,
      destinoId: fila[def.colB] as number,
      termino: rel.reciproca ? ((fila[rel.reciproca.campo] as string) ?? null) : null,
    };
  }
  const [fila] = await db.select().from(s.vinculo).where(eq(s.vinculo.id, filaId)).limit(1);
  if (!fila) return null;
  return { ownerId: fila.origenId, destinoId: fila.destinoId, termino: fila.tipo ?? null };
}

/** Cambia los campos extra de un vínculo, y del reflejo si lo tiene. */
export async function actualizarVinculo(relId: string, filaId: number, campos: Campos): Promise<void> {
  const rel = getRelacion(relId);
  if (!rel || !filaId) return;
  // Una referencia simple no tiene campos extra: sólo apunta.
  if (rel.medio === "referencia") return;

  const antes = rel.reciproca ? await extremosDe(rel, filaId) : null;

  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id);
    if (!def) return;
    const c = cols(def.tabla);
    await db.update(def.tabla).set(valoresDeCampos(rel, campos) as never).where(eq(c[def.pk], filaId));
  } else {
    await db
      .update(s.vinculo)
      .set({ tipo: limpio(campos.tipo), nota: limpio(campos.nota) })
      .where(eq(s.vinculo.id, filaId));
  }

  if (!rel.reciproca || !antes) return;
  const reflejoId = await idDelReflejo(rel, antes.ownerId, antes.destinoId, terminoInverso(rel, antes.termino));
  if (!reflejoId) return;
  const inverso = terminoInverso(rel, campos[rel.reciproca.campo]);
  const camposReflejo: Campos = { ...campos };
  if (inverso) camposReflejo[rel.reciproca.campo] = inverso;
  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id)!;
    const c = cols(def.tabla);
    await db.update(def.tabla).set(valoresDeCampos(rel, camposReflejo) as never).where(eq(c[def.pk], reflejoId));
  } else {
    await db
      .update(s.vinculo)
      .set({ tipo: limpio(camposReflejo.tipo), nota: limpio(camposReflejo.nota) })
      .where(eq(s.vinculo.id, reflejoId));
  }
}

/** Borra un vínculo y, si es recíproco, su reflejo. */
export async function borrarVinculo(relId: string, filaId: number): Promise<void> {
  const rel = getRelacion(relId);
  if (!rel || !filaId) return;
  if (rel.medio === "referencia") {
    await borrarReferencia(rel, filaId);
    return;
  }
  const antes = rel.reciproca ? await extremosDe(rel, filaId) : null;

  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id);
    if (!def) return;
    const c = cols(def.tabla);
    await db.delete(def.tabla).where(eq(c[def.pk], filaId));
  } else {
    await db.delete(s.vinculo).where(eq(s.vinculo.id, filaId));
  }

  if (!rel.reciproca || !antes) return;
  const reflejoId = await idDelReflejo(rel, antes.ownerId, antes.destinoId, terminoInverso(rel, antes.termino));
  if (!reflejoId) return;
  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id)!;
    const c = cols(def.tabla);
    await db.delete(def.tabla).where(eq(c[def.pk], reflejoId));
  } else {
    await db.delete(s.vinculo).where(eq(s.vinculo.id, reflejoId));
  }
}

/** Reordena un bloque ordenable en una sola sentencia. */
export async function reordenarVinculos(relId: string, filaIds: number[]): Promise<void> {
  const rel = getRelacion(relId);
  if (!rel || filaIds.length === 0) return;
  const pares = filaIds.map((id, i) => sql`(${id}::int, ${i}::int)`);
  if (rel.medio === "tabla") {
    const def = tablaDe(rel.id);
    if (!def?.orden) return;
    const tabla = sql.identifier(getTableName(def.tabla));
    const colOrden = sql.identifier(nombreColumna(def.tabla, def.orden));
    const colPk = sql.identifier(nombreColumna(def.tabla, def.pk));
    await db.execute(sql`
      update ${tabla} t set ${colOrden} = v.orden
      from (values ${sql.join(pares, sql`, `)}) as v(id, orden)
      where t.${colPk} = v.id
    `);
    return;
  }
  await db.execute(sql`
    update vinculo t set orden = v.orden
    from (values ${sql.join(pares, sql`, `)}) as v(id, orden)
    where t.id = v.id
  `);
}

/** Nombre real en SQL de una columna, desde su clave en el schema. */
function nombreColumna(tabla: PgTable, clave: string): string {
  return cols(tabla)[clave].name;
}

/**
 * Cuántos vínculos tiene cada bloque de una ficha. Se usa para pintar el panel
 * de conexiones sin cargar todas las filas, y para marcar en el admin los
 * bloques vacíos, que en público simplemente no se muestran.
 */
export async function contarBloques(
  entidad: string,
  ownerId: number,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!ownerId) return out;

  await Promise.all(
    bloquesDe(entidad).map(async (b) => {
      const clave = `${b.relId}:${b.lado}`;
      const rel = getRelacion(b.relId);
      if (!rel) return;

      if (rel.medio === "referencia") {
        // Barato y exacto: leer la referencia devuelve como mucho unas pocas filas.
        out[clave] = (await leerDeReferencia(rel, b.lado, ownerId, {})).length;
        return;
      }

      if (rel.medio === "tabla") {
        const def = tablaDe(rel.id);
        if (!def) return;
        const c = cols(def.tabla);
        const colPropia = b.lado === "a" ? def.colA : def.colB;
        const filtros: SQL[] = [eq(c[colPropia], ownerId)];
        if (def.filtroA) filtros.push(eq(c[def.filtroA.col], def.filtroA.valor));
        const [fila] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(def.tabla)
          .where(and(...filtros));
        out[clave] = fila?.n ?? 0;
        return;
      }

      const propioTipo = b.lado === "a" ? s.vinculo.origenTipo : s.vinculo.destinoTipo;
      const propioId = b.lado === "a" ? s.vinculo.origenId : s.vinculo.destinoId;
      const miEntidad = b.lado === "a" ? rel.a.entidad : rel.b.entidad;
      const filtros: SQL[] = [eq(s.vinculo.relacion, rel.relacion ?? rel.id), eq(propioId, ownerId)];
      if (miEntidad !== CUALQUIERA) filtros.push(eq(propioTipo, miEntidad));
      const [fila] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(s.vinculo)
        .where(and(...filtros));
      out[clave] = fila?.n ?? 0;
    }),
  );
  return out;
}

/**
 * Copia todas las conexiones de una ficha a otra de la misma entidad. Lo usa la
 * duplicación: un clon sin sus vínculos obligaría a rehacer a mano justo el
 * trabajo que este sistema existe para ahorrar.
 *
 * No se reflejan las recíprocas: la copia se queda con los vínculos que salen
 * de ella, sin tocar las fichas del otro extremo.
 */
export async function clonarVinculos(entidad: string, origenId: number, destinoId: number): Promise<number> {
  if (!origenId || !destinoId || origenId === destinoId) return 0;
  let copiados = 0;

  for (const b of bloquesDe(entidad)) {
    const rel = getRelacion(b.relId);
    if (!rel) continue;

    if (rel.medio === "referencia") {
      // Sólo se copia desde el lado que posee la columna: al revés habría que
      // reapuntar fichas ajenas al clon, y eso las desconectaría del original.
      if (b.lado !== "a") continue;
      const filas = await leerDeReferencia(rel, "a", origenId, {});
      if (filas[0]) { await crearReferencia(rel, "a", destinoId, filas[0].objetivoId); copiados++; }
      continue;
    }

    if (rel.medio === "tabla") {
      const def = tablaDe(rel.id);
      if (!def) continue;
      const c = cols(def.tabla);
      const colPropia = b.lado === "a" ? def.colA : def.colB;
      const filtros: SQL[] = [eq(c[colPropia], origenId)];
      if (def.filtroA) filtros.push(eq(c[def.filtroA.col], def.filtroA.valor));

      const filas = (await db.select().from(def.tabla).where(and(...filtros))) as unknown as Record<string, unknown>[];
      if (filas.length === 0) continue;
      await db.insert(def.tabla).values(
        filas.map((f) => ({ ...f, [def.pk]: undefined, [colPropia]: destinoId })) as never,
      );
      copiados += filas.length;
      continue;
    }

    const propioTipo = b.lado === "a" ? s.vinculo.origenTipo : s.vinculo.destinoTipo;
    const propioId = b.lado === "a" ? s.vinculo.origenId : s.vinculo.destinoId;
    const miEntidad = b.lado === "a" ? rel.a.entidad : rel.b.entidad;
    const filtros: SQL[] = [eq(s.vinculo.relacion, rel.relacion ?? rel.id), eq(propioId, origenId)];
    if (miEntidad !== CUALQUIERA) filtros.push(eq(propioTipo, miEntidad));

    const filas = await db.select().from(s.vinculo).where(and(...filtros));
    if (filas.length === 0) continue;
    await db.insert(s.vinculo).values(
      filas.map((f) => ({
        origenTipo: f.origenTipo,
        origenId: b.lado === "a" ? destinoId : f.origenId,
        destinoTipo: f.destinoTipo,
        destinoId: b.lado === "a" ? f.destinoId : destinoId,
        relacion: f.relacion,
        tipo: f.tipo,
        nota: f.nota,
        orden: f.orden,
      })),
    );
    copiados += filas.length;
  }
  return copiados;
}

/**
 * Borra los vínculos genéricos que apuntan a una ficha que ya no existe. La
 * tabla `vinculo` no puede llevar clave foránea porque su destino es
 * polimórfico, así que la integridad se mantiene por código, igual que ya se
 * hacía con la galería.
 */
export async function purgarVinculosHuerfanos(): Promise<number> {
  const filas = await db
    .select({ id: s.vinculo.id, tipo: s.vinculo.origenTipo, ref: s.vinculo.origenId })
    .from(s.vinculo)
    .union(
      db
        .select({ id: s.vinculo.id, tipo: s.vinculo.destinoTipo, ref: s.vinculo.destinoId })
        .from(s.vinculo),
    );

  const porTipo = new Map<string, Set<number>>();
  for (const f of filas) {
    if (!porTipo.has(f.tipo)) porTipo.set(f.tipo, new Set());
    porTipo.get(f.tipo)!.add(f.ref);
  }

  const vivos = new Map<string, Set<number>>();
  await Promise.all(
    [...porTipo].map(async ([tipo, ids]) => {
      const e = await etiquetas(tipo, [...ids]);
      vivos.set(tipo, new Set(e.keys()));
    }),
  );

  const muertos = filas
    .filter((f) => !vivos.get(f.tipo)?.has(f.ref))
    .map((f) => f.id);
  if (muertos.length === 0) return 0;

  await db.delete(s.vinculo).where(inArray(s.vinculo.id, [...new Set(muertos)]));
  return new Set(muertos).size;
}

/**
 * Única excepción del sistema, y está aquí a propósito para que se vea.
 *
 * Un artefacto tiene dos datos distintos: `propietario_id`, que es su dueño
 * actual, y `personaje_objeto`, la lista de quienes lo han portado. Son cosas
 * diferentes y por eso se mantienen separadas, pero hasta ahora se desincronizaban:
 * vincular un artefacto ya existente desde la ficha de un personaje no tocaba el
 * propietario, así que un objeto podía tener portador y seguir sin dueño.
 *
 * La regla es conservadora: si el artefacto no tiene dueño, el portador nuevo lo
 * adopta. Nunca se le quita el dueño a un artefacto que ya lo tiene, porque eso
 * sería decidir por el autor quién ha perdido la espada.
 */
async function sincronizarPropietario(artefactoId: number, personajeId: number): Promise<void> {
  await db
    .update(s.armasArtefactos)
    .set({ propietarioId: personajeId })
    .where(and(eq(s.armasArtefactos.id, artefactoId), isNull(s.armasArtefactos.propietarioId)));
}

// ── Referencias simples (una columna de clave foránea) ──────────────────────

/** Tabla y columna que sostienen una referencia simple. */
function refDe(rel: RelacionDef): { tabla: PgTable; columna: string; c: Cols } | null {
  const info = infoDe(rel.a.entidad);
  if (!info || !rel.columna) return null;
  const c = cols(info.tabla);
  if (!c[rel.columna]) return null;
  return { tabla: info.tabla, columna: rel.columna, c };
}

async function leerDeReferencia(
  rel: RelacionDef,
  lado: "a" | "b",
  ownerId: number,
  opts: OpcionesLectura,
): Promise<FilaVinculo[]> {
  const ref = refDe(rel);
  if (!ref) return [];

  // La fila que se edita es siempre la que POSEE la columna, mire desde donde se
  // mire; su id es el que usan borrar y actualizar.
  if (lado === "a") {
    const [fila] = (await db
      .select({ destino: ref.c[ref.columna] })
      .from(ref.tabla)
      .where(eq(ref.c.id, ownerId))
      .limit(1)) as unknown as { destino: number | null }[];
    const destino = fila?.destino ?? null;
    if (destino == null) return [];
    const e = (await etiquetas(rel.b.entidad, [destino])).get(destino);
    if (!e || (opts.publico && !visible(e))) return [];
    return [{ id: ownerId, objetivoId: destino, label: e.label, imagenUrl: e.imagenUrl, detalle: e.detalle, estado: e.estado, campos: {} }];
  }

  const filtros: SQL[] = [eq(ref.c[ref.columna], ownerId)];
  const infoA = infoDe(rel.a.entidad);
  if (opts.publico && infoA?.estado) filtros.push(eq(ref.c.estadoPublicacion, "publicado"));
  if (opts.publico && infoA?.papelera) filtros.push(isNull(ref.c.eliminadoEn));

  const filas = (await db
    .select({ id: ref.c.id })
    .from(ref.tabla)
    .where(and(...filtros))
    .limit(opts.limite ?? 100)) as unknown as { id: number }[];
  if (filas.length === 0) return [];

  const etiq = await etiquetas(rel.a.entidad, filas.map((f) => f.id));
  const out: FilaVinculo[] = [];
  for (const f of filas) {
    const e = etiq.get(f.id);
    if (!e) continue;
    out.push({ id: f.id, objetivoId: f.id, label: e.label, imagenUrl: e.imagenUrl, detalle: e.detalle, estado: e.estado, campos: {} });
  }
  return out;
}

/**
 * Apunta la clave foránea. Desde el lado A se escribe en la propia ficha; desde
 * el reverso se escribe en la OTRA, que es lo que hace editable el espejo.
 */
async function crearReferencia(
  rel: RelacionDef,
  lado: "a" | "b",
  ownerId: number,
  destinoId: number,
): Promise<void> {
  const ref = refDe(rel);
  if (!ref) return;
  const [filaId, valor] = lado === "a" ? [ownerId, destinoId] : [destinoId, ownerId];
  await db
    .update(ref.tabla)
    .set({ [ref.columna]: valor } as never)
    .where(eq(ref.c.id, filaId));
}

/** Deja la referencia en nulo. `filaId` es la fila que posee la columna. */
async function borrarReferencia(rel: RelacionDef, filaId: number): Promise<void> {
  const ref = refDe(rel);
  if (!ref) return;
  await db
    .update(ref.tabla)
    .set({ [ref.columna]: null } as never)
    .where(eq(ref.c.id, filaId));
}
