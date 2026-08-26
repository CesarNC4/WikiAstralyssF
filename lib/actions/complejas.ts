"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { notificarNuevaPublicacion } from "@/lib/discord";
import type { OrgPayload, FamiliaPayload, GremioPayload, Estado } from "@/lib/admin/complejas";
import { purgarEnSegundoPlano } from "@/lib/media/purga";

export interface ComplejaFormState {
  ok: boolean;
  id?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const str = (v: unknown): string => (v == null ? "" : String(v));
const nz = (v: string): string | null => (v.trim() ? v.trim() : null);
/** Entero 0..100 o null (para niveles de poder). */
const nivel = (v: unknown): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
};

function parsePayload<T>(formData: FormData): T | null {
  try {
    return JSON.parse(String(formData.get("payload") ?? "")) as T;
  } catch {
    return null;
  }
}

// ── Organización ────────────────────────────────────────────────────────────
export async function guardarOrganizacion(
  _prev: ComplejaFormState | undefined,
  formData: FormData,
): Promise<ComplejaFormState> {
  await assertAdmin();
  const data = parsePayload<OrgPayload>(formData);
  if (!data) return { ok: false, error: "Payload inválido." };

  const nombre = str(data.campos.nombre).trim();
  if (!nombre) return { ok: false, error: "Revisa los campos.", fieldErrors: { nombre: "El nombre es obligatorio." } };

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const created = !id;

  const base = {
    nombre,
    tipo: nz(str(data.campos.tipo)),
    subtitulo: nz(str(data.campos.subtitulo)),
    sede: nz(str(data.campos.sede)),
    estado: nz(str(data.campos.estado)),
    descripcion: nz(str(data.campos.descripcion)),
    historia: nz(str(data.campos.historia)),
    objetivo: nz(str(data.campos.objetivo)),
    fundacion: nz(str(data.campos.fundacion)),
    ideologia: nz(str(data.campos.ideologia)),
    liderazgo: nz(str(data.campos.liderazgo)),
    miembrosDestacados: nz(str(data.campos.miembrosDestacados)),
    estructuraInterna: nz(str(data.campos.estructuraInterna)),
    relacionFacciones: nz(str(data.campos.relacionFacciones)),
    notasAdicionales: nz(str(data.campos.notasAdicionales)),
    imagenUrl: data.imagenUrl,
    bannerUrl: data.bannerUrl,
    estadoPublicacion: data.estadoPublicacion,
  };

  let savedId: number;
  let notificar = false;
  try {
    savedId = await db.transaction(async (tx) => {
      let oid: number;
      if (id) {
        const [ex] = await tx.select({ ppv: s.organizaciones.publicadoPrimeraVezEn }).from(s.organizaciones).where(eq(s.organizaciones.id, id)).limit(1);
        notificar = data.estadoPublicacion === "publicado" && !ex?.ppv;
        const ppv = notificar ? new Date() : ex?.ppv ?? null;
        await tx.update(s.organizaciones).set({ ...base, publicadoPrimeraVezEn: ppv }).where(eq(s.organizaciones.id, id));
        oid = id;
      } else {
        notificar = data.estadoPublicacion === "publicado";
        const ppv = notificar ? new Date() : null;
        const [row] = await tx.insert(s.organizaciones).values({ ...base, publicadoPrimeraVezEn: ppv }).returning({ id: s.organizaciones.id });
        oid = row.id;
      }

      // Rangos: peso por posición (arriba = mayor). Mapear key → id nuevo.
      await tx.delete(s.orgRangos).where(eq(s.orgRangos.organizacionId, oid));
      const rangoMap = new Map<string, number>();
      const rangos = data.rangos.filter((r) => r.nombre.trim());
      for (let i = 0; i < rangos.length; i++) {
        const [ins] = await tx.insert(s.orgRangos).values({ organizacionId: oid, nombre: rangos[i].nombre.trim(), peso: rangos.length - i }).returning({ id: s.orgRangos.id });
        rangoMap.set(rangos[i].key, ins.id);
      }

      // Facciones: mapear key → id nuevo.
      await tx.delete(s.orgFacciones).where(eq(s.orgFacciones.organizacionId, oid));
      const faccionMap = new Map<string, number>();
      const facciones = data.facciones.filter((f) => f.nombre.trim());
      for (const f of facciones) {
        const [ins] = await tx.insert(s.orgFacciones).values({ organizacionId: oid, nombre: f.nombre.trim(), color: nz(f.color) }).returning({ id: s.orgFacciones.id });
        faccionMap.set(f.key, ins.id);
      }

      // Jerarquía (referencia rango/facción por key).
      await tx.delete(s.orgJerarquia).where(eq(s.orgJerarquia.organizacionId, oid));
      const jer = data.jerarquia.filter((j) => j.personajeId != null || j.nombre.trim());
      if (jer.length) {
        await tx.insert(s.orgJerarquia).values(
          jer.map((j, i) => ({
            organizacionId: oid,
            personajeId: j.personajeId,
            nombre: j.personajeId == null ? nz(j.nombre) : null,
            rangoId: j.rangoKey ? rangoMap.get(j.rangoKey) ?? null : null,
            faccionId: j.faccionKey ? faccionMap.get(j.faccionKey) ?? null : null,
            tituloApodo: nz(j.tituloApodo),
            orden: i,
          })),
        );
      }

      // Historial.
      await tx.delete(s.orgHistorial).where(eq(s.orgHistorial.organizacionId, oid));
      const hist = data.historial.filter((h) => h.nombre.trim() || h.personajeId != null);
      if (hist.length) {
        await tx.insert(s.orgHistorial).values(
          hist.map((h, i) => ({
            organizacionId: oid,
            nombre: h.nombre.trim() || "—",
            personajeId: h.personajeId,
            estado: h.estado ?? "",
            rol: nz(h.rol),
            periodo: nz(h.periodo),
            destacado: h.destacado,
            motivoDestacado: nz(h.motivoDestacado),
            notas: nz(h.notas),
            orden: i,
          })),
        );
      }

      return oid;
    });
  } catch (e) {
    console.error("[guardarOrganizacion]", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  await purgarEnSegundoPlano();
  revalidarOrg(savedId);
  if (notificar) {
    await notificarNuevaPublicacion({
      tipo: "organizaciones",
      idOrSlug: savedId,
      nombre,
      descripcion: base.subtitulo ?? base.descripcion,
      imagenUrl: base.imagenUrl,
    });
  }
  if (created) redirect(`/admin/organizaciones/${savedId}/editar`);
  return { ok: true, id: savedId };
}

function revalidarOrg(id: number) {
  revalidatePath("/organizaciones");
  revalidatePath(`/organizaciones/${id}`);
  revalidatePath("/");
  revalidatePath(`/admin/organizaciones/${id}/editar`);
}

// ── Familia ─────────────────────────────────────────────────────────────────
export async function guardarFamilia(
  _prev: ComplejaFormState | undefined,
  formData: FormData,
): Promise<ComplejaFormState> {
  await assertAdmin();
  const data = parsePayload<FamiliaPayload>(formData);
  if (!data) return { ok: false, error: "Payload inválido." };

  const nombre = str(data.campos.nombre).trim();
  if (!nombre) return { ok: false, error: "Revisa los campos.", fieldErrors: { nombre: "El nombre es obligatorio." } };

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  const created = !id;

  const base = {
    nombre,
    apellido: nz(str(data.campos.apellido)),
    subtitulo: nz(str(data.campos.subtitulo)),
    origen: nz(str(data.campos.origen)),
    descripcion: nz(str(data.campos.descripcion)),
    historia: nz(str(data.campos.historia)),
    poderEconomico: nz(str(data.campos.poderEconomico)),
    poderPolitico: nz(str(data.campos.poderPolitico)),
    poderMilitar: nz(str(data.campos.poderMilitar)),
    poderEconomicoNivel: nivel(data.campos.poderEconomicoNivel),
    poderPoliticoNivel: nivel(data.campos.poderPoliticoNivel),
    poderMilitarNivel: nivel(data.campos.poderMilitarNivel),
    estructuraNucleo: nz(str(data.campos.estructuraNucleo)),
    circuloExtendido: nz(str(data.campos.circuloExtendido)),
    liderazgo: nz(str(data.campos.liderazgo)),
    imagenUrl: data.imagenUrl,
    bannerUrl: data.bannerUrl,
    estadoPublicacion: data.estadoPublicacion,
  };

  let savedId: number;
  let notificar = false;
  try {
    savedId = await db.transaction(async (tx) => {
      let fid: number;
      if (id) {
        const [ex] = await tx.select({ ppv: s.familias.publicadoPrimeraVezEn }).from(s.familias).where(eq(s.familias.id, id)).limit(1);
        notificar = data.estadoPublicacion === "publicado" && !ex?.ppv;
        const ppv = notificar ? new Date() : ex?.ppv ?? null;
        await tx.update(s.familias).set({ ...base, publicadoPrimeraVezEn: ppv }).where(eq(s.familias.id, id));
        fid = id;
      } else {
        notificar = data.estadoPublicacion === "publicado";
        const ppv = notificar ? new Date() : null;
        const [row] = await tx.insert(s.familias).values({ ...base, publicadoPrimeraVezEn: ppv }).returning({ id: s.familias.id });
        fid = row.id;
      }

      // Rangos: peso por posición (arriba = mayor). Mapear key → id nuevo.
      await tx.delete(s.familiaRangos).where(eq(s.familiaRangos.familiaId, fid));
      const rangoMap = new Map<string, number>();
      const rangos = data.rangos.filter((r) => r.nombre.trim());
      for (let i = 0; i < rangos.length; i++) {
        const [ins] = await tx.insert(s.familiaRangos).values({ familiaId: fid, nombre: rangos[i].nombre.trim(), peso: rangos.length - i }).returning({ id: s.familiaRangos.id });
        rangoMap.set(rangos[i].key, ins.id);
      }

      // Facciones.
      await tx.delete(s.familiaFacciones).where(eq(s.familiaFacciones.familiaId, fid));
      const faccionMap = new Map<string, number>();
      for (const f of data.facciones.filter((f) => f.nombre.trim())) {
        const [ins] = await tx.insert(s.familiaFacciones).values({ familiaId: fid, nombre: f.nombre.trim(), color: nz(f.color) }).returning({ id: s.familiaFacciones.id });
        faccionMap.set(f.key, ins.id);
      }

      // Jerarquía (rango + títulos nobiliario/familia).
      await tx.delete(s.familiaJerarquia).where(eq(s.familiaJerarquia.familiaId, fid));
      const jer = data.jerarquia.filter((j) => j.personajeId != null || j.nombre.trim());
      if (jer.length) {
        await tx.insert(s.familiaJerarquia).values(
          jer.map((j, i) => ({
            familiaId: fid,
            personajeId: j.personajeId,
            nombre: j.personajeId == null ? nz(j.nombre) : null,
            rangoId: j.rangoKey ? rangoMap.get(j.rangoKey) ?? null : null,
            tituloNobiliario: nz(j.tituloNobiliario),
            tituloFamilia: nz(j.tituloFamilia),
            faccionId: j.faccionKey ? faccionMap.get(j.faccionKey) ?? null : null,
            orden: i,
          })),
        );
      }

      // Árbol: dos pasadas (insertar nodos → mapear key→id → fijar padre/madre).
      await tx.delete(s.familiaArbol).where(eq(s.familiaArbol.familiaId, fid));
      const nodos = data.arbol.filter((n) => n.nombre.trim() || n.personajeId != null);
      const arbolMap = new Map<string, number>();
      for (const n of nodos) {
        const [ins] = await tx
          .insert(s.familiaArbol)
          .values({
            familiaId: fid,
            nombre: n.nombre.trim() || "—",
            personajeId: n.personajeId,
            generacion: Number.isFinite(n.generacion) ? n.generacion : 0,
            estado: n.estado ?? "",
            destacado: n.destacado,
            motivoDestacado: nz(n.motivoDestacado),
            notas: nz(n.notas),
          })
          .returning({ id: s.familiaArbol.id });
        arbolMap.set(n.key, ins.id);
      }
      for (const n of nodos) {
        const padreId = n.padreKey ? arbolMap.get(n.padreKey) ?? null : null;
        const madreId = n.madreKey ? arbolMap.get(n.madreKey) ?? null : null;
        if (padreId != null || madreId != null) {
          await tx.update(s.familiaArbol).set({ padreId, madreId }).where(eq(s.familiaArbol.id, arbolMap.get(n.key)!));
        }
      }

      return fid;
    });
  } catch (e) {
    console.error("[guardarFamilia]", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  await purgarEnSegundoPlano();
  revalidarFamilia(savedId);
  if (notificar) {
    await notificarNuevaPublicacion({
      tipo: "familias",
      idOrSlug: savedId,
      nombre,
      descripcion: base.subtitulo ?? base.descripcion,
      imagenUrl: base.imagenUrl,
    });
  }
  if (created) redirect(`/admin/familias/${savedId}/editar`);
  return { ok: true, id: savedId };
}

function revalidarFamilia(id: number) {
  revalidatePath("/familias");
  revalidatePath(`/familias/${id}`);
  revalidatePath("/");
  revalidatePath(`/admin/familias/${id}/editar`);
}

// ── Gremio (singleton) ──────────────────────────────────────────────────────
export async function guardarGremio(
  _prev: ComplejaFormState | undefined,
  formData: FormData,
): Promise<ComplejaFormState> {
  await assertAdmin();
  const data = parsePayload<GremioPayload>(formData);
  if (!data) return { ok: false, error: "Payload inválido." };

  const idRaw = formData.get("id");
  const gid = idRaw ? Number(idRaw) : null;
  if (!gid) return { ok: false, error: "Falta el identificador del gremio." };

  const base = {
    nombre: str(data.campos.nombre).trim() || "Gremio",
    subtitulo: nz(str(data.campos.subtitulo)),
    lema: nz(str(data.campos.lema)),
    sede: nz(str(data.campos.sede)),
    descripcion: nz(str(data.campos.descripcion)),
    historia: nz(str(data.campos.historia)),
    estructuraGlobal: nz(str(data.campos.estructuraGlobal)),
    jerarquiaRangos: nz(str(data.campos.jerarquiaRangos)),
    sistemaMisiones: nz(str(data.campos.sistemaMisiones)),
    principiosGenerales: nz(str(data.campos.principiosGenerales)),
    normasContratos: nz(str(data.campos.normasContratos)),
    conductaAceptable: nz(str(data.campos.conductaAceptable)),
    conductaIntolerable: nz(str(data.campos.conductaIntolerable)),
    usoFuerza: nz(str(data.campos.usoFuerza)),
    lealtadDiscrecion: nz(str(data.campos.lealtadDiscrecion)),
    principioEspadaNeutral: nz(str(data.campos.principioEspadaNeutral)),
    recompensas: nz(str(data.campos.recompensas)),
    imagenUrl: data.imagenUrl,
    bannerUrl: data.bannerUrl,
  };

  try {
    await db.transaction(async (tx) => {
      await tx.update(s.gremio).set(base).where(eq(s.gremio.id, gid));

      await tx.delete(s.gremioRangos).where(eq(s.gremioRangos.gremioId, gid));
      const rangoMap = new Map<string, number>();
      const rangos = data.rangos.filter((r) => r.nombre.trim());
      for (let i = 0; i < rangos.length; i++) {
        const [ins] = await tx.insert(s.gremioRangos).values({ gremioId: gid, nombre: rangos[i].nombre.trim(), peso: rangos.length - i }).returning({ id: s.gremioRangos.id });
        rangoMap.set(rangos[i].key, ins.id);
      }

      await tx.delete(s.gremioFacciones).where(eq(s.gremioFacciones.gremioId, gid));
      const faccionMap = new Map<string, number>();
      for (const f of data.facciones.filter((f) => f.nombre.trim())) {
        const [ins] = await tx.insert(s.gremioFacciones).values({ gremioId: gid, nombre: f.nombre.trim(), color: nz(f.color) }).returning({ id: s.gremioFacciones.id });
        faccionMap.set(f.key, ins.id);
      }

      await tx.delete(s.gremioJerarquia).where(eq(s.gremioJerarquia.gremioId, gid));
      const jer = data.jerarquia.filter((j) => j.personajeId != null || j.nombre.trim());
      if (jer.length) {
        await tx.insert(s.gremioJerarquia).values(
          jer.map((j, i) => ({
            gremioId: gid,
            personajeId: j.personajeId,
            nombre: j.personajeId == null ? nz(j.nombre) : null,
            rangoId: j.rangoKey ? rangoMap.get(j.rangoKey) ?? null : null,
            faccionId: j.faccionKey ? faccionMap.get(j.faccionKey) ?? null : null,
            tituloApodo: nz(j.tituloApodo),
            orden: i,
          })),
        );
      }

      await tx.delete(s.gremioHistorial).where(eq(s.gremioHistorial.gremioId, gid));
      const hist = data.historial.filter((h) => h.nombre.trim() || h.personajeId != null);
      if (hist.length) {
        await tx.insert(s.gremioHistorial).values(
          hist.map((h, i) => ({
            gremioId: gid,
            nombre: h.nombre.trim() || "—",
            personajeId: h.personajeId,
            estado: h.estado ?? "",
            rol: nz(h.rol),
            periodo: nz(h.periodo),
            destacado: h.destacado,
            motivoDestacado: nz(h.motivoDestacado),
            notas: nz(h.notas),
            orden: i,
          })),
        );
      }
    });
  } catch (e) {
    console.error("[guardarGremio]", e);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }

  await purgarEnSegundoPlano();
  revalidatePath("/admin/gremio");
  return { ok: true, id: gid };
}

// ── Estado / papelera (org y familia) ───────────────────────────────────────
export async function cambiarEstadoOrg(id: number, estado: Estado): Promise<void> {
  await assertAdmin();
  const [ex] = await db
    .select({
      ppv: s.organizaciones.publicadoPrimeraVezEn,
      nombre: s.organizaciones.nombre,
      subtitulo: s.organizaciones.subtitulo,
      descripcion: s.organizaciones.descripcion,
      imagenUrl: s.organizaciones.imagenUrl,
    })
    .from(s.organizaciones)
    .where(eq(s.organizaciones.id, id))
    .limit(1);
  const primeraVez = estado === "publicado" && !ex?.ppv;
  const ppv = primeraVez ? new Date() : ex?.ppv ?? null;
  await db.update(s.organizaciones).set({ estadoPublicacion: estado, publicadoPrimeraVezEn: ppv }).where(eq(s.organizaciones.id, id));
  revalidarOrg(id);
  if (primeraVez && ex) {
    await notificarNuevaPublicacion({
      tipo: "organizaciones",
      idOrSlug: id,
      nombre: ex.nombre,
      descripcion: ex.subtitulo ?? ex.descripcion,
      imagenUrl: ex.imagenUrl,
    });
  }
}

export async function cambiarEstadoFamilia(id: number, estado: Estado): Promise<void> {
  await assertAdmin();
  const [ex] = await db
    .select({
      ppv: s.familias.publicadoPrimeraVezEn,
      nombre: s.familias.nombre,
      subtitulo: s.familias.subtitulo,
      descripcion: s.familias.descripcion,
      imagenUrl: s.familias.imagenUrl,
    })
    .from(s.familias)
    .where(eq(s.familias.id, id))
    .limit(1);
  const primeraVez = estado === "publicado" && !ex?.ppv;
  const ppv = primeraVez ? new Date() : ex?.ppv ?? null;
  await db.update(s.familias).set({ estadoPublicacion: estado, publicadoPrimeraVezEn: ppv }).where(eq(s.familias.id, id));
  revalidarFamilia(id);
  if (primeraVez && ex) {
    await notificarNuevaPublicacion({
      tipo: "familias",
      idOrSlug: id,
      nombre: ex.nombre,
      descripcion: ex.subtitulo ?? ex.descripcion,
      imagenUrl: ex.imagenUrl,
    });
  }
}

export async function moverOrgAPapelera(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.organizaciones).set({ eliminadoEn: new Date() }).where(eq(s.organizaciones.id, id));
  revalidarOrg(id);
}
export async function restaurarOrg(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.organizaciones).set({ eliminadoEn: null }).where(eq(s.organizaciones.id, id));
  revalidarOrg(id);
}
export async function moverFamiliaAPapelera(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.familias).set({ eliminadoEn: new Date() }).where(eq(s.familias.id, id));
  revalidarFamilia(id);
}
export async function restaurarFamilia(id: number): Promise<void> {
  await assertAdmin();
  await db.update(s.familias).set({ eliminadoEn: null }).where(eq(s.familias.id, id));
  revalidarFamilia(id);
}

export async function eliminarOrgDefinitivo(id: number): Promise<void> {
  await assertAdmin();
  await db.transaction(async (tx) => {
    await tx.delete(s.orgJerarquia).where(eq(s.orgJerarquia.organizacionId, id));
    await tx.delete(s.orgHistorial).where(eq(s.orgHistorial.organizacionId, id));
    await tx.delete(s.orgRangos).where(eq(s.orgRangos.organizacionId, id));
    await tx.delete(s.orgFacciones).where(eq(s.orgFacciones.organizacionId, id));
    await tx.delete(s.organizaciones).where(eq(s.organizaciones.id, id));
  });
  await purgarEnSegundoPlano();
  revalidatePath("/admin/organizaciones/papelera");
  revalidatePath("/organizaciones");
}

export async function eliminarFamiliaDefinitivo(id: number): Promise<void> {
  await assertAdmin();
  await db.transaction(async (tx) => {
    await tx.delete(s.familiaJerarquia).where(eq(s.familiaJerarquia.familiaId, id));
    await tx.delete(s.familiaArbol).where(eq(s.familiaArbol.familiaId, id));
    await tx.delete(s.familiaRangos).where(eq(s.familiaRangos.familiaId, id));
    await tx.delete(s.familiaFacciones).where(eq(s.familiaFacciones.familiaId, id));
    await tx.delete(s.familias).where(eq(s.familias.id, id));
  });
  await purgarEnSegundoPlano();
  revalidatePath("/admin/familias/papelera");
  revalidatePath("/familias");
}
