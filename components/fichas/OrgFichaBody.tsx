import Link from "next/link";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { EntityImage } from "@/components/media/EntityImage";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

interface OrgRow {
  nombre: string;
  subtitulo: string | null;
  tipo: string | null;
  sede: string | null;
  estado: string | null;
  descripcion: string | null;
  objetivo: string | null;
  ideologia: string | null;
  historia: string | null;
  fundacion: string | null;
  liderazgo: string | null;
  miembrosDestacados: string | null;
  estructuraInterna: string | null;
  relacionFacciones: string | null;
  notasAdicionales: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
}
interface Faccion { id: number; nombre: string; color: string | null }
interface Historial { id: number; nombre: string; personajeId: number | null; rol: string | null; periodo: string | null; estado: string | null; destacado: boolean | null; motivoDestacado: string | null }

export function OrgFichaBody({
  org,
  jerarquia,
  facciones,
  historial,
}: {
  org: OrgRow;
  jerarquia: FichaJerarquia[];
  facciones: Faccion[];
  historial: Historial[];
}) {
  return (
    <FichaShell
      banner={org.bannerUrl}
      imagen={org.imagenUrl}
      titulo={org.nombre}
      subtitulo={org.subtitulo}
      nombre={org.nombre}
      backHref="/organizaciones"
      backLabel="Organizaciones"
      badges={
        <>
          {org.tipo && <Badge tone="accent">{org.tipo}</Badge>}
          {org.estado && <Badge>{org.estado}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Tipo", value: org.tipo },
          { label: "Sede", value: org.sede },
          { label: "Estado", value: org.estado },
        ]}
      />
      <ProseFields
        fields={[
          { label: "Descripción", value: org.descripcion },
          { label: "Objetivo", value: org.objetivo },
          { label: "Ideología", value: org.ideologia },
          { label: "Historia", value: org.historia },
          { label: "Fundación", value: org.fundacion },
          { label: "Liderazgo", value: org.liderazgo },
          { label: "Miembros destacados", value: org.miembrosDestacados },
          { label: "Estructura interna", value: org.estructuraInterna },
          { label: "Relación entre facciones", value: org.relacionFacciones },
          { label: "Notas adicionales", value: org.notasAdicionales },
        ]}
      />

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

      {jerarquia.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Jerarquía</h2>
          <div className="space-y-2">
            {jerarquia.map((j) => (
              <div key={j.id} className="flex items-center gap-3 rounded-xl border border-border-base bg-surface/40 p-3">
                {j.personajeId ? (
                  <Link href={`/personajes/${j.personajeId}`} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                    <EntityImage src={j.personajeImg} alt={j.nombre ?? ""} name={j.nombre} sizes="44px" />
                  </Link>
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-deep text-fg-muted">?</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{j.nombre ?? j.tituloApodo ?? "—"}</p>
                  {j.tituloApodo && j.nombre && <p className="text-xs text-fg-muted">«{j.tituloApodo}»</p>}
                </div>
                {j.rango && <Badge tone="primary">{j.rango}</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}

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
