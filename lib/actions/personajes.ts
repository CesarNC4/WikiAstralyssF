"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { notificarNuevaPublicacion } from "@/lib/discord";
import { personajeSchema, type PersonajeInput } from "@/lib/validation/personaje";
import { calcularPoderDeCombate } from "@/lib/poderCombate";
import { purgarEnSegundoPlano } from "@/lib/media/purga";

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
  // Pueden haberse creado entradas globales al vuelo desde la ficha.
  revalidatePath("/magia");
  revalidatePath("/timeline");
  revalidatePath("/artefactos");
}

/** Compone "Tipo (Variante)" para el texto de display/enlace de la ficha pública. */
function magiaCombinada(tipo: string | null, variante: string | null): string | null {
  if (!tipo) return null;
  return variante ? `${tipo} (${variante})` : tipo;
}

function scalars(data: PersonajeInput) {
  return {
    nombre: data.nombre,
    surname: data.surname,
    titulo: data.titulo,
    edad: data.edad,
    genero: data.genero,
    altura: data.altura,
    ocupacion: data.ocupacion,
    rangoAventurero: data.rangoAventurero,
    lugarNacimiento: data.lugarNacimiento,
    lugarNacimientoNacionId: data.lugarNacimientoNacionId,
    lugarNacimientoRegionId: data.lugarNacimientoRegionId,
    lugarNacimientoLocacionId: data.lugarNacimientoLocacionId,
    // `familia` ya no se escribe: es solo-lectura derivado de familia_jerarquia.
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
    // Texto combinado derivado (display + enlace por nombre en la ficha pública).
    tipoMagiaPrincipal: magiaCombinada(data.magiaPrincipalTipo, data.magiaPrincipalVariante),
    magiaSecundaria: magiaCombinada(data.magiaSecundariaTipo, data.magiaSecundariaVariante),
    // Estructurado.
    magiaPrincipalTipo: data.magiaPrincipalTipo,
    magiaPrincipalVariante: data.magiaPrincipalVariante,
    magiaSecundariaTipo: data.magiaSecundariaTipo,
    magiaSecundariaVariante: data.magiaSecundariaVariante,
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
    const poderDeCombate = calcularPoderDeCombate(data.estadisticas).total;
    await tx.insert(s.estadisticas).values({ ...data.estadisticas, poderDeCombate, personajeId });
  }

  // Habilidades: enlace a un hechizo del catálogo Magia (o creación de uno nuevo).
  await tx.delete(s.habilidades).where(eq(s.habilidades.personajeId, personajeId));
  for (const h of data.habilidades) {
    let magiaId = h.magiaFundamentoId ?? null;
    let nombre = h.nombre;
    let tipo = h.tipo;
    if (h.nuevaMagia) {
      const [m] = await tx
        .insert(s.magiaFundamentos)
        .values({
          nombre: h.nuevaMagia.nombre,
          naturaleza: "Tecnica",
          tipo: h.nuevaMagia.tipo,
          subcategoria: h.nuevaMagia.subcategoria,
          estadoPublicacion: "borrador",
        })
        .returning({ id: s.magiaFundamentos.id });
      magiaId = m.id;
      nombre = nombre ?? h.nuevaMagia.nombre;
      tipo = tipo ?? h.nuevaMagia.tipo;
    }
    if (!magiaId && !nombre) continue; // fila vacía
    await tx.insert(s.habilidades).values({
      personajeId,
      magiaFundamentoId: magiaId,
      categoria: h.categoria || "Habilidades",
      nombre,
      tipo,
      descripcion: h.descripcion,
    });
  }

  // Eventos clave: vínculo a la cronología global (o creación de un evento nuevo).
  await tx.delete(s.personajeEvento).where(eq(s.personajeEvento.personajeId, personajeId));
  let ordenEv = 0;
  for (const e of data.eventos) {
    let eventoId = e.timelineEventoId ?? null;
    if (e.nuevoEvento) {
      const [ev] = await tx
        .insert(s.timelineEventos)
        .values({
          fechaLore: e.nuevoEvento.fechaLore,
          titulo: e.nuevoEvento.titulo,
          importancia: e.nuevoEvento.importancia,
          categoria: e.nuevoEvento.categoria,
          era: e.nuevoEvento.era,
          estadoPublicacion: "borrador",
        })
        .returning({ id: s.timelineEventos.id });
      eventoId = ev.id;
    }
    if (!eventoId) continue;
    await tx.insert(s.personajeEvento).values({
      personajeId,
      timelineEventoId: eventoId,
      nota: e.nota,
      orden: ordenEv++,
    });
  }

  // Objetos/armas/artefactos: vínculo al catálogo global (o creación de uno nuevo).
  await tx.delete(s.personajeObjeto).where(eq(s.personajeObjeto.personajeId, personajeId));
  let ordenOb = 0;
  for (const o of data.objetos) {
    let artId = o.armaArtefactoId ?? null;
    if (o.nuevoObjeto) {
      const [a] = await tx
        .insert(s.armasArtefactos)
        .values({
          nombre: o.nuevoObjeto.nombre,
          tipo: o.nuevoObjeto.tipo,
          descripcion: o.nuevoObjeto.descripcion,
          poderEspecial: o.nuevoObjeto.poderEspecial,
          propietarioId: personajeId,
          estadoPublicacion: "borrador",
        })
        .returning({ id: s.armasArtefactos.id });
      artId = a.id;
    }
    if (!artId) continue;
    await tx.insert(s.personajeObjeto).values({
      personajeId,
      armaArtefactoId: artId,
      nota: o.nota,
      orden: ordenOb++,
    });
    // Un artefacto sin dueño lo adopta quien lo porta. Antes esto sólo pasaba al
    // crear el objeto aquí mismo, así que vincular uno ya existente lo dejaba con
    // portador y sin propietario, y los dos datos se separaban en silencio.
    await tx
      .update(s.armasArtefactos)
      .set({ propietarioId: personajeId })
      .where(and(eq(s.armasArtefactos.id, artId), isNull(s.armasArtefactos.propietarioId)));
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

  // Las organizaciones viven en `org_jerarquia`, compartida con el editor de la
  // propia organización, que guarda ahí rango, facción y orden. Por eso este
  // bloque NO puede borrar y reinsertar como los de arriba: se sincroniza por
  // diferencias para no tirar lo que se escribió desde el otro lado.
  const orgActuales = await tx
    .select({ id: s.orgJerarquia.id, organizacionId: s.orgJerarquia.organizacionId })
    .from(s.orgJerarquia)
    .where(eq(s.orgJerarquia.personajeId, personajeId));

  const deseadas = new Map<number, (typeof data.organizaciones)[number]>();
  for (const o of data.organizaciones) deseadas.set(o.organizacionId, o);

  const vistas = new Set<number>();
  for (const fila of orgActuales) {
    const quiere = deseadas.get(fila.organizacionId);
    if (!quiere || vistas.has(fila.organizacionId)) {
      // Ya no pertenece (o es una fila repetida de la misma organización).
      await tx.delete(s.orgJerarquia).where(eq(s.orgJerarquia.id, fila.id));
      continue;
    }
    vistas.add(fila.organizacionId);
    await tx
      .update(s.orgJerarquia)
      .set({ rol: quiere.rol, tipo: quiere.tipo, descripcion: quiere.descripcion })
      .where(eq(s.orgJerarquia.id, fila.id));
  }

  const nuevas = data.organizaciones.filter((o) => !vistas.has(o.organizacionId));
  if (nuevas.length) {
    await tx.insert(s.orgJerarquia).values(
      nuevas.map((o) => ({
        organizacionId: o.organizacionId,
        personajeId,
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

  await purgarEnSegundoPlano();
  revalidarPersonaje(savedId);
  if (notificar) {
    await notificarNuevaPublicacion({
      tipo: "personajes",
      idOrSlug: savedId,
      nombre: nombreCompleto(data.nombre, data.surname),
      descripcion: data.titulo,
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
      descripcion: existing.titulo,
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
    await tx.delete(s.personajeEvento).where(eq(s.personajeEvento.personajeId, id));
    await tx.delete(s.personajeObjeto).where(eq(s.personajeObjeto.personajeId, id));
    await tx.delete(s.relaciones).where(eq(s.relaciones.personajeId, id));
    await tx.delete(s.personajeNacion).where(eq(s.personajeNacion.personajeId, id));
    await tx.delete(s.personajeRaza).where(eq(s.personajeRaza.personajeId, id));
    await tx.delete(s.orgJerarquia).where(eq(s.orgJerarquia.personajeId, id));
    await tx.delete(s.personajes).where(eq(s.personajes.id, id));
  });
  await purgarEnSegundoPlano();
  revalidatePath("/admin/personajes/papelera");
  revalidatePath("/personajes");
}
