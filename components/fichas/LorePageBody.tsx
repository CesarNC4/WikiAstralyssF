import { FichaShell, ProseBlock } from "@/components/fichas/FichaShell";
import { Markdown } from "@/components/markdown/Markdown";
import { Icon } from "@/components/Icon";

interface LorePagina {
  slug: string;
  titulo: string | null;
  subtitulo: string | null;
  introduccion: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
}
interface LoreSeccion {
  id: number;
  titulo: string | null;
  contenido: string | null;
  tipo?: string | null;
}

/** Cuerpo de una página de lore (compartido por la página pública y el preview del admin). */
export function LorePageBody({ pagina: p, secciones }: { pagina: LorePagina; secciones: LoreSeccion[] }) {
  return (
    <FichaShell
      banner={p.bannerUrl}
      imagen={p.imagenUrl}
      titulo={p.titulo ?? p.slug}
      subtitulo={p.subtitulo}
      nombre={p.titulo ?? p.slug}
      backHref="/lore"
      backLabel="Lore"
    >
      {p.introduccion && (
        <p className="mb-8 border-l-2 border-primary pl-4 text-lg italic leading-relaxed text-fg-secondary">
          {p.introduccion}
        </p>
      )}
      {secciones.map((sec) => {
        // El tipo se guarda en minúsculas desde siempre; el catálogo lo muestra
        // capitalizado, así que se compara normalizado y no rompe lo ya escrito.
        switch ((sec.tipo ?? "texto").toLowerCase()) {
          case "cita":
            return <CitaBlock key={sec.id} titulo={sec.titulo} contenido={sec.contenido} />;
          case "tabla":
            return <TablaBlock key={sec.id} titulo={sec.titulo} contenido={sec.contenido} />;
          case "lista":
            return <ListaBlock key={sec.id} titulo={sec.titulo} contenido={sec.contenido} />;
          case "aviso":
          case "aviso / nota":
          case "nota":
            return <AvisoBlock key={sec.id} titulo={sec.titulo} contenido={sec.contenido} />;
          case "separador":
            return <SeparadorBlock key={sec.id} titulo={sec.titulo} />;
          case "cronologia":
          case "cronología":
            return <CronologiaBlock key={sec.id} titulo={sec.titulo} contenido={sec.contenido} />;
          default:
            return (
              <ProseBlock key={sec.id} title={sec.titulo ?? "Sección"}>
                {sec.contenido}
              </ProseBlock>
            );
        }
      })}
    </FichaShell>
  );
}

/** Cita destacada (pull-quote grande centrada con atribución). */
function CitaBlock({ titulo, contenido }: { titulo: string | null; contenido: string | null }) {
  if (!contenido?.trim()) return null;
  const lines = contenido
    .replace(/^>\s?/gm, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let autor: string | null = null;
  if (lines.length > 1 && /^[—–-]\s*/.test(lines[lines.length - 1])) {
    autor = lines.pop()!.replace(/^[—–-]\s*/, "");
  }
  const cita = lines.join(" ");
  return (
    <figure className="my-10 text-center">
      {titulo && <p className="mb-3 text-xs uppercase tracking-wider text-fg-muted">{titulo}</p>}
      <blockquote className="mx-auto max-w-2xl font-display text-2xl leading-snug text-fg md:text-3xl">
        <span className="text-accent">“</span>
        {cita}
        <span className="text-accent">”</span>
      </blockquote>
      {autor && <figcaption className="mt-4 text-sm uppercase tracking-wider text-accent">— {autor}</figcaption>}
    </figure>
  );
}

/** Tabla con cabecera de acento y filas zebra. */
function TablaBlock({ titulo, contenido }: { titulo: string | null; contenido: string | null }) {
  if (!contenido?.trim()) return null;
  return (
    <section className="mb-6">
      {titulo && <h2 className="mb-2 font-display text-xl text-accent">{titulo}</h2>}
      <div className="[&_tbody_tr:nth-child(even)]:bg-surface/30 [&_thead_th]:border-accent/30 [&_thead_th]:bg-accent/15 [&_thead_th]:text-accent!">
        <Markdown source={contenido} />
      </div>
    </section>
  );
}

/**
 * Aviso o nota al margen. Para advertencias, apuntes del narrador y spoilers
 * suaves: se distingue del cuerpo sin romper la lectura.
 */
function AvisoBlock({ titulo, contenido }: { titulo: string | null; contenido: string | null }) {
  if (!contenido?.trim()) return null;
  return (
    <aside className="my-6 rounded-xl border border-border-glow/60 bg-deep/40 px-5 py-4">
      {titulo && (
        <p className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-accent">
          <Icon name="Info" size={13} /> {titulo}
        </p>
      )}
      <div className="prose-astralys text-sm text-fg-secondary">
        <Markdown source={contenido} />
      </div>
    </aside>
  );
}

/** Separador: un respiro entre partes de una página larga. */
function SeparadorBlock({ titulo }: { titulo: string | null }) {
  return (
    <div className="my-10 flex items-center gap-3">
      <span className="h-px flex-1 bg-border-base" />
      {titulo && <span className="text-xs uppercase tracking-wider text-fg-muted">{titulo}</span>}
      <span className="h-px flex-1 bg-border-base" />
    </div>
  );
}

/**
 * Lista con viñeta de acento. El contenido es markdown normal; lo que cambia es
 * la presentación, más aireada que dentro de un bloque de prosa.
 */
function ListaBlock({ titulo, contenido }: { titulo: string | null; contenido: string | null }) {
  if (!contenido?.trim()) return null;
  return (
    <section className="mb-6">
      {titulo && <h2 className="mb-2 font-display text-xl text-accent">{titulo}</h2>}
      <div className="prose-astralys [&_li]:my-1 [&_ul]:list-none [&_ul]:pl-0 [&_li]:before:mr-2 [&_li]:before:text-accent [&_li]:before:content-['◆']">
        <Markdown source={contenido} />
      </div>
    </section>
  );
}

/**
 * Cronología: una línea de tiempo a partir de un markdown de dos columnas
 * separadas por " — " (fecha — suceso). Cada línea es un hito.
 */
function CronologiaBlock({ titulo, contenido }: { titulo: string | null; contenido: string | null }) {
  if (!contenido?.trim()) return null;
  const hitos = contenido
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.split(/\s+[—–-]\s+/);
      return m.length > 1 ? { fecha: m[0], texto: m.slice(1).join(" — ") } : { fecha: null, texto: l };
    });
  if (hitos.length === 0) return null;
  return (
    <section className="mb-8">
      {titulo && <h2 className="mb-3 font-display text-xl text-accent">{titulo}</h2>}
      <ol className="relative space-y-3 border-l border-border-base pl-5">
        {hitos.map((h, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-accent" />
            {h.fecha && <span className="mr-2 font-mono text-xs text-accent">{h.fecha}</span>}
            <span className="text-sm text-fg-secondary">{h.texto}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

