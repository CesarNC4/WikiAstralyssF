import { FichaShell, ProseBlock } from "@/components/fichas/FichaShell";

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
      {secciones.map((sec) => (
        <ProseBlock key={sec.id} title={sec.titulo ?? "Sección"}>
          {sec.contenido}
        </ProseBlock>
      ))}
    </FichaShell>
  );
}
