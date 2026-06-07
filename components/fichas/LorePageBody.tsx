import { FichaShell, ProseBlock } from "@/components/fichas/FichaShell";
import { Markdown } from "@/components/markdown/Markdown";

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
        if (sec.tipo === "cita") return <CitaBlock key={sec.id} titulo={sec.titulo} contenido={sec.contenido} />;
        if (sec.tipo === "tabla") return <TablaBlock key={sec.id} titulo={sec.titulo} contenido={sec.contenido} />;
        return (
          <ProseBlock key={sec.id} title={sec.titulo ?? "Sección"}>
            {sec.contenido}
          </ProseBlock>
        );
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
