/**
 * Lee de la base todo lo que comprueban las reglas (docs/area-ia.md, Fase 6).
 * SOLO LEE. Se trae la wiki entera de golpe: son pocos miles de filas, y comparar en
 * memoria evita decenas de consultas por ficha.
 */
import { getTableColumns, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { USOS_DE_CATALOGO } from "@/lib/admin/catalogosMeta";
import { textosFecha } from "@/lib/fechas/formato";
import { moldeDe } from "@/lib/propuestas/moldes";
import { aFechaGuardada, getCalendario } from "@/lib/queries/fechas";
import { camposOcultosDe } from "@/lib/queries/visibilidad";
import { RELACIONES } from "@/lib/relaciones/registro";
import { ENTIDAD_INFO, tablaDe } from "@/lib/relaciones/tablas";
import type { AristaFoto, FichaFoto, Foto, TextoFicha } from "./tipos";

type Fila = Record<string, unknown>;
type Cols = Record<string, PgColumn>;
const cols = (t: PgTable) => getTableColumns(t) as unknown as Cols;

/** Hojas e hilos no tienen ficha pública, pero se revisan igual. */
const TABLAS: Record<string, { tabla: PgTable; label: string; estadoSql?: ReturnType<typeof sql>; nuncaPublica?: boolean }> = {
  ...Object.fromEntries(Object.entries(ENTIDAD_INFO).map(([k, i]) => [k, { tabla: i.tabla, label: i.label, estadoSql: i.estadoSql }])),
  hojas: { tabla: s.tramaHojas, label: "titulo", nuncaPublica: true },
  hilos: { tabla: s.hiloNarrativo, label: "nombre", nuncaPublica: true },
};

/** Datos de una línea que no son texto del mundo. */
const NO_ES_TEXTO = /^(slug|color|url|discordUrl|enlace|imagenUrl|bannerUrl)$/;

/** Un mismo catálogo guarda claves en minúsculas en estos (ver scripts/verificar-catalogos.mjs). */
const CLAVE_EN_MINUSCULAS = new Set(["lore_seccion_tipo", "vinculo_entidad_elemento"]);

function textosDe(entidad: string, fila: Fila, ocultos: Set<string>): TextoFicha[] {
  const molde = moldeDe(entidad);
  if (!molde) return [];
  const out: TextoFicha[] = [];
  for (const c of molde.campos) {
    if (c.name === molde.nombre || (c.tipo !== "largo" && c.tipo !== "corto") || NO_ES_TEXTO.test(c.name)) continue;
    const v = fila[c.name];
    if (typeof v !== "string" || !v.trim()) continue;
    out.push({ campo: c.name, rotulo: c.label, texto: v, oculto: ocultos.has(c.name), privado: /no se publica/i.test(c.hint ?? ""), largo: c.tipo === "largo" });
  }
  return out;
}

async function leerFichas(): Promise<FichaFoto[]> {
  const out: FichaFoto[] = [];
  for (const [entidad, def] of Object.entries(TABLAS)) {
    const c = cols(def.tabla);
    const filas = (await db
      .select({ ...c, _publicado: def.estadoSql ?? (c.estadoPublicacion ? sql`${c.estadoPublicacion}` : sql`'publicado'`) })
      .from(def.tabla)) as unknown as (Fila & { _publicado: string })[];
    const pk = c.id ? "id" : Object.keys(c)[0];
    const ocultos = await camposOcultosDe(entidad, filas.map((f) => Number(f[pk])));
    for (const f of filas) {
      const id = Number(f[pk]);
      const enPapelera = Boolean(f.eliminadoEn);
      const ocultosFicha = ocultos.get(id) ?? new Set<string>();
      const { _publicado, ...valores } = f;
      out.push({
        entidad,
        id,
        nombre: String(f[def.label] ?? `(sin título) #${id}`),
        estado: typeof f.estadoPublicacion === "string" ? f.estadoPublicacion : c.estadoPublicacion ? null : def.estadoSql ? _publicado : null,
        enPapelera,
        publica: !def.nuncaPublica && !enPapelera && _publicado === "publicado",
        valores,
        textos: textosDe(entidad, f, ocultosFicha),
        ocultos: ocultosFicha,
      });
    }
  }
  return out;
}

async function leerAristas(fichas: FichaFoto[]): Promise<{ aristas: AristaFoto[]; raros: Foto["vinculosRaros"] }> {
  const aristas: AristaFoto[] = [];
  const vinculos = await db.select().from(s.vinculo);
  const conocidas = new Set(RELACIONES.filter((r) => r.medio === "vinculo").map((r) => r.relacion));
  const texto = (v: unknown) => (v == null ? "" : String(v));

  for (const rel of RELACIONES) {
    if (rel.medio === "tabla") {
      const def = tablaDe(rel.id);
      if (!def) continue;
      const filas = (await db.select().from(def.tabla)) as unknown as Fila[];
      for (const f of filas) {
        if (def.filtroA && f[def.filtroA.col] !== def.filtroA.valor) continue;
        if (f[def.colA] == null) continue;
        aristas.push({
          relId: rel.id,
          filaId: Number(f[def.pk]),
          a: { entidad: rel.a.entidad, id: Number(f[def.colA]) },
          b: f[def.colB] != null ? { entidad: rel.b.entidad, id: Number(f[def.colB]) } : null,
          nombreLibre: def.colLibre ? ((f[def.colLibre] as string | null) ?? null) : null,
          campos: Object.fromEntries(rel.campos.map((c) => [c.name, texto(f[c.name])])),
          oculto: Boolean(f.oculto),
        });
      }
    } else if (rel.medio === "vinculo") {
      for (const v of vinculos) {
        if (v.relacion !== rel.relacion || (rel.a.entidad !== "*" && v.origenTipo !== rel.a.entidad)) continue;
        aristas.push({
          relId: rel.id,
          filaId: v.id,
          a: { entidad: v.origenTipo, id: v.origenId },
          b: { entidad: v.destinoTipo, id: v.destinoId },
          nombreLibre: null,
          campos: Object.fromEntries(rel.campos.map((c) => [c.name, texto((v as unknown as Fila)[c.name])])),
          oculto: v.oculto,
        });
      }
    } else if (rel.columna) {
      for (const f of fichas) {
        if (f.entidad !== rel.a.entidad || f.valores[rel.columna] == null) continue;
        aristas.push({
          relId: rel.id,
          filaId: f.id,
          a: { entidad: f.entidad, id: f.id },
          b: { entidad: rel.b.entidad, id: Number(f.valores[rel.columna]) },
          nombreLibre: null,
          campos: {},
          oculto: f.ocultos.has(rel.columna),
        });
      }
    }
  }
  const raros = vinculos.filter((v) => !conocidas.has(v.relacion ?? "")).map((v) => ({ filaId: v.id, relacion: v.relacion }));
  return { aristas, raros };
}

async function leerFueraDeCatalogo(): Promise<Foto["fueraDeCatalogo"]> {
  const columnas = (await db.execute(sql`
    select table_name t, column_name c, data_type d from information_schema.columns where table_schema = 'public'
  `)) as unknown as { t: string; c: string; d: string }[];
  const tipo = new Map(columnas.map((c) => [`${c.t}.${c.c}`, c.d]));
  const out: Foto["fueraDeCatalogo"] = [];
  for (const [catalogo, usos] of Object.entries(USOS_DE_CATALOGO)) {
    for (const [tabla, columna] of usos) {
      const dato = tipo.get(`${tabla}.${columna}`);
      if (!dato) continue;
      const col = sql.identifier(columna);
      const valor = dato === "ARRAY" ? sql`unnest(t.${col})` : sql`t.${col}::text`;
      const filas = (await db.execute(sql`
        select v, count(*)::int n from (select ${valor} as v from ${sql.identifier(tabla)} t where t.${col} is not null) x
        where v <> '' and not exists (
          select 1 from catalogos c where c.campo = ${catalogo}
            and ${CLAVE_EN_MINUSCULAS.has(catalogo) ? sql`lower(c.valor) = lower(v)` : sql`c.valor = v`}
        ) group by 1
      `)) as unknown as { v: string; n: number }[];
      for (const f of filas) out.push({ tabla, columna, catalogo, valor: f.v, n: f.n });
    }
  }
  return out;
}

export async function leerFoto(): Promise<Foto> {
  const calendario = await getCalendario();
  const fichas = await leerFichas();
  const { aristas, raros } = await leerAristas(fichas);

  // Lo que el molde no ve: las secciones de lore y las notas de autor también son texto.
  const porClave = new Map(fichas.map((f) => [`${f.entidad}#${f.id}`, f]));
  const secciones = await db.select().from(s.paginaSecciones);
  for (const sec of secciones) {
    if (!sec.contenido?.trim()) continue;
    porClave.get(`lore#${sec.paginaId}`)?.textos.push({
      campo: `seccion:${sec.id}`,
      rotulo: `Sección: ${sec.titulo ?? "(sin título)"}`,
      texto: sec.contenido,
      oculto: sec.estadoPublicacion !== "publicado",
      privado: false,
      largo: true,
    });
  }
  const notas = await db.select().from(s.notaPrivada);
  for (const n of notas) {
    porClave.get(`${n.entidadTipo}#${n.entidadId}`)?.textos.push({ campo: "notasDeAutor", rotulo: "Notas de autor", texto: n.contenido, oculto: true, privado: true, largo: true });
  }

  const [filasFecha, arbol, fragmentos, fases, marcas, galeria, fueraDeCatalogo] = await Promise.all([
    db.select().from(s.fechaLore),
    db.select({ id: s.familiaArbol.id, familiaId: s.familiaArbol.familiaId, nombre: s.familiaArbol.nombre, personajeId: s.familiaArbol.personajeId, padreId: s.familiaArbol.padreId, madreId: s.familiaArbol.madreId }).from(s.familiaArbol),
    db.select({ id: s.actoFragmento.id, actoId: s.actoFragmento.actoId, personajeId: s.actoFragmento.personajeId, titulo: s.actoFragmento.titulo }).from(s.actoFragmento),
    db.select({ id: s.estructuraFase.id, plantillaId: s.estructuraFase.plantillaId }).from(s.estructuraFase),
    db.select({ filaId: s.campoVisibilidad.id, entidad: s.campoVisibilidad.entidadTipo, id: s.campoVisibilidad.entidadId }).from(s.campoVisibilidad),
    db.select({ filaId: s.entidadMedia.id, entidad: s.entidadMedia.entidadTipo, id: s.entidadMedia.entidadId }).from(s.entidadMedia),
    leerFueraDeCatalogo(),
  ]);

  return {
    fichas,
    aristas,
    fechas: filasFecha.map((f) => {
      const g = aFechaGuardada(f);
      return { entidad: f.entidadTipo, id: f.entidadId, rol: f.rol, fecha: g.fecha, claveIni: g.claveIni, claveFin: g.claveFin, oculto: g.oculto, texto: textosFecha(calendario, g.fecha).absoluto };
    }),
    arbol,
    fragmentos,
    fases,
    polimorficas: [
      ...notas.map((n) => ({ tabla: "Una nota de autor", filaId: n.id, entidad: n.entidadTipo, id: n.entidadId })),
      ...marcas.map((m) => ({ tabla: "Una marca de visibilidad", ...m })),
      ...galeria.map((g) => ({ tabla: "Una imagen de galería", ...g })),
    ],
    vinculosRaros: raros,
    fueraDeCatalogo,
    calendario,
  };
}
