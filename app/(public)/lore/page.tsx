import type { Metadata } from "next";
import { EntityIndexPage } from "@/components/entity/EntityIndexPage";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Lore" };

export default function Page() {
  return <EntityIndexPage entityKey="lore" />;
}
