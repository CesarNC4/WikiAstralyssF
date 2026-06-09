import "server-only";

import { entityByKey } from "@/lib/entities";

/**
 * Notificación a Discord en la PRIMERA publicación de una entidad (§14).
 *
 * El admin escribe el lore aquí pero avisa a sus lectores por Discord: cuando
 * una entidad pasa a `publicado` por primera vez (su `publicadoPrimeraVezEn`
 * estaba en NULL), el Server Action de publicación llama a
 * `notificarNuevaPublicacion` con los datos visibles de la ficha.
 *
 * Diseño defensivo:
 *  - **No-op silencioso** si `DISCORD_WEBHOOK_URL` no está configurado (dev / sin webhook).
 *  - **Nunca lanza**: un fallo de webhook jamás debe romper una publicación.
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

export interface NuevaPublicacion {
  /** Clave de entidad (EntityKey): "personajes", "naciones", "lore", … */
  tipo: string;
  /** id numérico o slug (lore) para construir el enlace público. */
  idOrSlug: string | number;
  nombre: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
}

function absolutizar(base: string, url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url; // Cloudinary y externas ya son absolutas
  if (!base) return undefined; // Discord exige URL absoluta; sin base, se omite
  return `${base}/${url.replace(/^\//, "")}`;
}

function recortar(texto: string | null | undefined, max = 280): string | undefined {
  if (!texto) return undefined;
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!limpio) return undefined;
  return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
}

export async function notificarNuevaPublicacion(p: NuevaPublicacion): Promise<void> {
  const webhook = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhook) return;

  const meta = entityByKey(p.tipo);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ruta = meta?.route ?? "";
  const enlace =
    base && ruta
      ? SIN_FICHA_INDIVIDUAL.has(p.tipo)
        ? `${base}${ruta}`
        : `${base}${ruta}/${p.idOrSlug}`
      : undefined;

  const singular = meta?.singular ?? "Entrada";
  const color = COLOR_POR_GRUPO[meta?.group ?? ""] ?? COLOR_DEFECTO;

  const embed: Record<string, unknown> = {
    author: { name: `✨ Nuevo ${singular.toLowerCase()} en Astralys` },
    title: p.nombre || singular,
    color,
    footer: { text: "Astralys" },
    timestamp: new Date().toISOString(),
  };
  if (enlace) embed.url = enlace;
  const desc = recortar(p.descripcion);
  if (desc) embed.description = desc;
  const img = absolutizar(base, p.imagenUrl);
  if (img) embed.thumbnail = { url: img };

  const body = {
    username: "Crónicas de Astralys",
    embeds: [embed],
  };

  try {
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
