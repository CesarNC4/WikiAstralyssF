import { assertAdmin } from "@/lib/actions/auth";
import { TallerCabecera } from "@/components/taller/TallerShell";
import { PapeleraTaller } from "@/components/taller/PapeleraTaller";
import { getPapeleraTaller } from "@/lib/queries/taller";

export const dynamic = "force-dynamic";

export default async function PapeleraPage() {
  await assertAdmin();
  const items = await getPapeleraTaller();
  return (
    <>
      <TallerCabecera titulo="Papelera" />
      <PapeleraTaller items={items} />
    </>
  );
}
