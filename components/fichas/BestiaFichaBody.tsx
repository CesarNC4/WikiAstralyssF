import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseBlock } from "@/components/fichas/FichaShell";
import { Icon } from "@/components/Icon";
import { Galeria } from "@/components/fichas/Galeria";
import { getGaleria } from "@/lib/queries/galeria";

interface BestiaRow {
  id: number;
  nombre: string;
  subtitulo: string | null;
  nivelAmenaza: string | null;
  descripcion: string | null;
  cicloVida: string | null;
  comportamiento: string | null;
  habitat: string | null;
  recursos: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
}

/** Color por nivel de amenaza (estilo bestiario S/A/B/C…). */
const AMENAZA_COLOR: Record<string, string> = {
  S: "#ff4a4a", A: "#ff8c5a", B: "#e0b34a", C: "#7fd65a", D: "#5b8def", E: "#9aa3b2",
};
function amenazaColor(n: string | null): string {
  if (!n) return "#f87171";
  return AMENAZA_COLOR[n.trim().toUpperCase().charAt(0)] ?? "#f87171";
}

/** Divide el texto de recursos en filas de "drops". */
function parseDrops(texto: string | null): { nombre: string; detalle?: string }[] {
  if (!texto) return [];
  let partes = texto.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (partes.length <= 1) partes = texto.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  return partes.map((p) => {
    const m = p.match(/^[-•*]?\s*(.+?)\s*[—:–-]\s*(.+)$/);
    return m ? { nombre: m[1], detalle: m[2] } : { nombre: p.replace(/^[-•*]\s*/, "") };
  });
}

export async function BestiaFichaBody({ bestia }: { bestia: BestiaRow }) {
  const galeria = await getGaleria("bestias", bestia.id).catch(() => []);
  const color = amenazaColor(bestia.nivelAmenaza);
  const drops = parseDrops(bestia.recursos);

  const tecnica = [
    { label: "Hábitat", value: bestia.habitat, icon: "MapPin" },
    { label: "Comportamiento", value: bestia.comportamiento ? resumen(bestia.comportamiento) : null, icon: "Activity" },
  ].filter((t) => t.value);

  return (
    <div>
      <FichaHero
        banner={bestia.bannerUrl}
        imagen={bestia.imagenUrl}
        titulo={bestia.nombre}
        subtitulo={bestia.subtitulo}
        kicker="Bestia"
        accent={`${color}33`}
        migas={[{ label: "Bestias", href: "/bestias" }, { label: bestia.nombre }]}
        badges={
          bestia.nivelAmenaza ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: `${color}66`, background: `${color}1a`, color }}>
              <Icon name="Flame" size={13} /> Amenaza {bestia.nivelAmenaza}
            </span>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Contenido principal */}
          <div className="order-2 space-y-8 lg:order-1">
            <ProseBlock title="Descripción">{bestia.descripcion}</ProseBlock>
            <ProseBlock title="Comportamiento">{bestia.comportamiento}</ProseBlock>
            <ProseBlock title="Ciclo de vida">{bestia.cicloVida}</ProseBlock>
            <ProseBlock title="Hábitat">{bestia.habitat}</ProseBlock>

            {drops.length > 0 && (
              <section>
                <SectionHead icon="Gem" title="Recursos / drops" accent={color} />
                <div className="overflow-hidden rounded-2xl border border-border-base">
                  {drops.map((d, i) => (
                    <div key={i} className={"flex items-start gap-3 px-4 py-3 " + (i % 2 ? "bg-surface/30" : "bg-surface/60")}>
                      <Icon name="Gem" size={15} className="mt-0.5 shrink-0" style={{ color }} />
                      <div className="min-w-0">
                        <p className="text-sm text-fg">{d.nombre}</p>
                        {d.detalle && <p className="text-xs text-fg-muted">{d.detalle}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {galeria.length > 0 && <Galeria images={galeria} />}
          </div>

          {/* Ficha técnica (bestiario) */}
          <aside className="order-1 lg:order-2">
            <div className="sticky top-20 rounded-2xl border p-5" style={{ borderColor: `${color}44`, background: `${color}0d` }}>
              <p className="text-[11px] uppercase tracking-wider text-fg-muted">Ficha técnica</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl border text-2xl font-display" style={{ borderColor: `${color}66`, background: `${color}1a`, color }}>
                  {bestia.nivelAmenaza ?? "?"}
                </span>
                <div>
                  <p className="text-xs text-fg-muted">Nivel de amenaza</p>
                  <p className="text-lg text-fg">{bestia.nivelAmenaza ? `Clase ${bestia.nivelAmenaza}` : "Sin clasificar"}</p>
                </div>
              </div>
              {tecnica.length > 0 && (
                <dl className="mt-4 space-y-3">
                  {tecnica.map((t) => (
                    <div key={t.label} className="flex items-start gap-2.5">
                      <Icon name={t.icon} size={15} className="mt-0.5 shrink-0" style={{ color }} />
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-fg-muted">{t.label}</dt>
                        <dd className="text-sm text-fg">{t.value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Primera frase / recorte para el panel técnico. */
function resumen(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const corte = limpio.match(/^.{0,90}(?:[.!?]|$)/)?.[0] ?? limpio.slice(0, 90);
  return corte.length < limpio.length ? corte.trim() : limpio;
}
