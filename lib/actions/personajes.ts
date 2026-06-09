"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { notificarNuevaPublicacion } from "@/lib/discord";
import { personajeSchema, type PersonajeInput } from "@/lib/validation/personaje";

function nombreCompleto(nombre: string, surname?: string | null): string {
  return [nombre, surname].filter(Boolean).join(" ").trim();
}

export interface PersonajeFormState {
  ok: boolean;
  id?: number;
  created?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidarPersonaje(id: number) {
  // revalidatePath es el mecanismo efectivo hoy (las queries públicas usan ISR por
  // tiempo, no cacheTag). Los revalidateTag quedan preparados por si se adoptan
  // tags con `use cache`/cacheTag más adelante; el 2º arg es el perfil de Next 16.
  revalidateTag(`personaje:${id}`, "max");
  revalidateTag("personajes:list", "max");
  revalidateTag("home", "max");
  revalidateTag("sitemap", "max");
  revalidatePath("/personajes");
  revalidatePath(`/personajes/${id}`);
  revalidatePath("/");
}

function scalars(data: PersonajeInput) {
  return {
    nombre: data.nombre,
    surname: data.surname,
    titulo: data.titulo,
    subtitulo: data.subtitulo,
    edad: data.edad,
    genero: data.genero,
    altura: data.altura,
    ocupacion: data.ocupacion,
    rangoAventurero: data.rangoAventurero,
    lugarNacimiento: data.lugarNacimiento,
    familia: data.familia,
    esInvocado: data.esInvocado ?? false,
    tipoInvocacion: data.tipoInvocacion,
    historia: data.historia,
    rasgosPersonalidad: data.rasgosPersonalidad,
    motivacion: data.motivacion,
    miedos: data.miedos,
    filosofia: data.filosofia,
    gustos: data.gustos,
    disgustos: data.disgustos,
    debilidades: data.debilidades,
    tipoMagiaPrincipal: data.tipoMagiaPrincipal,
    magiaSecundaria: data.magiaSecundaria,
    nivelDeConsciencia: data.nivelDeConsciencia,
    circuitoForte: data.circuitoForte,
    essentia: data.essentia,
    zenithra: data.zenithra,
    bendicion: data.bendicion,
    segundoDespertar: data.segundoDespertar,
    imagenAssetId: data.imagenAssetId,
    bannerAssetId: data.bannerAssetId,
    imagenUrl: data.imagenUrl,
    bannerUrl: data.bannerUrl,
    estadoPublicacion: data.estadoPublicacion,
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function guardarHijos(
  tx: Tx,
  personajeId: number,
  data: PersonajeInput,
) {
  // Estrategia delete + re-insert (single-admin, bajo volumen).
  await tx.delete(s.estadisticas).where(eq(s.estadisticas.personajeId, personajeId));
  if (data.estadisticas) {
    await tx.insert(s.estadisticas).values({ ...data.estadisticas, personajeId });
  }

  await tx.delete(s.habilidades).where(eq(s.habilidades.personajeId, personajeId));
  if (data.habilidades.length) {
    await tx.insert(s.habilidades).values(
      data.habilidades.map((h) => ({
        personajeId,
        categoria: h.categoria,
        nombre: h.nombre,
        descripcion: h.descripcion,
        tipo: h.tipo,
        magiaFundamentoId: h.magiaFundamentoId,
      })),
    );
  }

  await tx.delete(s.eventosPersonaje).where(eq(s.eventosPersonaje.personajeId, personajeId));
  if (data.eventos.length) {
    await tx.insert(s.eventosPersonaje).values(
      data.eventos.map((e) => ({
        personajeId,
        fecha: e.fecha,
        titulo: e.titulo,
        descripcion: e.descripcion,
      })),
    );
  }

  await tx.delete(s.equipamiento).where(eq(s.equipamiento.personajeId, personajeId));
  if (data.equipamiento.length) {
    await tx.insert(s.equipamiento).values(
      data.equipamiento.map((q) => ({
        personajeId,
        nombre: q.nombre,
        tipo: q.tipo,
        descripcion: q.descripcion,
        poderEspecial: q.poderEspecial,
      })),
    );
  }

  await tx.delete(s.objetosImportantes).where(eq(s.objetosImportantes.personajeId, personajeId));
  if (data.objetos.length) {
    await tx.insert(s.objetosImportantes).values(
      data.objetos.map((o) => ({
        personajeId,
        nombre: o.nombre,
        tipo: o.tipo,
        descripcion: o.descripcion,
      })),
    );
  }

  await tx.delete(s.relaciones).where(eq(s.relaciones.personajeId, personajeId));
  if (data.relaciones.length) {
    await tx.insert(s.relaciones).values(
      data.relaciones.map((r) => ({
        personajeId,
        personajeRelacionadoId: r.personajeRelacionadoId,
        nombreExterno: r.nombreExterno,
        tipoRelacion: r.tipoRelacion,
        subtipoRelacion: r.subtipoRelacion,
        descripcion: r.descripcion,
      })),
    );
  }

  await tx.delete(s.personajeNacion).where(eq(s.personajeNacion.personajeId, personajeId));
  if (data.naciones.length) {
    await tx.insert(s.personajeNacion).values(
      data.naciones.map((n) => ({ personajeId, nacionId: n.nacionId, tipo: n.tipo, descripcion: n.descripcion })),
    );
  }

  await tx.delete(s.personajeRaza).where(eq(s.personajeRaza.personajeId, personajeId));
  if (data.razas.length) {
    await tx.insert(s.personajeRaza).values(
      data.razas.map((r) => ({ personajeId, razaId: r.razaId, esMixta: r.esMixta ?? false, nota: r.nota })),
    );
  }

  await tx.delete(s.personajeOrganizacion).where(eq(s.personajeOrganizacion.personajeId, personajeId));
  if (data.organizaciones.length) {
    await tx.insert(s.personajeOrganizacion).values(
      data.organizaciones.map((o) => ({
        personajeId,
        organizacionId: o.organizacionId,
        rol: o.rol,
        tipo: o.tipo,
        descripcion: o.descripcion,
      })),
    );
  }
}

/** Crea o actualiza un personaje con todos sus bloques. */
export async function guardarPersonaje(
  _prev: PersonajeFormState | undefined,
  formData: FormData,
): Promise<PersonajeFormState> {
  await assertAdmin();

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "Payload inválido." };
  }

  const parsed = personajeSchema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }
  const data = parsed.data;

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const created = !id;

