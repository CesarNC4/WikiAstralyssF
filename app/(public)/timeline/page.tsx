import type { Metadata } from "next";
import { Cronologia } from "@/components/cronologia/Cronologia";
import { getSucesos } from "@/lib/queries/cronologia";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Cronología",
  description: "El túnel del tiempo de Astralys: eventos, nacimientos, fundaciones, capítulos y actos en una espiral interactiva.",
};

export default async function TimelinePage() {
  const datos = await getSucesos({ publico: true }).catch((e) => {
    console.error("[timeline]", e);
    return null;
  });
  if (!datos || datos.sucesos.length === 0) return <p className="text-fg-muted">No hay sucesos en la cronología.</p>;
  return <Cronologia sucesos={datos.sucesos} />;
}
