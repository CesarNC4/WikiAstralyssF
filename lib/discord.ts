import "server-only";

import { eq, getTableColumns } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { entityByKey } from "@/lib/entities";
import { ocultarEnLista } from "@/lib/queries/visibilidad";
import { infoDe } from "@/lib/relaciones/tablas";
import { MARCA_OCULTO } from "@/lib/visibilidad";

/**
 * Notificación a Discord en la PRIMERA publicación de una entidad (§14).
 *
 * El admin escribe el lore aquí pero avisa a sus lectores por Discord: cuando
 * una entidad pasa a `publicado` por primera vez (su `publicadoPrimeraVezEn`
 * estaba en NULL), la acción que la publica llama a `notificarNuevaPublicacion`
 * con su tipo y su id.
 *
 * El aviso lee la ficha ya guardada y envía solo lo que ve el público, con la
 * misma regla que las páginas (`ocultarEnLista`): sin los trozos
 * `[[oculto]]…[[/oculto]]` y sin los campos ocultos (lib/visibilidad.ts).
 *
 * Diseño defensivo:
 *  - **No-op silencioso** si no hay webhook configurado (dev / sin webhook).
 *  - **Nunca lanza**: un fallo jamás debe romper una publicación. Si no se puede
 *    leer la ficha o lo que tiene oculto, no se avisa: mejor perder un aviso que
 *    contar un secreto.
 *  - Timeout corto para no colgar la respuesta del Server Action.
 */

/** Color del embed por grupo temático (hex del design system §7). */
const COLOR_POR_GRUPO: Record<string, number> = {
  personajes: 0x7b5cff, // primary — violeta nebulosa
  mundo: 0xffd66b, // accent — dorado isekai
  lore: 0x2dd4bf, // secondary — cian estelar
  explorar: 0xff8c5a, // accent-warm
};
const COLOR_DEFECTO = 0x7b5cff;

/** Entidades sin página individual `/ruta/[id|slug]`: el enlace va al índice/ruta base. */
const SIN_FICHA_INDIVIDUAL = new Set(["timeline", "economia", "gremio", "mapa"]);

/** Columnas que describen la ficha en el aviso, por orden de preferencia (la del nombre se salta). */
const DESCRIBEN = ["subtitulo", "descripcion", "titulo", "introduccion"];

/**
 * Resuelve a qué canal (webhook) va la notificación de un tipo de entidad.
 * Cada canal de Discord tiene su propio webhook; el enrutado se hace eligiendo
 * el webhook correcto por orden de prioridad:
 *   1. Por entidad exacta:  DISCORD_WEBHOOK_PERSONAJES, DISCORD_WEBHOOK_NACIONES, …
 *   2. Por grupo temático:  DISCORD_WEBHOOK_GRUPO_MUNDO, DISCORD_WEBHOOK_GRUPO_LORE, …
 *   3. Fallback global:     DISCORD_WEBHOOK_URL
 * Devuelve undefined si no hay ninguno configurado (→ no-op silencioso).
 */
function resolverWebhook(tipo: string): string | undefined {
  const porEntidad = process.env[`DISCORD_WEBHOOK_${tipo.toUpperCase()}`]?.trim();
  if (porEntidad) return porEntidad;

  const grupo = entityByKey(tipo)?.group;
  if (grupo) {
    const porGrupo = process.env[`DISCORD_WEBHOOK_GRUPO_${grupo.toUpperCase()}`]?.trim();
    if (porGrupo) return porGrupo;
  }

  return process.env.DISCORD_WEBHOOK_URL?.trim();
}

function absolutizar(base: string, url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url; // Cloudinary y externas ya son absolutas
  if (!base) return undefined; // Discord exige URL absoluta; sin base, se omite
  return `${base}/${url.replace(/^\//, "")}`;
}

/**
 * Un texto de la ficha, listo para el aviso: sin títulos, citas, viñetas ni enlaces
 * (que en Discord no llevarían a ningún sitio), en una línea y recortado. Lo de
 * dentro de las líneas (negrita, cursiva, `||spoiler||`) Discord lo entiende igual.
 */
