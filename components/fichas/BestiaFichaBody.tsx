import Link from "next/link";
import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseBlock } from "@/components/fichas/FichaShell";
import { LinkGrid } from "@/components/fichas/LinkGrid";
import { Icon } from "@/components/Icon";
import { Galeria } from "@/components/fichas/Galeria";
import { StatBars } from "@/components/viz/StatBars";
import { ElementoGroup } from "@/components/viz/ElementoBadges";
import { MiniGrafo, type GrafoGrupo } from "@/components/viz/MiniGrafo";
import { MiniMapa, type MiniPin } from "@/components/viz/MiniMapa";
import { getGaleria } from "@/lib/queries/galeria";
import { getBestiaRelaciones } from "@/lib/queries/mundoRelaciones";

interface BestiaRow {
  id: number;
  nombre: string;
  subtitulo: string | null;
  nivelAmenaza: string | null;
  categoria: string | null;
  dieta: string | null;
  tamano: string | null;
  descripcion: string | null;
  cicloVida: string | null;
  comportamiento: string | null;
  habitat: string | null;
  recursos: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
  [key: string]: unknown;
}

const AMENAZA_COLOR: Record<string, string> = {
  S: "#ff4a4a", A: "#ff8c5a", B: "#e0b34a", C: "#7fd65a", D: "#5b8def", E: "#9aa3b2",
};
function amenazaColor(n: string | null): string {
  if (!n) return "#f87171";
  return AMENAZA_COLOR[n.trim().toUpperCase().charAt(0)] ?? "#f87171";
}

export async function BestiaFichaBody({ bestia }: { bestia: BestiaRow }) {
  const [galeria, rel] = await Promise.all([
    getGaleria("bestias", bestia.id).catch(() => []),
    getBestiaRelaciones(bestia.id).catch(() => null),
  ]);
  const color = amenazaColor(bestia.nivelAmenaza);

  const pins: MiniPin[] = (rel?.regiones ?? [])
    .filter((r) => r.centroX != null && r.centroY != null)
    .map((r) => ({ x: r.centroX as number, y: r.centroY as number, color: r.color ?? color, href: `/regiones/${r.id}`, label: r.nombre }));
  const polys = (rel?.regiones ?? [])
    .filter((r) => r.poligono && r.poligono.length >= 3)
    .map((r) => ({ points: r.poligono as [number, number][], color: r.color ?? color, href: `/regiones/${r.id}`, label: r.nombre }));
  const hasMapa = pins.length > 0 || polys.length > 0;

  const grupos: GrafoGrupo[] = rel
    ? [
        { label: "Hábitat", color: "#5b8def", nodos: rel.naciones.map((n) => ({ id: `n${n.id}`, label: n.nombre, href: `/naciones/${n.id}`, img: n.imagenUrl })) },
        { label: "Drops", color: "#cbab57", nodos: rel.drops.map((d) => ({ id: `m${d.id}`, label: d.nombre, href: `/minerales/${d.id}`, img: d.imagenUrl })) },
        { label: "Bestias", color: "#ef6f6f", nodos: rel.relacionadas.map((b) => ({ id: `b${b.id}`, label: b.nombre, href: `/bestias/${b.id}`, img: b.imagenUrl })) },
      ].filter((g) => g.nodos.length > 0)
    : [];

  const fichaTecnica = [
    { label: "Categoría", value: bestia.categoria, icon: "Star" },
    { label: "Tamaño", value: bestia.tamano, icon: "Ruler" },
    { label: "Dieta", value: bestia.dieta, icon: "Drumstick" },
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
          <>
            {bestia.nivelAmenaza && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: `${color}66`, background: `${color}1a`, color }}>
                <Icon name="Flame" size={13} /> Amenaza {bestia.nivelAmenaza}
              </span>
            )}
            {bestia.categoria && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-base px-3 py-1 text-xs text-fg-secondary">
                <Icon name="Star" size={13} /> {bestia.categoria}
              </span>
            )}
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="order-2 space-y-8 lg:order-1">
            {/* Elementos */}
            {rel && (rel.elementos.debilidad.length > 0 || rel.elementos.resistencia.length > 0) && (
              <div className="space-y-2">
                <ElementoGroup label="Debilidades" icon="Sword" items={rel.elementos.debilidad} />
                <ElementoGroup label="Resistencias" icon="Shield" items={rel.elementos.resistencia} />
              </div>
            )}

            <ProseBlock title="Descripción">{bestia.descripcion}</ProseBlock>
            <ProseBlock title="Comportamiento">{bestia.comportamiento}</ProseBlock>
            <ProseBlock title="Ciclo de vida">{bestia.cicloVida}</ProseBlock>
            <ProseBlock title="Hábitat">{bestia.habitat}</ProseBlock>

            {/* Stats */}
            <StatBars entidad="bestias" row={bestia} />

            {/* Drops enlazados a minerales */}
            {rel && rel.drops.length > 0 && (
              <section>
                <SectionHead icon="Gem" title="Drops" accent={color} />
                <div className="overflow-hidden rounded-2xl border border-border-base">
                  {rel.drops.map((d, i) => (
                    <Link key={d.id} href={`/minerales/${d.id}`} className={"flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface " + (i % 2 ? "bg-surface/30" : "bg-surface/60")}>
                      <Icon name="Gem" size={15} className="shrink-0" style={{ color }} />
                      <span className="text-sm text-fg">{d.nombre}</span>
                      {d.rareza && <span className="ml-auto rounded-full border border-border-base px-2 py-0.5 text-xs text-fg-muted">{d.rareza}</span>}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Mapa de hábitat */}
            {hasMapa && (
              <section>
                <SectionHead icon="Map" title="Dónde habita" accent={color} />
                <MiniMapa polygons={polys} pins={pins} height={320} />
              </section>
            )}

            {/* Hábitat · naciones */}
            {rel && rel.naciones.length > 0 && (
              <section>
                <SectionHead icon="Globe2" title="Naciones" accent={color} />
                <LinkGrid items={rel.naciones.map((n) => ({ id: n.id, nombre: n.nombre, img: n.imagenUrl, nota: n.nota, href: `/naciones/${n.id}` }))} />
              </section>
            )}

            {/* Bestias relacionadas */}
            {rel && rel.relacionadas.length > 0 && (
              <section>
                <SectionHead icon="Network" title="Bestias relacionadas" accent={color} />
                <LinkGrid items={rel.relacionadas.map((b) => ({ id: b.id, nombre: b.nombre, img: b.imagenUrl, nota: b.tipo, href: `/bestias/${b.id}` }))} />
              </section>
            )}

            {grupos.length > 0 && <MiniGrafo centro={{ label: bestia.nombre, img: bestia.imagenUrl }} grupos={grupos} accent={color} />}

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
              {fichaTecnica.length > 0 && (
                <dl className="mt-4 space-y-3">
                  {fichaTecnica.map((t) => (
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
