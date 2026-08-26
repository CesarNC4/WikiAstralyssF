"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, getTableColumns, getTableName, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assertAdmin } from "@/lib/actions/auth";
import { notificarNuevaPublicacion } from "@/lib/discord";
import { getEntidadConfig } from "@/lib/admin/fields";
import { getEntidadTable } from "@/lib/admin/tables";
import { REL_TABLES } from "@/lib/admin/relacionesTables";
import { clonarVinculos } from "@/lib/relaciones/consultas";
import { entidadMedia } from "@/db/schema/media";
import { buildEntidadSchema } from "@/lib/validation/entidad";
import { purgarEnSegundoPlano } from "@/lib/media/purga";

export interface EntidadFormState {
  ok: boolean;
  id?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cols = Record<string, any>;

function resolve(key: string) {
  const config = getEntidadConfig(key);
  const table = getEntidadTable(key);
  if (!config || !table) throw new Error(`Entidad no registrada: ${key}`);
  return { config, table, c: getTableColumns(table) as Cols };
}

function revalidar(route: string, id?: number) {
  revalidatePath(route);
  if (id) revalidatePath(`${route}/${id}`);
  revalidatePath("/");
}

export async function guardarEntidad(
  _prev: EntidadFormState | undefined,
  formData: FormData,
): Promise<EntidadFormState> {
  await assertAdmin();
  const key = String(formData.get("entidad") ?? "");
  let resolved;
  try {
    resolved = resolve(key);
  } catch {
    return { ok: false, error: "Entidad no válida." };
  }
  const { config, table, c } = resolved;

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Payload inválido." };
  }