export function textoDeAviso(texto: unknown, max = 280): string | undefined {
  if (typeof texto !== "string") return undefined;
  let t = texto
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*(?:[-*]|\d+\.)[ \t]+/gm, "")
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t === MARCA_OCULTO) return undefined;
  if (t.length > max) {
    t = t.slice(0, max - 1).trimEnd();
    // Un spoiler cortado a medias se vería entero: se corta antes de que empiece.
    if ((t.match(/\|\|/g)?.length ?? 0) % 2 === 1) t = t.slice(0, t.lastIndexOf("||")).trimEnd();
    t = `${t}…`;
  }
  return t;
}

/** Lo que un lector puede ver de la ficha, para el aviso. Lanza si no se puede leer. */
async function leerLoPublico(tipo: string, id: number) {
  const info = infoDe(tipo);
  if (!info) return null;
  const c = getTableColumns(info.tabla) as unknown as Record<string, PgColumn>;
  const sel: Record<string, PgColumn> = {};
  for (const k of ["id", info.label, "surname", ...DESCRIBEN, info.imagen ?? "imagenUrl", "slug"]) if (c[k]) sel[k] = c[k];
  const [fila] = (await db.select(sel).from(info.tabla).where(eq(c.id, id)).limit(1)) as Record<string, unknown>[];
  if (!fila) return null;
  const [p] = await ocultarEnLista(tipo, [fila]);

  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  // Personajes: el apellido va con el nombre, salvo que esté oculto.
  const nombre = [texto(p[info.label]), tipo === "personajes" ? texto(p.surname) : null].filter(Boolean).join(" ");
  const descripcion = DESCRIBEN.filter((k) => k !== info.label)
    .map((k) => textoDeAviso(p[k]))
    .find(Boolean);
  const imagen = texto(p[info.imagen ?? "imagenUrl"]);
  return { nombre, descripcion, imagen, slug: texto(p.slug) };
}

/**
 * El mensaje del aviso de una ficha, tal y como se enviaría a Discord. Lo usa
 * también `pnpm verificar-ocultos` para comprobar que no lleva nada oculto.
 */
export async function avisoDe(tipo: string, id: number): Promise<Record<string, unknown> | null> {
  const ficha = await leerLoPublico(tipo, id);
  if (!ficha) return null;

  const meta = entityByKey(tipo);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ruta = meta?.route ?? "";
  const clave = tipo === "lore" ? ficha.slug : id;
  const enlace =
    base && ruta && clave != null
      ? SIN_FICHA_INDIVIDUAL.has(tipo)
        ? `${base}${ruta}`
        : `${base}${ruta}/${clave}`
      : undefined;

  const singular = meta?.singular ?? "Entrada";
  const color = COLOR_POR_GRUPO[meta?.group ?? ""] ?? COLOR_DEFECTO;

  const embed: Record<string, unknown> = {
    author: { name: `✨ Nuevo ${singular.toLowerCase()} en Astralys` },
    title: ficha.nombre || singular,
    color,
    footer: { text: "Astralys" },
    timestamp: new Date().toISOString(),
  };
  if (enlace) embed.url = enlace;
  if (ficha.descripcion) embed.description = ficha.descripcion;
  const img = absolutizar(base, ficha.imagen);
  if (img) embed.thumbnail = { url: img };

  return {
    username: "Crónicas de Astralys",
    embeds: [embed],
    // Un nombre o un texto con @everyone no debe llamar a nadie.
    allowed_mentions: { parse: [] },
  };
}

export async function notificarNuevaPublicacion(tipo: string, id: number): Promise<void> {
  const webhook = resolverWebhook(tipo);
  if (!webhook) return;

  try {
    const body = await avisoDe(tipo, id);
    if (!body) return;
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error(`[discord] webhook respondió ${res.status}: ${detalle}`);
    }
  } catch (e) {
    console.error("[discord] envío falló:", e);
  }
}
