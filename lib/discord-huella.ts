import "server-only";

import { createHash } from "node:crypto";
import { and, eq, getTableColumns } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { discordHuella, estadisticas } from "@/db/schema";
import { rolesDe } from "@/lib/fechas/roles";
import { ESTADISTICAS, TITULO_ESTADISTICAS, listasDe } from "@/lib/propuestas/listas";
import { leerLista } from "@/lib/propuestas/listasDb";
import { moldeDe, rotuloDe } from "@/lib/propuestas/moldes";
import { leerFechasDe } from "@/lib/queries/fechas";
import { getGaleriaPublica } from "@/lib/queries/galeria";
import { camposOcultos, ocultarEnLista } from "@/lib/queries/visibilidad";
import { leerFilas } from "@/lib/relaciones/consultas";
import { bloquesDe } from "@/lib/relaciones/registro";
import { infoDe } from "@/lib/relaciones/tablas";
import { censurar } from "@/lib/visibilidad";

/**
 * La huella de lo que ve el público de una ficha, campo a campo (decisión del
 * autor, 2026-11-11): el aviso de un cambio dice qué campos cambiaron, sin su
 * contenido («Cambió: Título · Imagen»), porque los jugadores leen el detalle en
 * la wiki.
 *
 * Se guarda en `discord_huella` al estrenarse la ficha y tras cada aviso de un
 * cambio. Comparar la de ahora con la guardada da lo que cambió desde la última
 * vez que se avisó, aunque entre medias se guardara varias veces sin avisar.
 *
 * Solo cuenta lo que se ve: un campo oculto pesa lo mismo que uno vacío, y las
 * conexiones, fechas y filas ocultas no entran. Así el aviso nunca delata que
 * algo oculto ha cambiado.
 */

/** Clave estable de cada campo → hash corto de su valor visible. */
export type Huella = Record<string, string>;

export interface LecturaHuella {
  huella: Huella;
  /** El nombre de cada clave, como lo ve el autor en el formulario. */
  rotulos: Record<string, string>;
}

function normal(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) return v.length ? v.map(normal) : null;
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, normal(x)]),
    );
  }
  return v ?? null;
}

const resumen = (v: unknown) => createHash("sha1").update(JSON.stringify(normal(v))).digest("base64url").slice(0, 12);
const enOrden = (xs: unknown[]) => xs.map((x) => JSON.stringify(normal(x))).sort();
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** La huella de lo que se ve ahora de la ficha. `null` si no existe. */
export async function leerHuella(tipo: string, id: number): Promise<LecturaHuella | null> {
  const info = infoDe(tipo);
  if (!info) return null;
  const c = getTableColumns(info.tabla) as unknown as Record<string, PgColumn>;
  const [fila] = (await db.select().from(info.tabla).where(eq(c.id, id)).limit(1)) as Record<string, unknown>[];
  if (!fila) return null;
  const [p] = (await ocultarEnLista(tipo, [fila])) as Record<string, unknown>[];

  const huella: Huella = {};
  const rotulos: Record<string, string> = {};
  const poner = (clave: string, rotulo: string, valor: unknown) => {
    huella[clave] = resumen(valor);
    rotulos[clave] = rotulo;
  };

  // Los campos de la ficha, con el rótulo de su formulario.
  const molde = moldeDe(tipo);
  for (const campo of molde?.campos ?? []) if (campo.name in p) poner(`c:${campo.name}`, rotuloDe(molde!, campo), p[campo.name]);
  const imagen = info.imagen ?? "imagenUrl";
  if (imagen in p && !huella[`c:${imagen}`]) poner(`c:${imagen}`, "Imagen", p[imagen]);

  // Conexiones, una clave por bloque: solo las que se ven enteras (las ocultas salen como «???»).
  for (const b of bloquesDe(tipo)) {
    const filas = await leerFilas(b.relId, b.lado, id, tipo, { publico: true });
    const visibles = filas.filter((f) => !f.oculto).map((f) => [f.objetivoTipo ?? "", f.objetivoId, f.label, f.campos]);
    poner(`x:${b.relId}:${b.lado}`, b.titulo, enOrden(visibles));
  }

  // Fechas, una por papel (nacimiento, fundación…).
  const roles = rolesDe(tipo);
  if (roles.length) {
    const fechas = await leerFechasDe(tipo, id);
    for (const r of roles) {
      const f = fechas[r.rol];
      poner(`f:${r.rol}`, `Fecha de ${minuscula(r.etiqueta)}`, f && !f.oculto ? f.fecha : null);
    }
  }

  // Las filas propias: habilidades, rangos, secciones, fragmentos…
  for (const def of listasDe(tipo)) {
    const filas = await leerLista(tipo, def.clase, id);
    const visibles = filas.filter((f) => !f.oculto).map((f) => censurar([f.nombre, f.valores, f.texto]));
    poner(`l:${def.clase}`, def.titulo, enOrden(visibles));
  }

  const ocultos = await camposOcultos(tipo, id);
  if (tipo === "personajes") {
    const [st] = ocultos.has("estadisticas")
      ? []
      : ((await db.select().from(estadisticas).where(eq(estadisticas.personajeId, id)).limit(1)) as Record<string, unknown>[]);
    poner("estadisticas", TITULO_ESTADISTICAS, st ? ESTADISTICAS.map((e) => st[e.name] ?? null) : null);
  }

  const galeria = await getGaleriaPublica(tipo, id);
  poner("galeria", "Galería", galeria.map((g) => [g.url, g.alt]));

  return { huella, rotulos };
}

/** Guarda la huella de ahora (o la ya leída) como lo último que vieron los jugadores. */
export async function guardarHuella(tipo: string, id: number, lectura?: LecturaHuella | null): Promise<void> {
  const l = lectura ?? (await leerHuella(tipo, id));
  if (!l) return;
  await db
    .insert(discordHuella)
    .values({ entidadTipo: tipo, entidadId: id, huella: l.huella, actualizadoEn: new Date() })
    .onConflictDoUpdate({
      target: [discordHuella.entidadTipo, discordHuella.entidadId],
      set: { huella: l.huella, actualizadoEn: new Date() },
    });
}

async function huellaGuardada(tipo: string, id: number): Promise<Huella | null> {
  const [f] = await db
    .select({ huella: discordHuella.huella })
    .from(discordHuella)
    .where(and(eq(discordHuella.entidadTipo, tipo), eq(discordHuella.entidadId, id)))
    .limit(1);
  return f?.huella ?? null;
}

/** Si la ficha aún no tiene huella (se publicó antes de que existieran), toma la de ahora. */
export async function asegurarHuella(tipo: string, id: number): Promise<void> {
  if (!(await huellaGuardada(tipo, id))) await guardarHuella(tipo, id);
}

/**
 * Los campos visibles que cambiaron desde el último aviso, por su rótulo y sin
 * repetir. `cambios: null` si no hay huella con que comparar. Una clave que la
 * huella guardada no tenía (un campo nuevo en el formulario) no cuenta.
 */
export async function cambiosVisibles(tipo: string, id: number): Promise<{ cambios: string[] | null; ahora: LecturaHuella } | null> {
  const [ahora, antes] = await Promise.all([leerHuella(tipo, id), huellaGuardada(tipo, id)]);
  if (!ahora) return null;
  if (!antes) return { cambios: null, ahora };
  const cambios: string[] = [];
  for (const [clave, h] of Object.entries(ahora.huella)) {
    if (!(clave in antes) || antes[clave] === h) continue;
    const rotulo = ahora.rotulos[clave];
    if (!cambios.includes(rotulo)) cambios.push(rotulo);
  }
  return { cambios, ahora };
}
