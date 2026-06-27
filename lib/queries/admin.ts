import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { EstadoPublicacion } from "@/db/schema/enums";

/**
 * Origen único de las entidades del dashboard (anti-drift): conteos, actividad
 * reciente y navegación se derivan todos de esta lista. Para añadir una entidad
 * al panel basta con sumar una fila aquí.
 *
 * `table`/`nameCol` son constantes del código (no entrada de usuario): es seguro
 * interpolarlas en SQL crudo para construir el UNION dinámico.
 */
interface DashEntity {
  key: string;
  label: string;
  /** Tabla SQL (snake_case). */
  table: string;
  /** Columna que actúa como nombre visible. */
  nameCol: string;
  /** Ruta del gestor en el admin. */
  href: string;
  /** Icono (lucide) — coincide con el sidebar/config de entidad. */
  icon: string;
}

const DASH_ENTITIES: DashEntity[] = [
  { key: "personajes", label: "Personajes", table: "personajes", nameCol: "nombre", href: "/admin/personajes", icon: "Users" },
  { key: "naciones", label: "Naciones", table: "naciones", nameCol: "nombre", href: "/admin/naciones", icon: "Globe2" },
  { key: "organizaciones", label: "Organizaciones", table: "organizaciones", nameCol: "nombre", href: "/admin/organizaciones", icon: "Shield" },
  { key: "familias", label: "Familias", table: "familias", nameCol: "nombre", href: "/admin/familias", icon: "Users2" },
  { key: "razas", label: "Razas", table: "razas", nameCol: "nombre", href: "/admin/razas", icon: "Rabbit" },
  { key: "bestias", label: "Bestias", table: "bestias", nameCol: "nombre", href: "/admin/bestias", icon: "PawPrint" },
  { key: "minerales", label: "Minerales", table: "minerales", nameCol: "nombre", href: "/admin/minerales", icon: "Gem" },
  { key: "conceptos", label: "Conceptos", table: "conceptos", nameCol: "nombre", href: "/admin/conceptos", icon: "Lightbulb" },
  { key: "magia", label: "Magia", table: "magia_fundamentos", nameCol: "nombre", href: "/admin/magia", icon: "Sparkles" },
  { key: "misiones", label: "Misiones", table: "misiones", nameCol: "nombre", href: "/admin/misiones", icon: "Swords" },
  { key: "timeline", label: "Cronología", table: "timeline_eventos", nameCol: "titulo", href: "/admin/timeline", icon: "Clock" },
  { key: "demonios", label: "Lords demonio", table: "lord_demonio", nameCol: "nombre", href: "/admin/demonios", icon: "Flame" },
  { key: "artefactos", label: "Armas y Artefactos", table: "armas_artefactos", nameCol: "nombre", href: "/admin/artefactos", icon: "Sword" },
  { key: "economia", label: "Sistema monetario", table: "sistema_monetario", nameCol: "nombre", href: "/admin/economia", icon: "Coins" },
  { key: "lore", label: "Lore", table: "paginas_lore", nameCol: "titulo", href: "/admin/lore", icon: "ScrollText" },
];

export interface AdminStat {
  key: string;
  label: string;
  href: string;
  icon: string;
  total: number;
  publicados: number;
  borradores: number;
  ocultos: number;
}

/**
 * Estadísticas del dashboard en UNA sola consulta (UNION ALL) en lugar de un
 * round-trip por entidad. Excluye filas en papelera (`eliminado_en`) en TODAS
 * las entidades y desglosa los tres estados de publicación.
 */
export async function getAdminStats(): Promise<AdminStat[]> {
  const parts = DASH_ENTITIES.map((e) =>
    sql.raw(
      `select '${e.key}' as key, ` +
        `count(*)::int as total, ` +
        `count(*) filter (where estado_publicacion = 'publicado')::int as publicados, ` +
        `count(*) filter (where estado_publicacion = 'borrador')::int as borradores, ` +
        `count(*) filter (where estado_publicacion = 'oculto')::int as ocultos ` +
        `from ${e.table} where eliminado_en is null`,
    ),
  );

  const rows = (await db.execute(
    sql.join(parts, sql.raw(" union all ")),
  )) as unknown as { key: string; total: number; publicados: number; borradores: number; ocultos: number }[];

  const byKey = new Map(rows.map((r) => [r.key, r]));

  // Preserva el orden de DASH_ENTITIES (el de UNION ALL no está garantizado).
  return DASH_ENTITIES.map((e) => {
    const r = byKey.get(e.key);
    return {
      key: e.key,
      label: e.label,
      href: e.href,
      icon: e.icon,
      total: Number(r?.total ?? 0),
      publicados: Number(r?.publicados ?? 0),
      borradores: Number(r?.borradores ?? 0),
      ocultos: Number(r?.ocultos ?? 0),
    };
  });
}

export interface RecentItem {
  key: string;
  label: string;
  /** Enlace directo al formulario de edición. */
  href: string;
  nombre: string;
  estado: EstadoPublicacion;
  actualizadoEn: Date;
}

/**
 * Últimas entradas editadas en todo el panel (cualquier entidad), para el bloque
 * de "Actividad reciente" del dashboard. Excluye papelera.
 */
export async function getRecentActivity(limit = 8): Promise<RecentItem[]> {
  const meta = new Map(DASH_ENTITIES.map((e) => [e.key, e]));
  const parts = DASH_ENTITIES.map((e) =>
    sql.raw(
      `select '${e.key}' as key, id, ${e.nameCol} as nombre, ` +
        `estado_publicacion as estado, actualizado_en ` +
        `from ${e.table} where eliminado_en is null`,
    ),
  );

  const rows = (await db.execute(
    sql`${sql.join(parts, sql.raw(" union all "))} order by actualizado_en desc nulls last limit ${limit}`,
  )) as unknown as { key: string; id: number; nombre: string | null; estado: EstadoPublicacion; actualizado_en: Date }[];

  return rows.map((r) => {
    const e = meta.get(r.key)!;
    return {
      key: r.key,
      label: e.label,
      href: `${e.href}/${r.id}/editar`,
      nombre: r.nombre?.trim() || `#${r.id}`,
      estado: r.estado,
      actualizadoEn: new Date(r.actualizado_en),
    };
  });
}
