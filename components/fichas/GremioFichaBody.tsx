import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseBlock, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { Icon } from "@/components/Icon";
import { Galeria } from "@/components/fichas/Galeria";
import { Tabs, type TabDef } from "@/components/fichas/Tabs";
import { JerarquiaSecciones } from "@/components/fichas/JerarquiaSecciones";
import { Markdown } from "@/components/markdown/Markdown";
import { getGaleria } from "@/lib/queries/galeria";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

interface GremioRow {
  id: number;
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

const ACCENT = "#e0b34a";

export async function GremioFichaBody({
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
  const galeria = await getGaleria("gremio", gremio.id).catch(() => []);

  const tabs: TabDef[] = [];

  // Visión general
  if (gremio.descripcion || gremio.historia || gremio.estructuraGlobal || facciones.length) {
    tabs.push({
      id: "vision",
      label: "Visión general",
      content: (
        <div className="space-y-6">
          <ProseFields
            fields={[
              { label: "Descripción", value: gremio.descripcion },
              { label: "Historia", value: gremio.historia },
              { label: "Estructura global", value: gremio.estructuraGlobal },
            ]}
          />
          {facciones.length > 0 && (
            <section>
              <SectionHead icon="Network" title="Facciones" accent={ACCENT} />
              <div className="flex flex-wrap gap-2">
                {facciones.map((f) => (
                  <span key={f.id} className="rounded-full border px-3 py-1 text-sm" style={f.color ? { borderColor: f.color, color: f.color } : undefined}>
                    {f.nombre}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      ),
    });
  }

  // Estructura y rangos
  if (rangos.length || gremio.jerarquiaRangos || jerarquia.length) {
    tabs.push({
      id: "estructura",
      label: "Estructura y rangos",
      content: (
        <div className="space-y-8">
          {rangos.length > 0 && <RangoPiramide rangos={rangos} />}
          {gremio.jerarquiaRangos && <ProseBlock title="Jerarquía y rangos">{gremio.jerarquiaRangos}</ProseBlock>}
          <JerarquiaSecciones items={jerarquia} variant="gremio" />
        </div>
      ),
    });
  }

  // Misiones (solo explicación del sistema)
  if (gremio.sistemaMisiones) {
    tabs.push({
      id: "misiones",
      label: "Misiones",
      content: (
        <div className="space-y-6">
          <ProseBlock title="Sistema de misiones">{gremio.sistemaMisiones}</ProseBlock>
        </div>
      ),
    });
  }

  // Código de conducta
  const tieneCodigo =
    gremio.principiosGenerales ||
    gremio.normasContratos ||
    gremio.conductaAceptable ||
    gremio.conductaIntolerable ||
    gremio.usoFuerza ||
    gremio.lealtadDiscrecion ||
    gremio.principioEspadaNeutral;
  if (tieneCodigo) {
    tabs.push({
      id: "codigo",
      label: "Código",
      content: (
        <div className="space-y-8">
          {gremio.principiosGenerales && <ProseBlock title="Principios generales">{gremio.principiosGenerales}</ProseBlock>}

          {(gremio.conductaAceptable || gremio.conductaIntolerable) && (
            <div className="grid gap-4 md:grid-cols-2">
              {gremio.conductaAceptable && <ConductaCard tono="ok" titulo="Conducta aceptable" texto={gremio.conductaAceptable} />}
              {gremio.conductaIntolerable && <ConductaCard tono="bad" titulo="Conducta intolerable" texto={gremio.conductaIntolerable} />}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <MandamientoCard icon="Swords" titulo="Uso de la fuerza" texto={gremio.usoFuerza} />
            <MandamientoCard icon="Shield" titulo="Lealtad y discreción" texto={gremio.lealtadDiscrecion} />
            <MandamientoCard icon="Sword" titulo="La espada neutral" texto={gremio.principioEspadaNeutral} />
          </div>

          {gremio.normasContratos && <ProseBlock title="Normas y contratos">{gremio.normasContratos}</ProseBlock>}
        </div>
      ),
    });
  }

  // Recompensas
  if (gremio.recompensas || historial.length) {
    tabs.push({
      id: "recompensas",
      label: "Recompensas",
      content: (
        <div className="space-y-8">
          {gremio.recompensas && <ProseBlock title="Recompensas">{gremio.recompensas}</ProseBlock>}
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
        </div>
      ),
    });
  }

  return (
    <div>
      <FichaHero
        banner={gremio.bannerUrl}
        imagen={gremio.imagenUrl}
        titulo={gremio.nombre}
        subtitulo={gremio.subtitulo}
        kicker="Gremio"
        accent={`${ACCENT}33`}
        migas={[{ label: "Inicio", href: "/" }, { label: gremio.nombre }]}
        badges={
          <>
            {gremio.lema && <Badge tone="accent">“{gremio.lema}”</Badge>}
            {gremio.sede && <Badge>{gremio.sede}</Badge>}
          </>
        }
      />
      <div className="mx-auto max-w-5xl px-4 py-10">
        {tabs.length > 0 && <Tabs tabs={tabs} />}
        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}

/** Pirámide de rangos: apex (liderazgo) arriba y estrecho; base ancha abajo. */
function RangoPiramide({ rangos }: { rangos: Rango[] }) {
  // Ya vienen ordenados por peso desc (liderazgo primero).
  const n = rangos.length;
  return (
    <section>
      <SectionHead icon="Landmark" title="Rangos" accent={ACCENT} />
      <div className="space-y-1.5">
        {rangos.map((r, i) => {
          const width = 44 + (n > 1 ? (i / (n - 1)) * 56 : 56); // 44% (apex) → 100% (base)
          const t = n > 1 ? i / (n - 1) : 0;
          return (
            <div key={r.id} className="flex justify-center">
              <div
                className="flex items-center justify-between rounded-lg border px-4 py-2.5 transition-transform hover:scale-[1.01]"
                style={{
                  width: `${width}%`,
                  borderColor: `${ACCENT}55`,
                  background: `linear-gradient(90deg, ${ACCENT}${t < 0.5 ? "26" : "14"}, transparent)`,
                }}
              >
                <span className="flex items-center gap-2 text-sm text-fg">
                  <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-mono" style={{ background: `${ACCENT}22`, color: ACCENT }}>
                    {n - i}
                  </span>
                  {r.nombre}
                </span>
                {i === 0 && <Icon name="Star" size={14} style={{ color: ACCENT }} />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Tarjeta enfrentada de conducta (aceptable verde / intolerable roja). */
function ConductaCard({ tono, titulo, texto }: { tono: "ok" | "bad"; titulo: string; texto: string }) {
  const color = tono === "ok" ? "#5fd38a" : "#f87171";
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: `${color}44`, background: `${color}0d` }}>
      <div className="mb-2 flex items-center gap-2">
        <Icon name={tono === "ok" ? "Check" : "X"} size={16} style={{ color }} />
        <h3 className="font-display text-lg" style={{ color }}>{titulo}</h3>
      </div>
      <Markdown source={texto} className="text-sm leading-relaxed text-fg-secondary" />
    </div>
  );
}

/** Tarjeta de principio del código ("mandamiento"). */
function MandamientoCard({ icon, titulo, texto }: { icon: string; titulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div className="rounded-2xl border border-border-base bg-surface/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${ACCENT}1a`, color: ACCENT }}>
          <Icon name={icon} size={16} />
        </span>
        <h3 className="text-sm font-medium text-fg">{titulo}</h3>
      </div>
      <Markdown source={texto} className="text-sm leading-relaxed text-fg-secondary" />
    </div>
  );
}
