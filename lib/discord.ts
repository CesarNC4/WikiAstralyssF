import "server-only";

import { and, desc, eq, getTableColumns, inArray, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { capitulos, discordAviso, discordCanal } from "@/db/schema";
import { ES_TIPO_CON_AVISO } from "@/lib/discord-tipos";
import { entityByKey } from "@/lib/entities";
import { ocultarEnLista } from "@/lib/queries/visibilidad";
import { infoDe } from "@/lib/relaciones/tablas";
import { MARCA_OCULTO, censurarTexto } from "@/lib/visibilidad";

/**
 * Avisos a Discord (docs/arquitectura.md §14), con un bot que escribe en el canal
 * que toca.
 *
 *  - **Estreno:** cuando una ficha pasa a `publicado` por primera vez (su
 *    `publicadoPrimeraVezEn` estaba en NULL), la acción que la publica llama a
 *    `notificarNuevaPublicacion`. Va al canal elegido al publicar o, si no se
 *    eligió, al canal por defecto de su tipo (/admin/discord).
 *  - **Cambio:** solo si el autor marca «Avisar del cambio» al guardar una ficha
 *    ya publicada (`avisarCambio`), con una nota opcional. Va por defecto al canal
 *    donde se estrenó.
 *
 * El aviso lee la ficha ya guardada y envía solo lo que ve el público, con la
 * misma regla que las páginas (`ocultarEnLista`): sin los trozos
 * `[[oculto]]…[[/oculto]]` y sin los campos ocultos (lib/visibilidad.ts).
 *
 * Diseño defensivo:
 *  - **No-op silencioso** sin `DISCORD_BOT_TOKEN` y `DISCORD_SERVIDOR_ID`.
 *  - **Solo envía la web publicada** (`VERCEL_ENV=production`), o quien ponga
 *    `DISCORD_AVISOS=siempre`: probar en el ordenador no escribe en el Discord de
 *    los jugadores, solo apunta en la consola lo que habría enviado.
 *  - **Nunca lanza**: un fallo jamás debe romper una publicación. Si no se puede
 *    leer la ficha o lo que tiene oculto, no se avisa: mejor perder un aviso que
 *    contar un secreto.
 *  - Timeout corto para no colgar la respuesta del Server Action.
 */

const API = "https://discord.com/api/v10";

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

export type ClaseAviso = "estreno" | "cambio";

/**
 * Lo que el autor elige al guardar. `canal`: un id de canal, `null` para no avisar
 * o ausente para el de por defecto. `cambio`: avisar de un cambio en una ficha ya
 * publicada. `nota`: qué cambió, en sus palabras.
 */
export interface EleccionAviso {
  canal?: string | null;
  cambio?: boolean;
  nota?: string;
}

// ── El bot ───────────────────────────────────────────────────────────────────

function credenciales(): { token: string; servidor: string } | null {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const servidor = process.env.DISCORD_SERVIDOR_ID?.trim();
  return token && servidor ? { token, servidor } : null;
}

/** ¿Se envía de verdad? Solo desde la web publicada, o si se pide expresamente. */
function enviaDeVerdad(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.DISCORD_AVISOS === "siempre";
}

async function api<T>(ruta: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const cred = credenciales();
  if (!cred) throw new Error("Discord sin configurar.");
  const res = await fetch(`${API}${ruta}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bot ${cred.token}`,
      "User-Agent": "DiscordBot (https://github.com/CesarNC4/WikiAstralyssF, 1.0)",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`Discord respondió ${res.status} en ${ruta}: ${detalle.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface CanalDiscord {
  id: string;
  nombre: string;
  categoria: string | null;
}

interface CanalApi {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string | null;
  permission_overwrites?: { id: string; type: number; allow: string; deny: string }[];
}

const VER = BigInt(1) << BigInt(10);
const ENVIAR = BigInt(1) << BigInt(11);
const ENLACES = BigInt(1) << BigInt(14);
const ADMIN = BigInt(1) << BigInt(3);
const NECESARIOS = VER | ENVIAR | ENLACES;

let cacheCanales: { cuando: number; canales: Promise<CanalDiscord[] | null> } | null = null;

/**
 * Los canales de texto donde el bot puede avisar (ver, escribir e insertar
 * enlaces), en el orden del servidor. `null` si Discord no está configurado o no
 * responde. Se guardan un minuto, y las peticiones que llegan a la vez (las
 * tarjetas de la bandeja) comparten una sola consulta a Discord.
 */
export function canalesDelServidor(): Promise<CanalDiscord[] | null> {
  if (!credenciales()) return Promise.resolve(null);
  if (cacheCanales && Date.now() - cacheCanales.cuando < 60_000) return cacheCanales.canales;
  const canales = leerCanales();
  cacheCanales = { cuando: Date.now(), canales };
  // Un fallo no se guarda: el siguiente intento vuelve a preguntar.
  void canales.then((c) => {
    if (!c && cacheCanales?.canales === canales) cacheCanales = null;
  });
  return canales;
}

async function leerCanales(): Promise<CanalDiscord[] | null> {
  const cred = credenciales();
  if (!cred) return null;
  try {
    const [yo, servidor, lista] = await Promise.all([
      api<{ id: string }>("/users/@me"),
      api<{ roles: { id: string; permissions: string }[] }>(`/guilds/${cred.servidor}`),
      api<CanalApi[]>(`/guilds/${cred.servidor}/channels`),
    ]);
    const miembro = await api<{ roles: string[] }>(`/guilds/${cred.servidor}/members/${yo.id}`);
    const permisosRol = new Map(servidor.roles.map((r) => [r.id, BigInt(r.permissions)]));
    const misRoles = new Set(miembro.roles);
    let base = permisosRol.get(cred.servidor) ?? BigInt(0);
    for (const r of misRoles) base |= permisosRol.get(r) ?? BigInt(0);

    // Permisos en un canal: los del servidor, luego @everyone, luego los roles del bot y por último el propio bot.
    const puedeAvisar = (c: CanalApi): boolean => {
      if (base & ADMIN) return true;
      let p = base;
      const ow = c.permission_overwrites ?? [];
      const todos = ow.find((o) => o.id === cred.servidor);
      if (todos) p = (p & ~BigInt(todos.deny)) | BigInt(todos.allow);
      let quita = BigInt(0);
      let da = BigInt(0);
      for (const o of ow) {
        if (o.type === 0 && misRoles.has(o.id)) {
          quita |= BigInt(o.deny);
          da |= BigInt(o.allow);
        }
      }
      p = (p & ~quita) | da;
      const propio = ow.find((o) => o.type === 1 && o.id === yo.id);
      if (propio) p = (p & ~BigInt(propio.deny)) | BigInt(propio.allow);
      return (p & NECESARIOS) === NECESARIOS;
    };

    const categorias = new Map(lista.filter((c) => c.type === 4).map((c) => [c.id, c]));
    const orden = (c: CanalApi) => {
      const cat = c.parent_id ? categorias.get(c.parent_id) : undefined;
      return [cat ? cat.position + 1 : 0, c.position] as const;
    };
    const canales = lista
      .filter((c) => (c.type === 0 || c.type === 5) && puedeAvisar(c))
      .sort((a, b) => {
        const [ca, pa] = orden(a);
        const [cb, pb] = orden(b);
        return ca - cb || pa - pb;
      })
      .map((c) => ({ id: c.id, nombre: c.name, categoria: c.parent_id ? categorias.get(c.parent_id)?.name ?? null : null }));
    return canales;
  } catch (e) {
    console.error("[discord] no se pudieron leer los canales:", e);
    return null;
  }
}

/** El nombre del servidor, para el panel. */
export async function nombreDelServidor(): Promise<string | null> {
  const cred = credenciales();
  if (!cred) return null;
  try {
    return (await api<{ name: string }>(`/guilds/${cred.servidor}`)).name;
  } catch {
    return null;
  }
}

// ── A qué canal va ───────────────────────────────────────────────────────────

/** El canal por defecto de cada tipo de ficha. `""` = ese tipo no avisa (elegido así en el panel). */
export async function canalesPorDefecto(): Promise<Record<string, string>> {
  const filas = await db.select({ tipo: discordCanal.entidadTipo, canal: discordCanal.canalId }).from(discordCanal);
  return Object.fromEntries(filas.map((f) => [f.tipo, f.canal]));
}

/** El canal donde se avisó por última vez de esta ficha (su estreno o su último cambio). */
async function canalDeLaFicha(tipo: string, id: number): Promise<string | null> {
  const [f] = await db
    .select({ canal: discordAviso.canalId })
    .from(discordAviso)
    .where(and(eq(discordAviso.entidadTipo, tipo), eq(discordAviso.entidadId, id), inArray(discordAviso.clase, ["estreno", "cambio"])))
    .orderBy(desc(discordAviso.enviadoEn))
    .limit(1);
  return f?.canal ?? null;
}

/** El canal que se ofrece al publicar: el de la ficha si ya se avisó de ella, si no el de su tipo. */
export async function canalSugerido(tipo: string, id?: number | null): Promise<string | null> {
  const propio = id ? await canalDeLaFicha(tipo, id) : null;
  if (propio) return propio;
  const [f] = await db.select({ canal: discordCanal.canalId }).from(discordCanal).where(eq(discordCanal.entidadTipo, tipo)).limit(1);
  return f?.canal || null;
}

/**
 * ¿La ven los jugadores ahora mismo? Publicada y fuera de la papelera; un acto,
 * además, solo si su capítulo también lo está (`estadoSql`). Lo que no tiene
 * estado (el gremio) siempre es público.
 */
async function esPublica(tipo: string, id: number): Promise<boolean> {
  const info = infoDe(tipo);
  if (!info) return false;
  const c = getTableColumns(info.tabla) as unknown as Record<string, PgColumn>;
  const sel: Record<string, PgColumn | SQL> = { id: c.id };
  if (info.estadoSql) sel.estado = info.estadoSql;
  else if (c.estadoPublicacion) sel.estado = c.estadoPublicacion;
  if (c.eliminadoEn) sel.eliminado = c.eliminadoEn;
  const [f] = (await db.select(sel).from(info.tabla).where(eq(c.id, id)).limit(1)) as { estado?: string; eliminado?: Date | null }[];
  if (!f || f.eliminado) return false;
  return f.estado === undefined || f.estado === "publicado";
}

// ── El mensaje ───────────────────────────────────────────────────────────────

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
  const anidada = info.rutaAnidada;
  for (const k of ["id", info.label, "surname", ...DESCRIBEN, info.imagen ?? "imagenUrl", "slug", anidada?.col ?? ""]) if (c[k]) sel[k] = c[k];
  const [fila] = (await db.select(sel).from(info.tabla).where(eq(c.id, id)).limit(1)) as Record<string, unknown>[];
  if (!fila) return null;
  // La ruta de una ficha anidada (el acto, dentro de su capítulo) sale de la fila tal cual.
  const rutaPropia = anidada ? anidada.hacer(id, fila[anidada.col]) : null;
  const padre = anidada ? Number(fila[anidada.col]) || null : null;
  const [p] = await ocultarEnLista(tipo, [fila]);

  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  // Personajes: el apellido va con el nombre, salvo que esté oculto.
  const nombre = [texto(p[info.label]), tipo === "personajes" ? texto(p.surname) : null].filter(Boolean).join(" ");
  const descripcion = DESCRIBEN.filter((k) => k !== info.label)
    .map((k) => textoDeAviso(p[k]))
    .find(Boolean);
  const imagen = texto(p[info.imagen ?? "imagenUrl"]);
  return { nombre, descripcion, imagen, slug: texto(p.slug), rutaPropia, padre };
}

/** «Capítulo 3: Título», para decir de qué capítulo es un acto. */
async function nombreDeCapitulo(id: number | null): Promise<string | null> {
  if (!id) return null;
  const [f] = await db.select({ numero: capitulos.numero, titulo: capitulos.titulo }).from(capitulos).where(eq(capitulos.id, id)).limit(1);
  if (!f) return null;
  const titulo = censurarTexto(f.titulo);
  return /^\d+$/.test(f.numero.trim()) ? `Capítulo ${f.numero.trim()}: ${titulo}` : `${f.numero}: ${titulo}`;
}

/**
 * El mensaje del aviso de una ficha, tal y como se enviaría a Discord. Lo usa
 * también `pnpm verificar-ocultos` para comprobar que no lleva nada oculto.
 */
export async function avisoDe(
  tipo: string,
  id: number,
  { clase = "estreno", nota }: { clase?: ClaseAviso; nota?: string } = {},
): Promise<Record<string, unknown> | null> {
  const ficha = await leerLoPublico(tipo, id);
  if (!ficha) return null;

  const meta = entityByKey(tipo);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ruta = meta?.route ?? "";
  const clave = tipo === "lore" ? ficha.slug : id;
  const enlace = !base
    ? undefined
    : infoDe(tipo)?.rutaAnidada
      ? ficha.rutaPropia
        ? `${base}${ficha.rutaPropia}`
        : undefined
      : ruta && clave != null
        ? SIN_FICHA_INDIVIDUAL.has(tipo)
          ? `${base}${ruta}`
          : `${base}${ruta}/${clave}`
        : undefined;

  const singular = meta?.singular ?? "Entrada";
  const color = COLOR_POR_GRUPO[meta?.group ?? ""] ?? COLOR_DEFECTO;
  // Un acto dice de qué capítulo es.
  const de = tipo === "actos" ? await nombreDeCapitulo(ficha.padre) : null;
  const que = de ? `${singular} · ${de}` : singular;

  const embed: Record<string, unknown> = {
    // Sin «Nuevo» ni «Actualizado»: no concuerdan con «Nación», «Región», «Página»…
    author: { name: (clase === "cambio" ? `📝 Cambios · ${que}` : `✨ Nuevo en Astralys · ${que}`).slice(0, 256) },
    title: ficha.nombre || singular,
    color,
    footer: { text: "Astralys" },
    timestamp: new Date().toISOString(),
  };
  if (enlace) embed.url = enlace;
  if (ficha.descripcion) embed.description = ficha.descripcion;
  const queCambio = clase === "cambio" ? nota?.trim().slice(0, 1000) : undefined;
  if (queCambio) embed.fields = [{ name: "Qué cambió", value: queCambio }];
  const img = absolutizar(base, ficha.imagen);
  if (img) embed.thumbnail = { url: img };

  return {
    embeds: [embed],
    // Un nombre o un texto con @everyone no debe llamar a nadie.
    allowed_mentions: { parse: [] },
  };
}

// ── Enviar ───────────────────────────────────────────────────────────────────

async function enviar(canal: string, body: Record<string, unknown>, registro: { tipo: string; id: number; clase: ClaseAviso | "prueba"; nota?: string }) {
  if (!enviaDeVerdad()) {
    console.info(`[discord] sin enviar (no es la web publicada): ${registro.clase} de ${registro.tipo} #${registro.id} al canal ${canal}`);
    return;
  }
  const msg = await api<{ id: string }>(`/channels/${canal}/messages`, { method: "POST", body });
  await db.insert(discordAviso).values({
    entidadTipo: registro.tipo,
    entidadId: registro.id,
    clase: registro.clase,
    canalId: canal,
    mensajeId: msg.id,
    nota: registro.nota?.trim() || null,
  });
}

async function avisar(tipo: string, id: number, clase: ClaseAviso, eleccion?: EleccionAviso): Promise<void> {
  // Las hojas e hilos de trama, las plantillas o los elementos no tienen aviso.
  if (!credenciales() || !ES_TIPO_CON_AVISO.has(tipo)) return;
  try {
    // `null` es «no avisar»; sin elegir, el canal que se ofrecería.
    const canal = eleccion?.canal === null ? null : eleccion?.canal || (await canalSugerido(tipo, id));
    if (!canal) return;
    // Lo que los jugadores no ven no se anuncia: un acto de un capítulo aún sin publicar.
    if (!(await esPublica(tipo, id))) return;
    const body = await avisoDe(tipo, id, { clase, nota: eleccion?.nota });
    if (!body) return;
    await enviar(canal, body, { tipo, id, clase, nota: clase === "cambio" ? eleccion?.nota : undefined });
  } catch (e) {
    console.error("[discord] el aviso falló:", e);
  }
}

/** Aviso de estreno: la primera vez que una ficha se publica. */
export async function notificarNuevaPublicacion(tipo: string, id: number, eleccion?: EleccionAviso): Promise<void> {
  await avisar(tipo, id, "estreno", eleccion);
}

/** Aviso de un cambio en una ficha ya publicada, solo si el autor lo pidió al guardar. */
export async function avisarCambio(tipo: string, id: number, eleccion?: EleccionAviso): Promise<void> {
  if (!eleccion?.cambio) return;
  await avisar(tipo, id, "cambio", eleccion);
}

/**
 * Lo que eligió el autor al guardar, del campo `aviso` del formulario. Lo que no
 * tenga la forma esperada se ignora: entonces vale lo de por defecto.
 */
export function eleccionDe(formData: FormData): EleccionAviso | undefined {
  const raw = formData.get("aviso");
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    return eleccionValida(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function eleccionValida(v: unknown): EleccionAviso | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const e: EleccionAviso = {};
  if (o.canal === null) e.canal = null;
  else if (typeof o.canal === "string" && /^\d{5,25}$/.test(o.canal)) e.canal = o.canal;
  if (o.cambio === true) e.cambio = true;
  if (typeof o.nota === "string" && o.nota.trim()) e.nota = o.nota.trim().slice(0, 1000);
  return e;
}

/** Un mensaje de prueba en un canal, a petición del autor desde /admin/discord. Este sí se envía siempre. */
export async function enviarPrueba(canal: string): Promise<void> {
  const body = {
    embeds: [
      {
        author: { name: "🔔 Prueba" },
        title: "El bot de Astralys ya avisa aquí",
        description: "Se puede borrar este mensaje.",
        color: COLOR_DEFECTO,
        footer: { text: "Astralys" },
        timestamp: new Date().toISOString(),
      },
    ],
    allowed_mentions: { parse: [] },
  };
  const msg = await api<{ id: string }>(`/channels/${canal}/messages`, { method: "POST", body });
  await db.insert(discordAviso).values({ entidadTipo: "prueba", entidadId: 0, clase: "prueba", canalId: canal, mensajeId: msg.id });
}