  let savedId: number;
  let notificar = false;
  try {
    const res = await db.transaction(async (tx) => {
      const base = scalars(data);

      if (id) {
        // ¿primera publicación?
        const [existing] = await tx
          .select({ ppv: s.personajes.publicadoPrimeraVezEn })
          .from(s.personajes)
          .where(eq(s.personajes.id, id))
          .limit(1);
        const primeraVez = data.estadoPublicacion === "publicado" && !existing?.ppv;
        const publicadoPrimeraVezEn = primeraVez ? new Date() : existing?.ppv ?? null;

        await tx
          .update(s.personajes)
          .set({ ...base, publicadoPrimeraVezEn })
          .where(eq(s.personajes.id, id));
        await guardarHijos(tx, id, data);
        return { id, notificar: primeraVez };
      }

      const primeraVez = data.estadoPublicacion === "publicado";
      const publicadoPrimeraVezEn = primeraVez ? new Date() : null;
      const [row] = await tx
        .insert(s.personajes)
        .values({ ...base, publicadoPrimeraVezEn })
        .returning({ id: s.personajes.id });
      await guardarHijos(tx, row.id, data);
      return { id: row.id, notificar: primeraVez };
    });
    savedId = res.id;
    notificar = res.notificar;
  } catch (e) {
    console.error("[guardarPersonaje]", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  revalidarPersonaje(savedId);
  if (notificar) {
    await notificarNuevaPublicacion({
      tipo: "personajes",
      idOrSlug: savedId,
      nombre: nombreCompleto(data.nombre, data.surname),
      descripcion: data.subtitulo ?? data.titulo,
      imagenUrl: data.imagenUrl,
    });
  }
  // redirect() lanza NEXT_REDIRECT; debe ir FUERA del try/catch para no atraparlo.
  if (created) redirect(`/admin/personajes/${savedId}/editar`);
  return { ok: true, id: savedId, created: false };
}

/** Cambia el estado de publicación (acción rápida desde la tabla). */
export async function cambiarEstadoPersonaje(
  id: number,
  estado: "borrador" | "publicado" | "oculto",
): Promise<void> {
  await assertAdmin();
  const [existing] = await db
    .select({
      ppv: s.personajes.publicadoPrimeraVezEn,
      nombre: s.personajes.nombre,
      surname: s.personajes.surname,
      subtitulo: s.personajes.subtitulo,
      titulo: s.personajes.titulo,
      imagenUrl: s.personajes.imagenUrl,
    })
    .from(s.personajes)
    .where(eq(s.personajes.id, id))
    .limit(1);
  const primeraVez = estado === "publicado" && !existing?.ppv;
  const publicadoPrimeraVezEn = primeraVez ? new Date() : existing?.ppv ?? null;
  await db
    .update(s.personajes)
    .set({ estadoPublicacion: estado, publicadoPrimeraVezEn })
    .where(eq(s.personajes.id, id));
  revalidarPersonaje(id);
  if (primeraVez && existing) {
    await notificarNuevaPublicacion({
      tipo: "personajes",
      idOrSlug: id,
      nombre: nombreCompleto(existing.nombre, existing.surname),
      descripcion: existing.subtitulo ?? existing.titulo,
      imagenUrl: existing.imagenUrl,
    });
  }
}

/** Mueve a la papelera (soft-delete). */
export async function moverAPapelera(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.personajes).set({ eliminadoEn: new Date() }).where(eq(s.personajes.id, id));
  revalidarPersonaje(id);
}

/** Restaura desde la papelera. */
export async function restaurarDePapelera(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.personajes).set({ eliminadoEn: null }).where(eq(s.personajes.id, id));
  revalidarPersonaje(id);
}

/** Borrado físico definitivo (con cascada manual de hijos). */
export async function eliminarDefinitivo(id: number): Promise<void> {
  await assertAdmin();
  await db.transaction(async (tx) => {
    await tx.delete(s.estadisticas).where(eq(s.estadisticas.personajeId, id));
    await tx.delete(s.habilidades).where(eq(s.habilidades.personajeId, id));
    await tx.delete(s.eventosPersonaje).where(eq(s.eventosPersonaje.personajeId, id));
    await tx.delete(s.equipamiento).where(eq(s.equipamiento.personajeId, id));
    await tx.delete(s.objetosImportantes).where(eq(s.objetosImportantes.personajeId, id));
    await tx.delete(s.relaciones).where(eq(s.relaciones.personajeId, id));
    await tx.delete(s.personajeNacion).where(eq(s.personajeNacion.personajeId, id));
    await tx.delete(s.personajeRaza).where(eq(s.personajeRaza.personajeId, id));
    await tx.delete(s.personajeOrganizacion).where(eq(s.personajeOrganizacion.personajeId, id));
    await tx.delete(s.personajes).where(eq(s.personajes.id, id));
  });
  revalidatePath("/admin/personajes/papelera");
  revalidatePath("/personajes");
}
