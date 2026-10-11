import { assertAdmin } from "@/lib/actions/auth";
import { Proximamente } from "@/components/taller/TallerShell";

export default async function Page() {
  await assertAdmin();
  return <Proximamente titulo="Capítulos" fase="Fase 3" />;
}
