import { assertAdmin } from "@/lib/actions/auth";
import { PersonajesUniverso } from "@/components/taller/universo/PersonajesUniverso";
import { getPersonajesUniverso } from "@/lib/queries/taller";

export const dynamic = "force-dynamic";

export default async function UniversoPersonajesPage() {
  await assertAdmin();
  const datos = await getPersonajesUniverso();
  return <PersonajesUniverso {...datos} />;
}
