import type { Metadata } from "next";
import { EntityIndexPage } from "@/components/entity/EntityIndexPage";

export const revalidate = 3600; // ISR (§4)
export const metadata: Metadata = { title: "Misiones" };

export default function Page() {
  return <EntityIndexPage entityKey="misiones" />;
}
