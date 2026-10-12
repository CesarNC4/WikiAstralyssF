import { rolesDe, textosFecha } from "@/lib/fechas";
import { getCalendario, leerFechasDe } from "@/lib/queries/fechas";
import { ConmutadorFechas, EdadLectura, FechaTexto } from "./Lectura";

/**
 * Bloque "Fechas" de una ficha pública (spec §13): las fechas de sus roles en la
 * lectura del visitante y, en los personajes, la edad según el momento de
 * lectura. Si no hay nada que enseñar no pinta nada.
 *
 * `edadTexto` es el respaldo manual de los personajes sin nacimiento
 * ("Milenaria", "Desconocida").
 */
export async function FechasDeFicha({
  entidad,
  id,
  edadTexto,
  className,
}: {
  entidad: string;
  id: number;
  edadTexto?: string | null;
  className?: string;
}) {
  const roles = rolesDe(entidad);
  if (roles.length === 0) return null;
  const datos = await Promise.all([getCalendario(), leerFechasDe(entidad, id)]).catch(() => null);
  if (!datos) return null;
  const [cal, fechas] = datos;

  const filas: { label: string; valor: React.ReactNode }[] = [];
  for (const r of roles) {
    const f = fechas[r.rol];
    if (f) filas.push({ label: r.etiqueta, valor: <FechaTexto t={textosFecha(cal, f.fecha)} /> });
  }
  if (entidad === "personajes") {
    const nac = fechas.nacimiento;
    if (nac) {
      filas.push({ label: "Edad", valor: <EdadLectura cal={cal} nacimiento={nac.claveIni} muerte={fechas.muerte?.claveIni ?? null} /> });
    } else if (edadTexto?.trim()) {
      filas.push({ label: "Edad", valor: edadTexto });
    }
  }
  if (filas.length === 0) return null;

  // Solo hace falta el conmutador si alguna fecha cambia según la lectura.
  const conFechas = filas.some((f) => f.label !== "Edad") || !!fechas.nacimiento;

  return (
    <section className={className ?? "mb-8"}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-wider text-fg-muted">Fechas</h2>
        {conFechas && <ConmutadorFechas />}
      </div>
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border-base bg-border-base sm:grid-cols-3">
        {filas.map((f) => (
          <div key={f.label} className="bg-surface px-4 py-3">
            <dt className="text-[11px] uppercase tracking-wider text-fg-muted">{f.label}</dt>
            <dd className="mt-0.5 text-sm text-fg">{f.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
