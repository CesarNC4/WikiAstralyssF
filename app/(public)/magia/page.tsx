import type { Metadata } from "next";
import { MagiaExplorer } from "@/components/magia/MagiaExplorer";
import { listMagiaIndex } from "@/lib/queries/magia";

export const revalidate = 3600; // ISR (§4)
export const metadata: Metadata = {
  title: "Magia",
  description: "El sistema arcano de Astralys: fundamentos, conceptos, técnicas y hechizos.",
};

export default async function Page() {
  const items = await listMagiaIndex().catch(() => []);
  return <MagiaExplorer items={items} />;
}
