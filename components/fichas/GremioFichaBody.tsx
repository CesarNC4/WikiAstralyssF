import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { JerarquiaSecciones } from "@/components/fichas/JerarquiaSecciones";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

interface GremioRow {
  nombre: string;
  subtitulo: string | null;
  lema: string | null;
  sede: string | null;
  descripcion: string | null;
  historia: string | null;
  estructuraGlobal: string | null;
  jerarquiaRangos: string | null;
  sistemaMisiones: string | null;
  principiosGenerales: string | null;
  normasContratos: string | null;
  conductaAceptable: string | null;
  conductaIntolerable: string | null;
  usoFuerza: string | null;
  lealtadDiscrecion: string | null;
  principioEspadaNeutral: string | null;
  recompensas: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
}
interface Rango { id: number; nombre: string; peso: number | null }
interface Faccion { id: number; nombre: string; color: string | null }
interface Historial { id: number; nombre: string; personajeId: number | null; rol: string | null; periodo: string | null; estado: string | null; destacado: boolean | null; motivoDestacado: string | null }

export function GremioFichaBody({
  gremio,
  rangos,
  facciones,
  jerarquia,
  historial,
}: {
  gremio: GremioRow;
  rangos: Rango[];
  facciones: Faccion[];
  jerarquia: FichaJerarquia[];
  historial: Historial[];
}) {
  return (
    <FichaShell
      banner={gremio.bannerUrl}
      imagen={gremio.imagenUrl}
      titulo={gremio.nombre}
      subtitulo={gremio.subtitulo}
      nombre={gremio.nombre}
      backHref="/"
      backLabel="Inicio"
      badges={gremio.lema ? <Badge tone="accent">“{gremio.lema}”</Badge> : undefined}
    >
      <FieldGrid fields={[{ label: "Sede", value: gremio.sede }, { label: "Lema", value: gremio.lema }]} />

      <ProseFields
        fields={[
          { label: "Descripción", value: gremio.descripcion },
          { label: "Historia", value: gremio.historia },
          { label: "Estructura global", value: gremio.estructuraGlobal },
          { label: "Jerarquía y rangos", value: gremio.jerarquiaRangos },
          { label: "Sistema de misiones", value: gremio.sistemaMisiones },
        ]}
      />

      {rangos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Rangos</h2>
          <div className="flex flex-wrap gap-2">
            {rangos.map((r, i) => (
              <span key={r.id} className="rounded-full border border-border-base px-3 py-1 text-sm text-fg-secondary">
                <span className="text-fg-muted">{i + 1}.</span> {r.nombre}
              </span>
            ))}
          </div>
        </section>
      )}

      {facciones.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Facciones</h2>
          <div className="flex flex-wrap gap-2">
            {facciones.map((f) => (
              <span key={f.id} className="rounded-full border px-3 py-1 text-sm" style={f.color ? { borderColor: f.color, color: f.color } : undefined}>
                {f.nombre}
              </span>
            ))}
          </div>
        </section>
      )}

      <JerarquiaSecciones items={jerarquia} variant="gremio" />

      <ProseFields
        fields={[
          { label: "Principios generales", value: gremio.principiosGenerales },
          { label: "Normas y contratos", value: gremio.normasContratos },
          { label: "Conducta aceptable", value: gremio.conductaAceptable },
          { label: "Conducta intolerable", value: gremio.conductaIntolerable },
          { label: "Uso de la fuerza", value: gremio.usoFuerza },
          { label: "Lealtad y discreción", value: gremio.lealtadDiscrecion },
          { label: "Principio de la espada neutral", value: gremio.principioEspadaNeutral },
          { label: "Recompensas", value: gremio.recompensas },
        ]}
      />

      {historial.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Historial</h2>
          <div className="space-y-2">
            {historial.map((h) => (
              <div key={h.id} className={"rounded-xl border bg-surface/40 p-3 " + (h.destacado ? "border-accent/50" : "border-border-base")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-fg">{h.nombre}</span>
                  {h.rol && <Badge>{h.rol}</Badge>}
                  {h.periodo && <span className="text-xs text-fg-muted">{h.periodo}</span>}
                  {h.estado && <span className="text-xs text-fg-muted">· {h.estado}</span>}
                </div>
                {h.destacado && h.motivoDestacado && <p className="mt-1 text-xs text-accent">★ {h.motivoDestacado}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </FichaShell>
  );
}
