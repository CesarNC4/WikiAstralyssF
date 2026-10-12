import { assertAdmin } from "@/lib/actions/auth";
import { CalendarioTaller } from "@/components/taller/CalendarioTaller";
import { getSucesos } from "@/lib/queries/cronologia";

export const dynamic = "force-dynamic";

/**
 * Vista de calendario del taller (spec §13): un año con todo lo que tiene
 * fecha, publicado o no, y alta de eventos en un día, un mes o el año.
 */
export default async function CalendarioAnualPage() {
  await assertAdmin();
  const datos = await getSucesos({ publico: false }).catch((e) => {
    console.error("[taller/calendario]", e);
    return null;
  });
  if (!datos) {
    return <p className="px-6 py-12 text-sm text-fg-secondary">No se pudo cargar el calendario.</p>;
  }
  return <CalendarioTaller sucesos={datos.sucesos} cal={datos.cal} />;
}
