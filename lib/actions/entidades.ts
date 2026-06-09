"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assertAdmin } from "@/lib/actions/auth";
import { notificarNuevaPublicacion } from "@/lib/discord";
import { getEntidadConfig } from "@/lib/admin/fields";
import { getEntidadTable } from "@/lib/admin/tables";
import { buildEntidadSchema } from "@/lib/validation/entidad";

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
  revalidatePath(`/admin/${key}/papelera`);
  revalidatePath(config.route);
}
