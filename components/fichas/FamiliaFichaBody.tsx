import { FichaHero, SectionHead } from "@/components/fichas/FichaHero";
import { ProseBlock } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { Icon } from "@/components/Icon";
import { Galeria } from "@/components/fichas/Galeria";
import { JerarquiaSecciones } from "@/components/fichas/JerarquiaSecciones";
import { StatRadar } from "@/components/fichas/personaje/StatRadar";
import { FamiliaArbol, type ArbolNodo } from "@/components/fichas/FamiliaArbol";
import { getGaleria } from "@/lib/queries/galeria";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

interface FamiliaRow {
  id: number;
  nombre: string;
  apellido: string | null;
  subtitulo: string | null;
  origen: string | null;
  descripcion: string | null;
  historia: string | null;
  poderEconomico: string | null;
  poderPolitico: string | null;
  poderMilitar: string | null;
  poderEconomicoNivel: number | null;
  poderPoliticoNivel: number | null;
  poderMilitarNivel: number | null;
  estructuraNucleo: string | null;
  circuloExtendido: string | null;
  liderazgo: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
}
interface Faccion { id: number; nombre: string; color: string | null }

const ACCENT = "#c9a227";

const PODERES = [
  { key: "economico", label: "Económico", icon: "Coins", color: "#e0b34a" },
  { key: "politico", label: "Político", icon: "Landmark", color: "#5b8def" },
  { key: "militar", label: "Militar", icon: "Swords", color: "#f87171" },
] as const;

export async function FamiliaFichaBody({
  familia,
  arbol,
  jerarquia,
  facciones,
}: {
  familia: FamiliaRow;
  arbol: ArbolNodo[];
  jerarquia: FichaJerarquia[];
  facciones: Faccion[];
}) {
  const galeria = await getGaleria("familias", familia.id).catch(() => []);

  const poderes = [
    { ...PODERES[0], texto: familia.poderEconomico, nivel: familia.poderEconomicoNivel },
    { ...PODERES[1], texto: familia.poderPolitico, nivel: familia.poderPoliticoNivel },
    { ...PODERES[2], texto: familia.poderMilitar, nivel: familia.poderMilitarNivel },
  ];
  const hayNiveles = poderes.some((p) => p.nivel != null);
  const hayPoder = poderes.some((p) => p.texto || p.nivel != null);

  return (
    <div>
      <FichaHero
        banner={familia.bannerUrl}
        imagen={familia.imagenUrl}
        titulo={familia.nombre}
        subtitulo={familia.subtitulo}
        kicker={familia.apellido ? `Casa ${familia.apellido}` : "Familia"}
        accent={`${ACCENT}33`}
        migas={[{ label: "Familias", href: "/familias" }, { label: familia.nombre }]}
        badges={
          <>
            {familia.origen && <Badge tone="accent">{familia.origen}</Badge>}
            {familia.apellido && <Badge>Casa {familia.apellido}</Badge>}
          </>
        }
      />

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        <ProseBlock title="Descripción">{familia.descripcion}</ProseBlock>

        {/* Perfil de poder de 3 ejes */}
        {hayPoder && (
          <section>
            <SectionHead icon="Activity" title="Perfil de poder" accent={ACCENT} />
            <div className="grid items-center gap-6 lg:grid-cols-[280px_1fr]">
              {hayNiveles && (
                <StatRadar
                  stats={poderes.map((p) => ({ label: p.label, value: p.nivel }))}
                  max={100}
                  color={ACCENT}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {poderes.map((p) => (
                  <div key={p.key} className="rounded-2xl border p-4" style={{ borderColor: `${p.color}44`, background: `${p.color}10` }}>
                    <div className="flex items-center justify-between">
                      <Icon name={p.icon} size={18} style={{ color: p.color }} />
                      {p.nivel != null && <span className="font-mono text-sm" style={{ color: p.color }}>{p.nivel}</span>}
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-fg-muted">{p.label}</p>
                    {p.texto && <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{p.texto}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Historia y estructura */}
        <div>
          <ProseBlock title="Historia">{familia.historia}</ProseBlock>
          <div className="grid gap-x-8 md:grid-cols-2">
            <ProseBlock title="Estructura del núcleo">{familia.estructuraNucleo}</ProseBlock>
            <ProseBlock title="Círculo extendido">{familia.circuloExtendido}</ProseBlock>
            <ProseBlock title="Liderazgo">{familia.liderazgo}</ProseBlock>
          </div>
        </div>

        {/* Facciones */}
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

        {/* Árbol genealógico */}
        {arbol.length > 0 && (
          <section>
            <SectionHead icon="Network" title="Árbol genealógico" accent={ACCENT} />
            <FamiliaArbol nodos={arbol} accent={ACCENT} />
          </section>
        )}

        {/* Jerarquía / miembros */}
        <JerarquiaSecciones items={jerarquia} variant="familia" />

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}
