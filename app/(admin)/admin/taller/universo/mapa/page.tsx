import { asc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { MapaLoader } from "@/components/taller/mapa/MapaLoader";
import { getMapaRelaciones } from "@/lib/queries/mapaRelaciones";
import { RELACIONES } from "@/lib/relaciones/registro";

export const dynamic = "force-dynamic";

/** Universo › Mapa de relaciones (spec §11): el mapa 2D editable del taller. */
export default async function MapaPage() {
  await assertAdmin();
  // Catálogos de los campos de lista de las relaciones, más los tipos de relación entre personajes.
  const nombres = [...new Set(["tipo_relacion", ...RELACIONES.flatMap((r) => r.campos.map((c) => c.catalogo).filter((x): x is string => !!x))])];
  const [mapa, filas] = await Promise.all([
    getMapaRelaciones(),
    db
      .select({ campo: s.catalogos.campo, valor: s.catalogos.valor })
      .from(s.catalogos)
      .where(inArray(s.catalogos.campo, nombres))
      .orderBy(asc(s.catalogos.orden), asc(s.catalogos.valor)),
  ]);
  const catalogos: Record<string, string[]> = {};
  for (const f of filas) (catalogos[f.campo] ??= []).push(f.valor);

  return <MapaLoader {...mapa} catalogos={catalogos} />;
}
