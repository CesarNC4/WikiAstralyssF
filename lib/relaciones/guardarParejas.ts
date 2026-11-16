import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { db } from "@/db/client";
import * as s from "@/db/schema";
import { emparejar, mismosValores, reflejar, valoresDe, vistaDe, type Pareja, type ValoresRelacion } from "./parejas";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Fila = typeof s.relaciones.$inferSelect;

/** Una relación tal como llega del formulario del personaje. */
export interface RelacionDeseada {
  personajeRelacionadoId: number | null;
  nombreExterno: string | null;
  tipoRelacion: string | null;
  subtipoRelacion: string | null;
  afecto: string | null;
  afectoReciproco: string | null;
  descripcion: string | null;
}

const nulo = (v: string) => (v === "" ? null : v);
const columnas = (v: ValoresRelacion) => ({
  tipoRelacion: nulo(v.tipoRelacion),
  subtipoRelacion: nulo(v.subtipoRelacion),
  afecto: nulo(v.afecto),
  afectoReciproco: nulo(v.afectoReciproco),
  descripcion: nulo(v.descripcion),
});

/**
 * Guarda las relaciones de un personaje con otros personajes y escribe la otra mitad de
 * cada una en la ficha del otro: quitar a alguien aquí lo quita de las dos fichas, y
 * cambiar el tipo cambia también el de la vuelta, con el término inverso.
 *
 * Va por diferencias, con las filas de los dos lados:
 * - Lo que no cambia no se toca. Una vuelta que no cuadra (de antes de esto) se queda como
 *   está hasta que se edite esa relación en alguna de las dos fichas.
 * - Lo que el formulario no conocía (`conocidas`: los personajes que tenía al abrirse o al
 *   guardar por última vez) no se borra: se creó desde la otra ficha mientras tanto.
 * - El candado de cada fila se conserva; una fila nueva toma el de su pareja.
 *
 * Las relaciones con un nombre suelto (sin ficha) no tienen otra mitad: esas se reescriben.
 */
export async function guardarRelaciones(
  tx: Tx,
  personajeId: number,
  deseadas: RelacionDeseada[],
  conocidas: number[],
): Promise<void> {
  // ── Nombres sueltos: sin vuelta, se borran y se reinsertan conservando el candado.
  const sueltas = await tx
    .select()
    .from(s.relaciones)
    .where(and(eq(s.relaciones.personajeId, personajeId), isNull(s.relaciones.personajeRelacionadoId)));
  const sueltasOcultas = new Set(sueltas.filter((f) => f.oculto).map((f) => (f.nombreExterno ?? "").trim()));
  if (sueltas.length) await tx.delete(s.relaciones).where(inArray(s.relaciones.idRr, sueltas.map((f) => f.idRr)));
  const nuevasSueltas = deseadas.filter((d) => !d.personajeRelacionadoId && (d.nombreExterno ?? "").trim());
  if (nuevasSueltas.length) {
    await tx.insert(s.relaciones).values(
      nuevasSueltas.map((d) => ({
        personajeId,
        nombreExterno: d.nombreExterno!.trim(),
        ...columnas(valoresDe(d)),
        oculto: sueltasOcultas.has(d.nombreExterno!.trim()),
      })),
    );
  }

  // ── Con otros personajes: las dos mitades.
  const filas = await tx
    .select()
    .from(s.relaciones)
    .where(or(eq(s.relaciones.personajeId, personajeId), eq(s.relaciones.personajeRelacionadoId, personajeId)));
  const propias = new Map<number, Fila[]>();
  const vueltas = new Map<number, Fila[]>();
  for (const f of filas) {
    if (f.personajeId === personajeId && f.personajeRelacionadoId != null) {
      if (f.personajeRelacionadoId === personajeId) continue; // consigo mismo: no tiene otra mitad
      propias.set(f.personajeRelacionadoId, [...(propias.get(f.personajeRelacionadoId) ?? []), f]);
    } else if (f.personajeRelacionadoId === personajeId && f.personajeId != null) {
      vueltas.set(f.personajeId, [...(vueltas.get(f.personajeId) ?? []), f]);
    }
  }
  const porOtro = new Map<number, ValoresRelacion[]>();
  for (const d of deseadas) {
    const otro = d.personajeRelacionadoId;
    if (!otro || otro === personajeId) continue;
    porOtro.set(otro, [...(porOtro.get(otro) ?? []), valoresDe(d)]);
  }

  // El matiz de un parentesco depende del género de quien queda descrito.
  const implicados = [...new Set([personajeId, ...propias.keys(), ...vueltas.keys(), ...porOtro.keys()])];
  const generos = new Map(
    (await tx.select({ id: s.personajes.id, genero: s.personajes.genero }).from(s.personajes).where(inArray(s.personajes.id, implicados))).map(
      (p) => [p.id, p.genero],
    ),
  );
  const miGenero = generos.get(personajeId);
  const sabidas = new Set(conocidas);

  for (const otro of implicados) {
    if (otro === personajeId) continue;
    const parejas = emparejar(propias.get(otro) ?? [], vueltas.get(otro) ?? []);
    const quiere = porOtro.get(otro) ?? [];
    const vistas = parejas.map((p) => vistaDe(p, generos.get(otro)));

    // Cada relación deseada se casa con una pareja: primero la idéntica (no ha cambiado),
    // luego la del mismo tipo (se ha editado) y al final cualquiera, por orden.
    const asignada = new Map<number, number>(); // índice deseada → índice pareja
    const libre = (j: number) => ![...asignada.values()].includes(j);
    const casar = (criterio: (d: ValoresRelacion, v: ValoresRelacion) => boolean) =>
      quiere.forEach((d, i) => {
        if (asignada.has(i)) return;
        const j = vistas.findIndex((v, k) => libre(k) && criterio(d, v));
        if (j >= 0) asignada.set(i, j);
      });
    casar(mismosValores);
    casar((d, v) => d.tipoRelacion === v.tipoRelacion);
    casar(() => true);

    for (const [i, d] of quiere.entries()) {
      const j = asignada.get(i);
      const pareja: Pareja<Fila> = j === undefined ? {} : parejas[j];
      const cambia = j === undefined || !mismosValores(d, vistas[j]);
      const oculto = pareja.propia?.oculto ?? pareja.vuelta?.oculto ?? false;

      if (!pareja.propia) {
        await tx.insert(s.relaciones).values({ personajeId, personajeRelacionadoId: otro, ...columnas(d), oculto });
      } else if (!mismosValores(d, valoresDe(pareja.propia))) {
        await tx.update(s.relaciones).set(columnas(d)).where(eq(s.relaciones.idRr, pareja.propia.idRr));
      }

      const vuelta = columnas(reflejar(d, miGenero));
      if (!pareja.vuelta) {
        await tx.insert(s.relaciones).values({ personajeId: otro, personajeRelacionadoId: personajeId, ...vuelta, oculto });
      } else if (cambia) {
        await tx.update(s.relaciones).set(vuelta).where(eq(s.relaciones.idRr, pareja.vuelta.idRr));
      }
    }

    // Lo que ya no está: fuera las dos mitades, si el formulario sabía de ellas.
    if (!sabidas.has(otro)) continue;
    const casadas = new Set(asignada.values());
    const sobran = parejas.filter((_, j) => !casadas.has(j)).flatMap((p) => [p.propia?.idRr, p.vuelta?.idRr]);
    const ids = sobran.filter((id): id is number => id != null);
    if (ids.length) await tx.delete(s.relaciones).where(inArray(s.relaciones.idRr, ids));
  }
}
