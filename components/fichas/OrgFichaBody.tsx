import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { Galeria } from "@/components/fichas/Galeria";
import { JerarquiaSecciones } from "@/components/fichas/JerarquiaSecciones";
import { OrgChart, type OrgMiembro } from "@/components/fichas/OrgChart";
import { getGaleria } from "@/lib/queries/galeria";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

interface OrgRow {
  id: number;
  nombre: string;
  subtitulo: string | null;
  tipo: string | null;
  sede: string | null;
  estado: string | null;
  legalidad: string | null;
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

const ACCENT = "#c9a227";

export async function OrgFichaBody({
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
  const galeria = await getGaleria("organizaciones", org.id).catch(() => []);

  const miembros: OrgMiembro[] = jerarquia
    .filter((j) => j.nombre)
    .map((j) => ({
      key: String(j.id),
      nombre: j.nombre as string,
      sub: j.rango ?? j.tituloApodo ?? j.tituloNobiliario ?? j.tituloFamilia,
      peso: j.rangoPeso,
      href: j.personajeId ? `/personajes/${j.personajeId}` : null,
    }));

  return (
    <div>
      <FichaHero
        banner={org.bannerUrl}
        imagen={org.imagenUrl}
        titulo={org.nombre}
        subtitulo={org.subtitulo}
        kicker="Organización"
        accent={`${ACCENT}33`}
        migas={[{ label: "Organizaciones", href: "/organizaciones" }, { label: org.nombre }]}
        badges={
          <>
            {org.tipo && <Badge tone="accent">{org.tipo}</Badge>}
            {org.estado && <Badge>{org.estado}</Badge>}
            {org.sede && <Badge>{org.sede}</Badge>}
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        {/* Panel de facción */}
        <div className="rounded-2xl border border-border-base bg-surface/40 p-5">
          <FieldGrid fields={[{ label: "Tipo", value: org.tipo }, { label: "Sede", value: org.sede }, { label: "Estado", value: org.estado }, { label: "Legalidad", value: org.legalidad }]} />
          {facciones.length > 0 && (
            <div className="mt-1">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-fg-muted">Facciones</p>
              <div className="flex flex-wrap gap-2">
                {facciones.map((f) => (
                  <span key={f.id} className="rounded-full border px-3 py-1 text-sm" style={f.color ? { borderColor: f.color, color: f.color } : undefined}>
                    {f.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Organigrama */}
        {miembros.length > 0 && (
          <section>
            <SectionHead icon="Network" title="Organigrama" accent={ACCENT} />
            <OrgChart miembros={miembros} accent={ACCENT} />
          </section>
        )}

        {/* Prosa */}
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

        {/* Detalle de miembros por rango */}
        <JerarquiaSecciones items={jerarquia} variant="org" />

        {/* Historial */}
        {historial.length > 0 && (
          <section>
            <SectionHead icon="Clock" title="Historial" accent={ACCENT} />
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

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}
