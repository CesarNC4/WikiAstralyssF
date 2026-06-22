import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { ProseBlock } from "@/components/fichas/FichaShell";
import { Galeria } from "@/components/fichas/Galeria";
import { getGaleria } from "@/lib/queries/galeria";
import { NATURALEZA_LABEL, magiaVisual } from "@/lib/magia";
import type { MagiaFicha } from "@/lib/queries/magia";

/** Ficha de magia con identidad visual por elemento/tipo (§ puntos 11-12). */
export async function MagiaFichaBody({ data }: { data: MagiaFicha }) {
  const { magia, personajes, relacionadas, padre, hijos } = data;
  const vis = magiaVisual(magia);
  const galeria = await getGaleria("magia", magia.id).catch(() => []);

  return (
    <div>
      {/* Hero con identidad por elemento/tipo */}
      <div className="relative overflow-hidden">
        {magia.imagenUrl ? (
          <div className="absolute inset-0">
            <EntityImage src={magia.imagenUrl} alt={magia.nombre} name={magia.nombre} sizes="100vw" priority />
            <div className="absolute inset-0 bg-void/70" />
          </div>
        ) : null}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(120% 80% at 0% 0%, ${vis.color}33, transparent 60%)` }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-10 md:py-14">
          <Link
            href="/magia"
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border-base bg-void/40 px-3 py-1.5 text-xs text-fg-secondary backdrop-blur hover:text-fg"
          >
            <Icon name="ChevronLeft" size={14} /> Magia
          </Link>
          <div className="flex items-start gap-4">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border shadow-xl md:h-20 md:w-20"
              style={{ borderColor: `${vis.color}66`, background: `${vis.color}1f`, color: vis.color }}
            >
              <Icon name={vis.icon} size={34} />
            </span>
            <div>
              <h1 className="font-display text-3xl text-fg md:text-5xl">{magia.nombre}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {magia.naturaleza && (
                  <Badge color={vis.color}>{NATURALEZA_LABEL[magia.naturaleza] ?? magia.naturaleza}</Badge>
                )}
                {magia.tipo && <Badge color={vis.color}>{magia.tipo}</Badge>}
                {magia.subcategoria && <Badge color={vis.color}>{magia.subcategoria}</Badge>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {padre && (
          <Link
            href={`/magia/${padre.id}`}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
          >
            <Icon name="Atom" size={14} style={{ color: vis.color }} /> Deriva de{" "}
            <span className="text-fg">{padre.nombre}</span>
          </Link>
        )}

        <ProseBlock title="Descripción">{magia.descripcion}</ProseBlock>
        <ProseBlock title="Detalle">{magia.contenido}</ProseBlock>

        {/* Personajes que la usan */}
        {personajes.length > 0 && (
          <section className="mt-8">
            <SectionTitle icon="Users" color={vis.color}>
              Quienes la dominan
            </SectionTitle>
            <div className="flex flex-wrap gap-3">
              {personajes.map((p) => (
                <Link
                  key={p.id}
                  href={`/personajes/${p.id}`}
                  className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2 pr-4 hover:border-border-glow"
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                    <EntityImage src={p.imagenUrl} alt={p.nombre} name={p.nombre} sizes="40px" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{[p.nombre, p.surname].filter(Boolean).join(" ")}</p>
                    {p.habilidad && <p className="truncate text-xs text-fg-muted">{p.habilidad}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Técnicas derivadas */}
        {hijos.length > 0 && (
          <section className="mt-8">
            <SectionTitle icon="Sparkles" color={vis.color}>
              Técnicas derivadas
            </SectionTitle>
            <MagiaMiniGrid items={hijos} />
          </section>
        )}

        {/* Relacionadas */}
        {relacionadas.length > 0 && (
          <section className="mt-8">
            <SectionTitle icon="Network" color={vis.color}>
              Magia relacionada
            </SectionTitle>
            <MagiaMiniGrid items={relacionadas} />
          </section>
        )}

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}

function MagiaMiniGrid({
  items,
}: {
  items: { id: number; nombre: string; naturaleza: string | null; tipo: string | null; subcategoria: string | null; imagenUrl: string | null }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((m) => {
        const vis = magiaVisual(m);
        return (
          <Link
            key={m.id}
            href={`/magia/${m.id}`}
            className="group flex items-center gap-2.5 rounded-xl border bg-surface/40 p-2.5 transition-colors hover:border-border-glow"
            style={{ borderColor: `${vis.color}33` }}
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"
              style={{ borderColor: `${vis.color}55`, background: `${vis.color}1a`, color: vis.color }}
            >
              <Icon name={vis.icon} size={16} />
            </span>
            <span className="truncate text-sm text-fg">{m.nombre}</span>
          </Link>
        );
      })}
    </div>
  );
}

function SectionTitle({ icon, color, children }: { icon: string; color: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 place-items-center rounded-lg border"
        style={{ borderColor: `${color}66`, background: `${color}18`, color }}
      >
        <Icon name={icon} size={16} />
      </span>
      <h2 className="font-display text-xl text-fg">{children}</h2>
      <span className="ml-2 h-px flex-1" style={{ background: `linear-gradient(to right, ${color}44, transparent)` }} />
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-xs"
      style={{ borderColor: `${color}55`, background: `${color}1a`, color }}
    >
      {children}
    </span>
  );
}
