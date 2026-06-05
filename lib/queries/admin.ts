import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";

const TABLES = {
  Personajes: s.personajes,
  Naciones: s.naciones,
  Organizaciones: s.organizaciones,
  Familias: s.familias,
  Razas: s.razas,
  Bestias: s.bestias,
  Minerales: s.minerales,
  Conceptos: s.conceptos,
  Magia: s.magiaFundamentos,
  Misiones: s.misiones,
  Lore: s.paginasLore,
} as const;

export interface AdminStat {
  label: string;
  total: number;
  visibles: number;
}

/** Estadísticas para el dashboard del admin (incluye no publicados). */
export async function getAdminStats(): Promise<AdminStat[]> {
  const entries = Object.entries(TABLES);
  return Promise.all(
    entries.map(async ([label, table]) => {
      const [t] = await db.select({ c: count() }).from(table);
      const [v] = await db.select({ c: count() }).from(table).where(eq(table.estadoPublicacion, "publicado"));
      return { label, total: t?.c ?? 0, visibles: v?.c ?? 0 };
    }),
  );
}