  const parsed = buildEntidadSchema(config).safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }
  const data = parsed.data as Record<string, unknown>;

  // Los asset_id no están declarados en el schema Drizzle de las entidades
  // genéricas; se extraen y se escriben aparte con SQL directo (la columna ya
  // existe en la BD). Así media_assets queda enlazado para blurhash/alt futuros.
  const imagenAssetId = (data.imagenAssetId as number | null | undefined) ?? null;
  const bannerAssetId = (data.bannerAssetId as number | null | undefined) ?? null;
  delete data.imagenAssetId;
  delete data.bannerAssetId;

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const created = !id;

  let savedId: number;
  let notificar = false;
  try {
    if (id) {
      const [existing] = await db
        .select({ ppv: c.publicadoPrimeraVezEn })
        .from(table)
        .where(eq(c.id, id))
        .limit(1);
      notificar = data.estadoPublicacion === "publicado" && !existing?.ppv;
      const publicadoPrimeraVezEn = notificar ? new Date() : existing?.ppv ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(table).set({ ...data, publicadoPrimeraVezEn } as any).where(eq(c.id, id));
      savedId = id;
    } else {
      notificar = data.estadoPublicacion === "publicado";
      const publicadoPrimeraVezEn = notificar ? new Date() : null;
      const [row] = await db
        .insert(table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .values({ ...data, publicadoPrimeraVezEn } as any)
        .returning({ id: c.id });
      savedId = row.id as number;
    }
  } catch (e) {
    console.error("[guardarEntidad]", key, e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  // Enlace de assets (columna ya provisionada en BD; ver backfill-media).
  // Solo se escribe si hay asset nuevo, o se limpia si se quitó la imagen
  // (url null); así una edición que no toca la imagen no desenlaza el asset.
  try {
    const tn = getTableName(table);
    if (config.hasImage && (imagenAssetId != null || data.imagenUrl == null)) {
      await db.execute(sql`update ${sql.identifier(tn)} set imagen_asset_id = ${imagenAssetId} where id = ${savedId}`);
    }
    if (config.hasBanner && (bannerAssetId != null || data.bannerUrl == null)) {
      await db.execute(sql`update ${sql.identifier(tn)} set banner_asset_id = ${bannerAssetId} where id = ${savedId}`);
    }
  } catch (e) {
    console.error("[guardarEntidad] asset link", key, e);
  }

  await purgarEnSegundoPlano();
  revalidar(config.route, savedId);
  if (notificar) {
    await notificarNuevaPublicacion({
      tipo: key,
      idOrSlug: savedId,
      nombre: String(data[config.nameField] ?? config.singular),
      descripcion: (data.subtitulo ?? data.descripcion ?? data.titulo) as string | null | undefined,
      imagenUrl: data.imagenUrl as string | null | undefined,
    });
  }
  if (created) redirect(`/admin/${key}/${savedId}/editar`);
  return { ok: true, id: savedId };
}

export async function cambiarEstadoEntidad(
  key: string,
  id: number,
  estado: "borrador" | "publicado" | "oculto",
): Promise<void> {
  await assertAdmin();
  const { config, table, c } = resolve(key);
  // Selecciona, además de ppv, las columnas disponibles para el embed de Discord.
  const sel: Cols = { ppv: c.publicadoPrimeraVezEn, nombre: c[config.nameField] };
  if (c.subtitulo) sel.subtitulo = c.subtitulo;
  if (c.descripcion) sel.descripcion = c.descripcion;
  if (c.titulo) sel.titulo = c.titulo;
  if (c.imagenUrl) sel.imagenUrl = c.imagenUrl;
  const [existing] = await db.select(sel).from(table).where(eq(c.id, id)).limit(1);
  const primeraVez = estado === "publicado" && !existing?.ppv;
  const publicadoPrimeraVezEn = primeraVez ? new Date() : existing?.ppv ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.update(table).set({ estadoPublicacion: estado, publicadoPrimeraVezEn } as any).where(eq(c.id, id));
  revalidar(config.route, id);
  if (primeraVez && existing) {
    await notificarNuevaPublicacion({
      tipo: key,
      idOrSlug: id,
      nombre: String(existing.nombre ?? config.singular),
      descripcion: existing.subtitulo ?? existing.descripcion ?? existing.titulo ?? null,
      imagenUrl: existing.imagenUrl ?? null,
    });
  }
}

/**
 * Aplica una acción a varias fichas de golpe desde la tabla del admin.
 *
 * Usa un número FIJO de consultas (tres como mucho) en vez de una por ficha:
 * seleccionar el estado previo, actualizar el lote y sellar la primera
 * publicación de los que la estrenan.
 *
 * Respeta la regla de `cambiarEstadoEntidad`: publicar por primera vez sella
 * `publicado_primera_vez_en` y dispara el aviso a Discord, y sólo la primera.
 * Devuelve cuántas fichas se tocaron.
 */
export async function accionEnLoteEntidad(
  key: string,
  ids: number[],
  accion: "publicado" | "oculto" | "borrador" | "papelera",
): Promise<number> {
  await assertAdmin();
  if (ids.length === 0) return 0;
  const { config, table, c } = resolve(key);

  const revalidarLote = () => {
    revalidar(config.route);
    for (const id of ids) revalidatePath(`${config.route}/${id}`);
  };

  if (accion === "papelera") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.update(table).set({ eliminadoEn: new Date() } as any).where(inArray(c.id, ids));
    revalidarLote();
    return ids.length;
  }

  const sel: Cols = { id: c.id, ppv: c.publicadoPrimeraVezEn, nombre: c[config.nameField] };
  if (c.subtitulo) sel.subtitulo = c.subtitulo;
  if (c.descripcion) sel.descripcion = c.descripcion;
  if (c.titulo) sel.titulo = c.titulo;
  if (c.imagenUrl) sel.imagenUrl = c.imagenUrl;
  const filas = await db.select(sel).from(table).where(inArray(c.id, ids));
  const estrenan = accion === "publicado" ? filas.filter((f) => !f.ppv) : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.update(table).set({ estadoPublicacion: accion } as any).where(inArray(c.id, ids));
  if (estrenan.length > 0) {
    await db
      .update(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ publicadoPrimeraVezEn: new Date() } as any)
      .where(inArray(c.id, estrenan.map((f) => Number(f.id))));
  }

  revalidarLote();
  for (const f of estrenan) {
    await notificarNuevaPublicacion({
      tipo: key,
      idOrSlug: Number(f.id),
      nombre: String(f.nombre ?? config.singular),
      descripcion: f.subtitulo ?? f.descripcion ?? f.titulo ?? null,
      imagenUrl: f.imagenUrl ?? null,
    });
  }
  return ids.length;
}

