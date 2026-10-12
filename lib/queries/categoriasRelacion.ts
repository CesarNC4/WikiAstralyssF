import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { aCategoria, CAMPO_CATEGORIA, type CategoriaRelacion, type TipoRelacionAsignado } from "@/lib/relaciones/categorias";

/** Las categorías de relación y la asignación de cada tipo (spec §11). */
export async function getCategoriasRelacion(): Promise<{ categorias: CategoriaRelacion[]; tipos: TipoRelacionAsignado[] }> {
  const [cats, tipos] = await Promise.all([
    db
      .select({ id: s.catalogos.id, valor: s.catalogos.valor, meta: s.catalogos.meta })
      .from(s.catalogos)
      .where(eq(s.catalogos.campo, CAMPO_CATEGORIA))
      .orderBy(asc(s.catalogos.orden), asc(s.catalogos.id)),
    db
      .select({ id: s.catalogos.id, valor: s.catalogos.valor, meta: s.catalogos.meta })
      .from(s.catalogos)
      .where(eq(s.catalogos.campo, "tipo_relacion"))
      .orderBy(asc(s.catalogos.orden), asc(s.catalogos.valor)),
  ]);
  const categorias = cats.map(aCategoria);
  const existe = new Set(categorias.map((c) => c.id));
  return {
    categorias,
    tipos: tipos.map((t) => {
      const cid = Number(t.meta?.categoriaId);
      return { id: t.id, valor: t.valor, categoriaId: existe.has(cid) ? cid : null };
    }),
  };
}
