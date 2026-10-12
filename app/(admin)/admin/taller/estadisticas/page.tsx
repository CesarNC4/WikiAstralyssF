import Link from "next/link";
import { assertAdmin } from "@/lib/actions/auth";
import { TallerCabecera } from "@/components/taller/TallerShell";
import { getLugaresUsados, getTallerIndice, getTramaIndice } from "@/lib/queries/taller";

export const dynamic = "force-dynamic";

const ESTADOS = ["publicado", "borrador", "oculto"] as const;
const COLOR: Record<(typeof ESTADOS)[number], string> = {
  publicado: "bg-success",
  borrador: "bg-fg-muted",
  oculto: "bg-warning",
};

/**
 * Estadísticas del taller (spec §9): avance de publicación por libro,
 * personajes (apariciones, POV y quién lleva más tiempo sin salir), lugares
 * más usados e hilos abiertos y cerrados. Cuenta lo que no está en la papelera.
 */
export default async function EstadisticasPage() {
  await assertAdmin();
  const [indice, trama] = await Promise.all([getTallerIndice(), getTramaIndice()]);
  const lugares = await getLugaresUsados(indice.actos.map((a) => a.id));

  // Secuencia global de actos: libros en su orden, capítulos en el suyo, actos por posición.
  const capOrden = new Map<number, number>();
  let k = 0;
  for (const libro of indice.libros)
    for (const c of indice.capitulos.filter((x) => (x.libro ?? "") === libro).sort((a, b) => a.orden - b.orden || a.id - b.id))
      capOrden.set(c.id, k++);
  const secuencia = indice.actos
    .filter((a) => a.capituloId != null && capOrden.has(a.capituloId))
    .sort((a, b) => capOrden.get(a.capituloId!)! - capOrden.get(b.capituloId!)! || a.posicion - b.posicion);

  const personajes = indice.personajes
    .map((p) => {
      const indices = secuencia.flatMap((a, i) => (a.personajes.includes(p.id) ? [i] : []));
      return {
        ...p,
        apariciones: indices.length,
        pov: secuencia.filter((a) => a.pov.some((x) => x.id === p.id)).length,
        sinSalir: indices.length ? secuencia.length - 1 - indices[indices.length - 1] : null,
      };
    })
    .filter((p) => p.apariciones > 0);
  const masApariciones = [...personajes].sort((a, b) => b.apariciones - a.apariciones).slice(0, 12);
  const masAusentes = [...personajes].sort((a, b) => (b.sinSalir ?? 0) - (a.sinSalir ?? 0)).slice(0, 8);
  const maxAp = Math.max(1, ...masApariciones.map((p) => p.apariciones));
  const maxLugar = Math.max(1, ...lugares.map((l) => l.actos));

  const abiertos = trama.hilos.filter((h) => h.abierto && !h.cerrado);
  const cerrados = trama.hilos.filter((h) => h.cerrado);
  const sinAbrir = trama.hilos.filter((h) => !h.abierto && !h.cerrado);

  return (
    <>
      <TallerCabecera titulo="Estadísticas" />
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {/* ── Avance de publicación ─────────────────────────────────── */}
        <Bloque titulo="Avance de publicación">
          <div className="mb-2 flex gap-4 text-xs text-fg-muted">
            {ESTADOS.map((e) => (
              <span key={e} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${COLOR[e]}`} /> {e.charAt(0).toUpperCase() + e.slice(1)}
              </span>
            ))}
          </div>
          {indice.libros.map((libro) => {
            const caps = indice.capitulos.filter((c) => (c.libro ?? "") === libro);
            const ids = new Set(caps.map((c) => c.id));
            const actos = indice.actos.filter((a) => a.capituloId != null && ids.has(a.capituloId));
            return (
              <div key={libro || "_"} className="mb-4">
                <p className="mb-1 font-display text-sm text-accent">{libro || "Sin libro"}</p>
                <Barra etiqueta="Capítulos" conteo={ESTADOS.map((e) => caps.filter((c) => c.estadoPublicacion === e).length)} />
                <Barra etiqueta="Actos" conteo={ESTADOS.map((e) => actos.filter((a) => a.estadoPublicacion === e).length)} />
              </div>
            );
          })}
          {indice.libros.length === 0 && <Vacio />}
        </Bloque>

        <div className="grid grid-cols-2 gap-6">
          {/* ── Personajes ────────────────────────────────────────────── */}
          <Bloque titulo="Personajes: apariciones y POV">
            {masApariciones.map((p) => (
              <div key={p.id} className="mb-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-fg-secondary">{p.nombre}</span>
                  <span className="text-fg-muted">
                    {p.apariciones} actos{p.pov ? ` · ${p.pov} POV` : ""}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-surface">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary/50" style={{ width: `${(p.apariciones / maxAp) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(p.pov / maxAp) * 100}%` }} />
                </div>
              </div>
            ))}
            {masApariciones.length === 0 && <Vacio texto="Ningún acto tiene personajes vinculados todavía." />}
          </Bloque>

          <Bloque titulo="Más tiempo sin salir">
            <p className="mb-2 text-xs text-fg-muted">Actos transcurridos desde su última aparición.</p>
            {masAusentes.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-border-base/50 py-1 text-sm">
                <span className="text-fg-secondary">{p.nombre}</span>
                <span className="font-mono text-fg-muted">{p.sinSalir === 0 ? "en el último" : p.sinSalir}</span>
              </div>
            ))}
            {masAusentes.length === 0 && <Vacio />}
          </Bloque>

          {/* ── Lugares ───────────────────────────────────────────────── */}
          <Bloque titulo="Lugares más usados">
            {lugares.slice(0, 12).map((l) => (
              <div key={`${l.tipo}-${l.id}`} className="mb-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-fg-secondary">
                    {l.nombre} <span className="text-fg-muted">· {l.tipo === "nacion" ? "nación" : l.tipo === "region" ? "región" : "locación"}</span>
                  </span>
                  <span className="text-fg-muted">{l.actos} actos</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface">
                  <div className="h-full rounded-full bg-secondary" style={{ width: `${(l.actos / maxLugar) * 100}%` }} />
                </div>
              </div>
            ))}
            {lugares.length === 0 && <Vacio texto="Ningún acto tiene lugares vinculados todavía." />}
          </Bloque>

          {/* ── Hilos ─────────────────────────────────────────────────── */}
          <Bloque titulo="Hilos narrativos">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <Cifra n={abiertos.length} etiqueta="Abiertos" clase="text-warning" />
              <Cifra n={cerrados.length} etiqueta="Cerrados" clase="text-success" />
              <Cifra n={sinAbrir.length} etiqueta="Sin abrir" clase="text-fg-muted" />
            </div>
            {abiertos.length > 0 && <p className="mb-1 text-[11px] uppercase tracking-wide text-fg-muted">Pendientes de cerrar</p>}
            {abiertos.map((h) => (
              <Link key={h.id} href={`/admin/taller/trama/hilos/${h.id}`} className="block truncate py-0.5 text-sm text-fg-secondary hover:text-accent">
                {h.nombre}
              </Link>
            ))}
          </Bloque>
        </div>
      </div>
    </>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-base bg-deep/40 p-5">
      <h2 className="mb-3 font-display text-lg text-fg">{titulo}</h2>
      {children}
    </section>
  );
}

function Barra({ etiqueta, conteo }: { etiqueta: string; conteo: number[] }) {
  const total = conteo.reduce((a, b) => a + b, 0);
  return (
    <div className="mb-1.5 flex items-center gap-3">
      <span className="w-20 text-xs text-fg-muted">{etiqueta}</span>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface">
        {total > 0 &&
          conteo.map((n, i) => (n ? <div key={i} className={COLOR[ESTADOS[i]]} style={{ width: `${(n / total) * 100}%` }} title={`${n} ${ESTADOS[i]}`} /> : null))}
      </div>
      <span className="w-28 text-right font-mono text-xs text-fg-muted">
        {conteo[0]}/{total} publicados
      </span>
    </div>
  );
}

function Cifra({ n, etiqueta, clase }: { n: number; etiqueta: string; clase: string }) {
  return (
    <div className="rounded-xl border border-border-base bg-surface/40 py-2">
      <p className={`font-display text-2xl ${clase}`}>{n}</p>
      <p className="text-[11px] text-fg-muted">{etiqueta}</p>
    </div>
  );
}

function Vacio({ texto = "Nada todavía." }: { texto?: string }) {
  return <p className="text-sm italic text-fg-muted">{texto}</p>;
}
