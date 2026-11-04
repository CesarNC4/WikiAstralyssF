import "server-only";
import { asc, eq, getTableColumns, inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { getCalendario, leerFechasDe } from "@/lib/queries/fechas";
import { camposOcultos } from "@/lib/queries/visibilidad";
import { textosFecha } from "@/lib/fechas/formato";
import { TIPOS_SECCION, type ClaseLista } from "./listas";

/**
 * Lee las listas de una ficha (`lib/propuestas/listas.ts`) en una forma uniforme. Lo
 * usan la bandeja, para comparar con lo propuesto, y `pnpm lore ficha`.
 */

export type Cols = Record<string, PgColumn>;
export const cols = (t: PgTable) => getTableColumns(t) as unknown as Cols;

export interface FilaLista {
  id: number;
  nombre: string;
  /** Ficha a la que apunta la fila (personaje, magia), si apunta a alguna. */
  fichaId: number | null;
  valores: Record<string, string>;
  texto: string | null;
  oculto: boolean;
}

/** Las tablas de una ficha con jerarquía, y qué columna las une a ella. */
export const TABLAS_GRUPO: Record<string, { rangos: PgTable; facciones: PgTable; jerarquia: PgTable; historial: PgTable | null; fk: string }> = {
  organizaciones: { rangos: s.orgRangos, facciones: s.orgFacciones, jerarquia: s.orgJerarquia, historial: s.orgHistorial, fk: "organizacionId" },
  familias: { rangos: s.familiaRangos, facciones: s.familiaFacciones, jerarquia: s.familiaJerarquia, historial: null, fk: "familiaId" },
  gremio: { rangos: s.gremioRangos, facciones: s.gremioFacciones, jerarquia: s.gremioJerarquia, historial: s.gremioHistorial, fk: "gremioId" },
};

/** Qué ficha de grupo hay detrás de cada relación de miembros. */
export const GRUPO_DE_RELACION: Record<string, string> = {
  org_jerarquia: "organizaciones",
  familia_jerarquia: "familias",
  gremio_jerarquia: "gremio",
};

async function nombresDePersonajes(ids: (number | null)[]): Promise<Map<number, string>> {
  const unicos = [...new Set(ids.filter((x): x is number => x != null))];
  if (!unicos.length) return new Map();
  const filas = await db.select({ id: s.personajes.id, nombre: s.personajes.nombre }).from(s.personajes).where(inArray(s.personajes.id, unicos));
  return new Map(filas.map((f) => [f.id, f.nombre]));
}

const destacadoDe = (destacado: boolean | null, motivo: string | null) => (destacado ? motivo || "sí" : "");

export async function leerLista(entidad: string, clase: ClaseLista, id: number): Promise<FilaLista[]> {
  const grupo = TABLAS_GRUPO[entidad];
  switch (clase) {
    case "habilidades": {
      const filas = await db.select().from(s.habilidades).where(eq(s.habilidades.personajeId, id)).orderBy(asc(s.habilidades.idHabilidad));
      const ids = filas.map((f) => f.magiaFundamentoId).filter((x): x is number => x != null);
      const magias = ids.length
        ? await db.select({ id: s.magiaFundamentos.id, nombre: s.magiaFundamentos.nombre, sub: s.magiaFundamentos.subcategoria }).from(s.magiaFundamentos).where(inArray(s.magiaFundamentos.id, ids))
        : [];
      const porId = new Map(magias.map((m) => [m.id, m]));
      return filas.map((f) => {
        const m = f.magiaFundamentoId != null ? porId.get(f.magiaFundamentoId) : undefined;
        return {
          id: f.idHabilidad,
          nombre: f.nombre ?? m?.nombre ?? "",
          fichaId: f.magiaFundamentoId,
          valores: { categoria: f.categoria ?? "", tipo: f.tipo ?? "", elemento: m?.sub ?? "" },
          texto: f.descripcion,
          oculto: f.oculto,
        };
      });
    }
    case "rangos":
    case "facciones": {
      if (!grupo) return [];
      const t = clase === "rangos" ? grupo.rangos : grupo.facciones;
      const c = cols(t);
      const filas = (await db.select().from(t).where(eq(c[grupo.fk], id)).orderBy(clase === "rangos" ? asc(c.peso) : asc(c.id))) as Record<string, unknown>[];
      // El peso mayor va arriba, igual que en el formulario.
      if (clase === "rangos") filas.reverse();
      return filas.map((f) => ({
        id: Number(f.id),
        nombre: String(f.nombre),
        fichaId: null,
        valores: (clase === "facciones" ? { color: String(f.color ?? "") } : {}) as Record<string, string>,
        texto: null,
        oculto: false,
      }));
    }
    case "historial": {
      if (!grupo?.historial) return [];
      const c = cols(grupo.historial);
      const filas = (await db.select().from(grupo.historial).where(eq(c[grupo.fk], id)).orderBy(asc(c.orden), asc(c.id))) as Record<string, unknown>[];
      const nombres = await nombresDePersonajes(filas.map((f) => f.personajeId as number | null));
      return filas.map((f) => {
        const pid = (f.personajeId as number | null) ?? null;
        return {
          id: Number(f.id),
          nombre: (pid != null ? nombres.get(pid) : null) ?? String(f.nombre),
          fichaId: pid,
          valores: {
            rol: String(f.rol ?? ""),
            periodo: String(f.periodo ?? ""),
            estado: String(f.estado ?? ""),
            destacado: destacadoDe(f.destacado as boolean | null, f.motivoDestacado as string | null),
            notas: String(f.notas ?? ""),
          },
          texto: null,
          oculto: Boolean(f.oculto),
        };
      });
    }
    case "arbol": {
      const filas = await db.select().from(s.familiaArbol).where(eq(s.familiaArbol.familiaId, id)).orderBy(asc(s.familiaArbol.generacion), asc(s.familiaArbol.id));
      const nombres = await nombresDePersonajes(filas.map((f) => f.personajeId));
      const nombreDe = (f: (typeof filas)[number]) => (f.personajeId != null ? nombres.get(f.personajeId) : null) ?? f.nombre;
      const porId = new Map(filas.map((f) => [f.id, nombreDe(f)]));
      return filas.map((f) => ({
        id: f.id,
        nombre: nombreDe(f),
        fichaId: f.personajeId,
        valores: {
          generacion: f.generacion == null ? "" : String(f.generacion),
          padre: (f.padreId != null && porId.get(f.padreId)) || "",
          madre: (f.madreId != null && porId.get(f.madreId)) || "",
          estado: f.estado ?? "",
          destacado: destacadoDe(f.destacado, f.motivoDestacado),
          notas: f.notas ?? "",
        },
        texto: null,
        oculto: f.oculto,
      }));
    }
    case "secciones": {
      const filas = await db.select().from(s.paginaSecciones).where(eq(s.paginaSecciones.paginaId, id)).orderBy(asc(s.paginaSecciones.orden));
      return filas.map((f) => ({
        id: f.id,
        nombre: f.titulo ?? "",
        fichaId: null,
        valores: { tipo: TIPOS_SECCION.find((t) => t.valor === f.tipo)?.label ?? f.tipo },
        texto: f.contenido,
        oculto: f.estadoPublicacion !== "publicado",
      }));
    }
    case "fragmentos": {
      const filas = await db.select().from(s.actoFragmento).where(eq(s.actoFragmento.actoId, id)).orderBy(asc(s.actoFragmento.orden));
      if (!filas.length) return [];
      const [nombres, cal] = await Promise.all([nombresDePersonajes(filas.map((f) => f.personajeId)), getCalendario()]);
      return Promise.all(
        filas.map(async (f) => {
          const [fechas, ocultos] = await Promise.all([leerFechasDe("fragmentos", f.id), camposOcultos("fragmentos", f.id)]);
          const fecha = fechas.principal;
          return {
            id: f.id,
            nombre: f.titulo ?? "",
            fichaId: f.personajeId,
            valores: {
              pov: f.personajeId != null ? (nombres.get(f.personajeId) ?? "") : "",
              enlace: f.enlace ?? "",
              fecha: fecha ? textosFecha(cal, fecha.fecha).absoluto : "",
            },
            texto: null,
            oculto: ocultos.has("personajeId") || Boolean(fecha?.oculto),
          };
        }),
      );
    }
  }
}

/** Rango, facción y apodo de los miembros de un grupo, por id de fila. */
export async function extrasDeMiembros(relId: string, grupoId: number): Promise<Map<number, Record<string, string>>> {
  const entidad = GRUPO_DE_RELACION[relId];
  const grupo = entidad ? TABLAS_GRUPO[entidad] : undefined;
  if (!grupo) return new Map();
  const c = cols(grupo.jerarquia);
  const [filas, rangos, facciones] = await Promise.all([
    db.select().from(grupo.jerarquia).where(eq(c[grupo.fk], grupoId)) as unknown as Promise<Record<string, unknown>[]>,
    leerLista(entidad, "rangos", grupoId),
    leerLista(entidad, "facciones", grupoId),
  ]);
  const rango = new Map(rangos.map((r) => [r.id, r.nombre]));
  const faccion = new Map(facciones.map((r) => [r.id, r.nombre]));
  return new Map(
    filas.map((f) => [
      Number(f.id),
      {
        rango: rango.get(f.rangoId as number) ?? "",
        faccion: faccion.get(f.faccionId as number) ?? "",
        tituloApodo: String(f.tituloApodo ?? ""),
      },
    ]),
  );
}
