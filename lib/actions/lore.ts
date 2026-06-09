"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { notificarNuevaPublicacion } from "@/lib/discord";
import { loreSchema } from "@/lib/validation/lore";
import { slugify } from "@/lib/utils";

export interface LoreFormState {
  ok: boolean;
  id?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidar(slug: string, id?: number) {
  revalidatePath("/lore");
  if (slug) revalidatePath(`/lore/${slug}`);
  revalidatePath("/");
  if (id) revalidatePath(`/admin/lore/${id}/editar`);
}

export async function guardarLore(
  _prev: LoreFormState | undefined,
  formData: FormData,
): Promise<LoreFormState> {
  await assertAdmin();

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Payload inválido." };
  }

  // Autogenerar slug desde el título si viene vacío.
  if ((!json.slug || String(json.slug).trim() === "") && json.titulo) {
    json.slug = slugify(String(json.titulo));
  }

  const parsed = loreSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }
  const data = parsed.data;

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const created = !id;

  const base = {
    titulo: data.titulo,
    slug: data.slug,
    subtitulo: data.subtitulo,
    introduccion: data.introduccion,
    imagenUrl: data.imagenUrl,
    bannerUrl: data.bannerUrl,
    estadoPublicacion: data.estadoPublicacion,
  };

  let savedId: number;
  let notificar = false;
  try {
    savedId = await db.transaction(async (tx) => {
      let pid: number;
      if (id) {
        const [existing] = await tx.select({ ppv: s.paginasLore.publicadoPrimeraVezEn }).from(s.paginasLore).where(eq(s.paginasLore.id, id)).limit(1);
        notificar = data.estadoPublicacion === "publicado" && !existing?.ppv;
        const publicadoPrimeraVezEn = notificar ? new Date() : existing?.ppv ?? null;
        await tx.update(s.paginasLore).set({ ...base, publicadoPrimeraVezEn }).where(eq(s.paginasLore.id, id));
        pid = id;
      } else {
        notificar = data.estadoPublicacion === "publicado";
        const publicadoPrimeraVezEn = notificar ? new Date() : null;
        const [row] = await tx.insert(s.paginasLore).values({ ...base, publicadoPrimeraVezEn }).returning({ id: s.paginasLore.id });
        pid = row.id;
      }

      // Secciones: delete + re-insert con orden = índice.
      await tx.delete(s.paginaSecciones).where(eq(s.paginaSecciones.paginaId, pid));
      if (data.secciones.length) {
        await tx.insert(s.paginaSecciones).values(
          data.secciones.map((sec, i) => ({
            paginaId: pid,
            orden: i,
            titulo: sec.titulo,
            contenido: sec.contenido,
            tipo: sec.tipo,
            estadoPublicacion: sec.estadoPublicacion,
          })),
        );
      }
      return pid;
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("paginas_lore_slug")) {
      return { ok: false, error: "Ese slug ya está en uso por otra página.", fieldErrors: { slug: "Slug duplicado" } };
    }
    console.error("[guardarLore]", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  revalidar(data.slug, savedId);
  if (notificar) {
    await notificarNuevaPublicacion({
      tipo: "lore",
      idOrSlug: data.slug,
      nombre: data.titulo,
      descripcion: data.subtitulo ?? data.introduccion,
      imagenUrl: data.imagenUrl,
    });
  }
  if (created) redirect(`/admin/lore/${savedId}/editar`);
  return { ok: true, id: savedId };
}

async function slugDe(id: number): Promise<string> {
  const [r] = await db.select({ slug: s.paginasLore.slug }).from(s.paginasLore).where(eq(s.paginasLore.id, id)).limit(1);
  return r?.slug ?? "";
}

export async function cambiarEstadoLore(id: number, estado: "borrador" | "publicado" | "oculto"): Promise<void> {
  await assertAdmin();
  const [existing] = await db
    .select({
      ppv: s.paginasLore.publicadoPrimeraVezEn,
      slug: s.paginasLore.slug,
      titulo: s.paginasLore.titulo,
      subtitulo: s.paginasLore.subtitulo,
      introduccion: s.paginasLore.introduccion,
      imagenUrl: s.paginasLore.imagenUrl,
    })
    .from(s.paginasLore)
    .where(eq(s.paginasLore.id, id))
    .limit(1);
  const primeraVez = estado === "publicado" && !existing?.ppv;
  const publicadoPrimeraVezEn = primeraVez ? new Date() : existing?.ppv ?? null;
  await db.update(s.paginasLore).set({ estadoPublicacion: estado, publicadoPrimeraVezEn }).where(eq(s.paginasLore.id, id));
  revalidar(existing?.slug ?? (await slugDe(id)), id);
  if (primeraVez && existing) {
    await notificarNuevaPublicacion({
      tipo: "lore",
      idOrSlug: existing.slug,
      nombre: existing.titulo ?? "Nueva página de lore",
      descripcion: existing.subtitulo ?? existing.introduccion,
      imagenUrl: existing.imagenUrl,
    });
  }
}

export async function moverLoreAPapelera(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.paginasLore).set({ eliminadoEn: new Date() }).where(eq(s.paginasLore.id, id));
  revalidar(await slugDe(id), id);
}

export async function restaurarLore(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.paginasLore).set({ eliminadoEn: null }).where(eq(s.paginasLore.id, id));
  revalidar(await slugDe(id), id);
}

export async function eliminarLoreDefinitivo(id: number): Promise<void> {
  await assertAdmin();
  await db.transaction(async (tx) => {
    await tx.delete(s.paginaSecciones).where(eq(s.paginaSecciones.paginaId, id));
    await tx.delete(s.paginasLore).where(eq(s.paginasLore.id, id));
  });
  revalidatePath("/admin/lore/papelera");
  revalidatePath("/lore");
}
