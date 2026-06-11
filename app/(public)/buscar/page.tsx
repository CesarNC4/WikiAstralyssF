import type { Metadata } from "next";
import { buscarGlobal } from "@/lib/queries/busqueda";
import { BuscarResults } from "@/components/search/BuscarResults";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca en todo Astralys: personajes, naciones, magia, bestias y más.",
};

/** Página de resultados dedicada (§8). Lee ?q= y delega el filtrado por tipo al cliente. */
export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await buscarGlobal(query, 120).catch(() => []) : [];
  return <BuscarResults query={query} results={results} />;
}
