import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseBlock, FieldGrid } from "@/components/fichas/FichaShell";
import { LinkGrid } from "@/components/fichas/LinkGrid";
import { Galeria } from "@/components/fichas/Galeria";
import { Badge } from "@/components/entity/Badge";
import { StatBars } from "@/components/viz/StatBars";
import { ElementoBadge, ElementoGroup } from "@/components/viz/ElementoBadges";
import { MiniGrafo, type GrafoGrupo } from "@/components/viz/MiniGrafo";
import { elementoMeta } from "@/lib/elementos";
import { getGaleria } from "@/lib/queries/galeria";
import { getRazaRelaciones } from "@/lib/queries/mundoRelaciones";

interface RazaRow {
  id: number;
  nombre: string;
  subtitulo: string | null;
  clasificacion: string | null;
  afinidad: string | null;
  esperanzaVida: string | null;
  poblacionEstimada: string | null;
  dieta: string | null;
  razaPadreId: number | null;
  descripcion: string | null;
  origen: string | null;
  rasgosFisicos: string | null;
  cultura: string | null;
  habilidadesRasgo: string | null;
  estructuraSocial: string | null;
  creencias: string | null;
  relacionOtrasRazas: string | null;
  reproduccion: string | null;
  rasgosDistintivos: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
  [key: string]: unknown;
}

export async function RazaFichaBody({ raza }: { raza: RazaRow }) {
  const [galeria, rel] = await Promise.all([
    getGaleria("razas", raza.id).catch(() => []),
    getRazaRelaciones(raza.id, raza.razaPadreId).catch(() => null),
  ]);
  const el = elementoMeta(raza.afinidad);
  const color = el?.color ?? "#9b8cff";

  const grupos: GrafoGrupo[] = rel
    ? [
        { label: "Naciones", color: "#5b8def", nodos: rel.naciones.map((n) => ({ id: `n${n.id}`, label: n.nombre, href: `/naciones/${n.id}`, img: n.imagenUrl })) },
        { label: "Sub-razas", color: "#5fb98f", nodos: rel.subRazas.map((r) => ({ id: `r${r.id}`, label: r.nombre, href: `/razas/${r.id}`, img: r.imagenUrl })) },
        { label: "Personajes", color: "#cbab57", nodos: rel.personajes.slice(0, 8).map((p) => ({ id: `p${p.id}`, label: p.nombre, href: `/personajes/${p.id}`, img: p.imagenUrl })) },
      ].filter((g) => g.nodos.length > 0)
    : [];

  return (
    <div>
      <FichaHero
        banner={raza.bannerUrl}
        imagen={raza.imagenUrl}
        titulo={raza.nombre}
        subtitulo={raza.subtitulo}
        kicker="Raza"
        accent={`${color}33`}
        migas={[{ label: "Razas", href: "/razas" }, ...(rel?.padre ? [{ label: rel.padre.nombre, href: `/razas/${rel.padre.id}` }] : []), { label: raza.nombre }]}
        badges={
          <>
            {raza.clasificacion && <Badge tone="secondary">{raza.clasificacion}</Badge>}
            {el && <ElementoBadge el={{ slug: el.slug, nombre: el.nombre, color: el.color, icono: el.icono }} />}
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <FieldGrid
          fields={[
            { label: "Clasificación", value: raza.clasificacion },
            { label: "Esperanza de vida", value: raza.esperanzaVida },
            { label: "Población", value: raza.poblacionEstimada },
            { label: "Dieta", value: raza.dieta },
            { label: "Afinidad", value: el?.nombre ?? raza.afinidad },
            ...(rel?.padre ? [{ label: "Deriva de", value: rel.padre.nombre }] : []),
          ]}
        />

        {/* Debilidades / Resistencias */}
        {rel && (rel.elementos.debilidad.length > 0 || rel.elementos.resistencia.length > 0) && (
          <div className="space-y-2">
            <ElementoGroup label="Debilidades" icon="Sword" items={rel.elementos.debilidad} />
            <ElementoGroup label="Resistencias" icon="Shield" items={rel.elementos.resistencia} />
          </div>
        )}

        {/* Stats */}
        <StatBars entidad="razas" row={raza} />

        <div>
          <ProseBlock title="Descripción">{raza.descripcion}</ProseBlock>
          <ProseBlock title="Origen">{raza.origen}</ProseBlock>
          <ProseBlock title="Rasgos físicos">{raza.rasgosFisicos}</ProseBlock>
          <ProseBlock title="Rasgos distintivos">{raza.rasgosDistintivos}</ProseBlock>
          <ProseBlock title="Cultura">{raza.cultura}</ProseBlock>
          <ProseBlock title="Estructura social">{raza.estructuraSocial}</ProseBlock>
          <ProseBlock title="Creencias">{raza.creencias}</ProseBlock>
          <ProseBlock title="Relación con otras razas">{raza.relacionOtrasRazas}</ProseBlock>
          <ProseBlock title="Reproducción">{raza.reproduccion}</ProseBlock>
          <ProseBlock title="Habilidades de raza">{raza.habilidadesRasgo}</ProseBlock>
        </div>

        {/* Sub-razas */}
        {rel && rel.subRazas.length > 0 && (
          <section>
            <SectionHead icon="GitBranch" title="Sub-razas y variantes" accent={color} />
            <LinkGrid items={rel.subRazas.map((r) => ({ id: r.id, nombre: r.nombre, img: r.imagenUrl, nota: r.subtitulo, href: `/razas/${r.id}` }))} />
          </section>
        )}

        {/* Naciones */}
        {rel && rel.naciones.length > 0 && (
          <section>
            <SectionHead icon="Globe2" title="Naciones donde habitan" accent={color} />
            <LinkGrid items={rel.naciones.map((n) => ({ id: n.id, nombre: n.nombre, img: n.imagenUrl, nota: n.tipo, href: `/naciones/${n.id}` }))} />
          </section>
        )}

        {/* Personajes */}
        {rel && rel.personajes.length > 0 && (
          <section>
            <SectionHead icon="Users" title="Personajes" accent={color} />
            <LinkGrid items={rel.personajes.map((p) => ({ id: p.id, nombre: p.nombre, img: p.imagenUrl, nota: p.titulo, href: `/personajes/${p.id}` }))} />
          </section>
        )}

        {grupos.length > 0 && <MiniGrafo centro={{ label: raza.nombre, img: raza.imagenUrl }} grupos={grupos} accent={color} />}

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}
