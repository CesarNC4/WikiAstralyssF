import { assertAdmin } from "@/lib/actions/auth";
import { TallerShell } from "@/components/taller/TallerShell";

/**
 * Taller del autor (docs/taller-del-autor.md): sección propia a pantalla
 * completa dentro del panel. El proxy ya protege /admin; esto es la segunda
 * capa, y cada página vuelve a comprobarlo porque el layout no se re-renderiza
 * al navegar entre ellas.
 */
export default async function TallerLayout({ children }: { children: React.ReactNode }) {
  await assertAdmin();
  return <TallerShell>{children}</TallerShell>;
}