/**
 * Clona una ficha completa como borrador nuevo y devuelve su id.
 *
 * Copia la fila, su galería (`entidad_media`) y todos sus bloques de relación
 * registrados en `REL_TABLES`. Las imágenes NO se duplican en Cloudinary: el
 * clon apunta a los mismos assets, que es lo correcto — son compartidos y la
 * purga de huérfanos cuenta referencias, así que ninguno se borrará por tener
 * dos dueños.
 *
 * El clon nace siempre en `borrador` y sin `publicado_primera_vez_en`, de modo
 * que al publicarlo se comporte como una ficha nueva (incluido el aviso a
 * Discord) y no herede el historial del original.
 *
 * Ninguna tabla de `ENTIDAD_TABLES` tiene `slug` hoy, así que no hay unicidad
 * que resolver al clonar. Si alguna la gana, habrá que derivar uno libre aquí.
 */
export async function duplicarEntidad(key: string, id: number): Promise<number> {
  await assertAdmin();
  const { config, table, c } = resolve(key);

  const [original] = await db.select().from(table).where(eq(c.id, id)).limit(1);
  if (!original) throw new Error("La ficha que intentas duplicar ya no existe.");

  const copia: Cols = { ...original };
  delete copia.id;
  if ("estadoPublicacion" in copia) copia.estadoPublicacion = "borrador";
  if ("publicadoPrimeraVezEn" in copia) copia.publicadoPrimeraVezEn = null;
  if ("eliminadoEn" in copia) copia.eliminadoEn = null;
  if ("creadoEn" in copia) copia.creadoEn = new Date();
  if ("actualizadoEn" in copia) copia.actualizadoEn = new Date();
  copia[config.nameField] = `${original[config.nameField] ?? config.singular} (copia)`;

  const [creada] = await db.insert(table).values(copia).returning({ id: c.id });
  const nuevoId = Number(creada.id);

  // Galería: se copian los vínculos, no los archivos.
  const galeria = await db
    .select()
    .from(entidadMedia)
    .where(and(eq(entidadMedia.entidadTipo, key), eq(entidadMedia.entidadId, id)));
  if (galeria.length > 0) {
    await db.insert(entidadMedia).values(
      galeria.map((g) => ({ ...g, id: undefined, entidadId: nuevoId })),
    );
  }

  // Sub-listas de texto propias de la ficha (los usos de un mineral).
  for (const [clave, def] of Object.entries(REL_TABLES)) {
    if (!clave.startsWith(`${key}:`)) continue;
    const rc = getTableColumns(def.table) as Cols;
    const filas = await db.select().from(def.table).where(eq(rc[def.ownerCol], id));
    if (filas.length === 0) continue;
    await db
      .insert(def.table)
      .values(filas.map((f) => ({ ...(f as Cols), id: undefined, [def.ownerCol]: nuevoId })));
  }

  // Conexiones con otras fichas. Sin esto, duplicar obligaría a rehacer a mano
  // justo el trabajo que el sistema de relaciones existe para ahorrar.
  await clonarVinculos(key, id, nuevoId);

  revalidar(config.route);
  return nuevoId;
}

export async function moverEntidadAPapelera(key: string, id: number): Promise<void> {
  await assertAdmin();
  const { config, table, c } = resolve(key);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.update(table).set({ eliminadoEn: new Date() } as any).where(eq(c.id, id));
  revalidar(config.route, id);
}

export async function restaurarEntidad(key: string, id: number): Promise<void> {
  await assertAdmin();
  const { config, table, c } = resolve(key);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.update(table).set({ eliminadoEn: null } as any).where(eq(c.id, id));
  revalidar(config.route, id);
}

export async function eliminarEntidadDefinitivo(key: string, id: number): Promise<void> {
  await assertAdmin();
  const { config, table, c } = resolve(key);
  await db.delete(table).where(eq(c.id, id));
  await purgarEnSegundoPlano();
  revalidatePath(`/admin/${key}/papelera`);
  revalidatePath(config.route);
}
