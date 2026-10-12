import Link from "next/link";
import { assertAdmin } from "@/lib/actions/auth";
import { TallerCabecera } from "@/components/taller/TallerShell";
import { Tablero } from "@/components/taller/estructura/Tablero";
import { PlantillasEditor } from "@/components/taller/estructura/PlantillasEditor";
import { getTallerIndice } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Estructura (spec §7): el tablero de fases por capítulo y las plantillas. */
export default async function EstructuraPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; capitulo?: string }>;
}) {
  await assertAdmin();
  const { vista, capitulo } = await searchParams;
  const indice = await getTallerIndice();
  const plantillas = vista === "plantillas";

  return (
    <>
      <TallerCabecera titulo="Estructura">
        {[
          { href: "/admin/taller/estructura", label: "Tablero", activa: !plantillas },
          { href: "/admin/taller/estructura?vista=plantillas", label: "Plantillas", activa: plantillas },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              t.activa ? "bg-surface text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </TallerCabecera>
      {plantillas ? (
        <PlantillasEditor plantillas={indice.plantillas} />
      ) : (
        <Tablero indice={indice} capituloId={capitulo ? Number(capitulo) : null} />
      )}
    </>
  );
}
