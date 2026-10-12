import type { Metadata } from "next";
import { CalendarioPublico } from "@/components/cronologia/CalendarioPublico";
import { getSucesos } from "@/lib/queries/cronologia";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Calendario · Cronología",
  description: "El calendario de Astralys año por año: sus meses, sus días fuera de mes y lo que pasó en cada uno.",
};

export default async function CalendarioPage() {
  const datos = await getSucesos({ publico: true }).catch((e) => {
    console.error("[timeline/calendario]", e);
    return null;
  });
  if (!datos) return <p className="text-fg-muted">El calendario no está disponible.</p>;
  return <CalendarioPublico sucesos={datos.sucesos} cal={datos.cal} />;
}
