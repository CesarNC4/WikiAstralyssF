"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db/client";
import { assertAdmin } from "@/lib/actions/auth";
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

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const created = !id;

  let savedId: number;
  try {
    if (id) {
      const [existing] = await db
        .select({ ppv: c.publicadoPrimeraVezEn })
        .from(table)
        .where(eq(c.id, id))
        .limit(1);
      const publicadoPrimeraVezEn =
        data.estadoPublicacion === "publicado" && !existing?.ppv ? new Date() : existing?.ppv ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(table).set({ ...data, publicadoPrimeraVezEn } as any).where(eq(c.id, id));
      savedId = id;
    } else {
      const publicadoPrimeraVezEn = data.estadoPublicacion === "publicado" ? new Date() : null;
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

  revalidar(config.route, savedId);
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
  const [existing] = await db.select({ ppv: c.publicadoPrimeraVezEn }).from(table).where(eq(c.id, id)).limit(1);
  const publicadoPrimeraVezEn =
    estado === "publicado" && !existing?.ppv ? new Date() : existing?.ppv ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.update(table).set({ estadoPublicacion: estado, publicadoPrimeraVezEn } as any).where(eq(c.id, id));
  revalidar(config.route, id);
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
