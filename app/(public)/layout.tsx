import { SearchProvider } from "@/components/search/SearchProvider";
import { TopNav } from "@/components/layout/TopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { MusicPlayerBar } from "@/components/player/MusicPlayerBar";
import { Starfield } from "@/components/visual/Starfield";

/**
 * Shell público (§3.5). El reproductor vive aquí (layout raíz del grupo) para
 * persistir entre navegaciones de páginas hijas.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <SearchProvider>
      <Starfield />
      <TopNav />
      {/* padding-bottom para no tapar contenido con bottom nav + player en móvil */}
      <main className="flex-1 pb-32 md:pb-24">{children}</main>
      <MusicPlayerBar />
      <BottomNav />
    </SearchProvider>
  );
}
