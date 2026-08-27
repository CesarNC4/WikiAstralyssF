import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseBlock, FieldGrid } from "@/components/fichas/FichaShell";
import { LinkGrid } from "@/components/fichas/LinkGrid";
import { Icon } from "@/components/Icon";
import { Galeria } from "@/components/fichas/Galeria";
import { Badge } from "@/components/entity/Badge";
import { StatBars } from "@/components/viz/StatBars";
import { ElementoBadge } from "@/components/viz/ElementoBadges";
import { MiniGrafo, type GrafoGrupo } from "@/components/viz/MiniGrafo";
import { elementoMeta } from "@/lib/elementos";
import { getGaleria } from "@/lib/queries/galeria";
import { getMineralRelaciones } from "@/lib/queries/mundoRelaciones";

interface MineralRow {
  id: number;
  nombre: string;
  rareza: string | null;
  tipo: string | null;
  composicion: string | null;
  estado: string | null;
  estadoFisico: string | null;
  origen: string | null;
  descripcion: string | null;
  propiedades: string | null;
  usos: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
  [key: string]: unknown;
}

export async function MineralFichaBody({ mineral }: { mineral: MineralRow }) {
  const [galeria, rel] = await Promise.all([
    getGaleria("minerales", mineral.id).catch(() => []),
    getMineralRelaciones(mineral.id).catch(() => null),
  ]);
  // La afinidad vive en `entidad_elemento` y puede ser más de una.
  const afinidades = rel?.elementos.afinidad ?? [];
  const el = elementoMeta(afinidades[0]?.slug);
  const color = el?.color ?? "#6fc3d6";

  const grupos: GrafoGrupo[] = rel
    ? [
        { label: "Forjado en", color: "#cbab57", nodos: rel.artefactos.map((a) => ({ id: `a${a.id}`, label: a.nombre, href: `/artefactos/${a.id}`, img: a.imagenUrl })) },
        { label: "Lo sueltan", color: "#ef6f6f", nodos: rel.soltadoPor.map((b) => ({ id: `b${b.id}`, label: b.nombre, href: `/bestias/${b.id}`, img: b.imagenUrl })) },
      ].filter((g) => g.nodos.length > 0)
    : [];

  return (
    <div>
      <FichaHero
        banner={mineral.bannerUrl ?? mineral.imagenUrl}
        imagen={mineral.imagenUrl}
        titulo={mineral.nombre}
        subtitulo={mineral.tipo}
        kicker="Mineral"
        accent={`${color}33`}
        migas={[{ label: "Minerales", href: "/minerales" }, { label: mineral.nombre }]}
        badges={
          <>
            {mineral.rareza && <Badge tone="rareza" rarezaKey={mineral.rareza}>{mineral.rareza}</Badge>}
            {el && <ElementoBadge el={{ slug: el.slug, nombre: el.nombre, color: el.color, icono: el.icono }} />}
            {rel?.moneda && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-base px-3 py-1 text-xs text-fg-secondary">
                <Icon name="Coins" size={13} /> {formatCantidad(rel.moneda.cantidad)} {rel.moneda.denominacion ?? rel.moneda.nombre}
              </span>
            )}
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <FieldGrid
          fields={[
            { label: "Rareza", value: mineral.rareza },
            { label: "Tipo", value: mineral.tipo },
            { label: "Origen", value: mineral.origen },
            { label: "Afinidad", value: afinidades.map((a) => a.nombre).join(" · ") || null },
            { label: "Composición", value: mineral.composicion },
            { label: "Estado físico", value: mineral.estadoFisico },
            { label: "Disponibilidad", value: mineral.estado },
            ...(rel?.moneda ? [{ label: "Valor", value: `${formatCantidad(rel.moneda.cantidad)} ${rel.moneda.denominacion ?? rel.moneda.nombre}` }] : []),
          ]}
        />

        {/* Stats */}
        <StatBars entidad="minerales" row={mineral} />

        <div>
          <ProseBlock title="Descripción">{mineral.descripcion}</ProseBlock>
          <ProseBlock title="Propiedades">{mineral.propiedades}</ProseBlock>
          <ProseBlock title="Usos">{mineral.usos}</ProseBlock>
        </div>

        {/* Usos estructurados */}
        {rel && rel.usos.length > 0 && (
          <section>
            <SectionHead icon="Layers" title="Aplicaciones" accent={color} />
            <div className="grid gap-2 sm:grid-cols-2">
              {rel.usos.map((u) => (
                <div key={u.id} className="rounded-xl border border-border-base bg-surface/40 px-4 py-3">
                  <p className="text-sm text-fg">{u.nombre}</p>
                  {u.detalle && <p className="text-xs text-fg-muted">{u.detalle}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Forjado en */}
        {rel && rel.artefactos.length > 0 && (
          <section>
            <SectionHead icon="Sword" title="Forjado en" accent={color} />
            <LinkGrid items={rel.artefactos.map((a) => ({ id: a.id, nombre: a.nombre, img: a.imagenUrl, nota: a.tipo, href: `/artefactos/${a.id}` }))} />
          </section>
        )}

        {/* Bestias que lo sueltan */}
        {rel && rel.soltadoPor.length > 0 && (
          <section>
            <SectionHead icon="PawPrint" title="Lo sueltan" accent={color} />
            <LinkGrid items={rel.soltadoPor.map((b) => ({ id: b.id, nombre: b.nombre, img: b.imagenUrl, nota: b.rareza, href: `/bestias/${b.id}` }))} />
          </section>
        )}

        {grupos.length > 0 && <MiniGrafo centro={{ label: mineral.nombre, img: mineral.imagenUrl }} grupos={grupos} accent={color} />}

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}

function formatCantidad(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
