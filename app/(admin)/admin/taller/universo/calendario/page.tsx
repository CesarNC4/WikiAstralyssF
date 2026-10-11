import { assertAdmin } from "@/lib/actions/auth";
import { CalendarioConfig } from "@/components/taller/CalendarioConfig";
import { getCalendario, getUsoSegmentos } from "@/lib/queries/fechas";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  await assertAdmin();
  const datos = await Promise.all([getCalendario(), getUsoSegmentos()]).catch((e) => {
    console.error("[taller/calendario]", e);
    return null;
  });

  // Antes de aplicar `migrate-fechas.ts` las tablas no existen: se dice en vez de romper.
  if (!datos) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-sm text-fg-secondary">
        <p className="mb-2 text-fg">El calendario aún no existe en la base.</p>
        <p>
          Falta aplicar la migración <code className="font-mono text-accent">scripts/migrations/migrate-fechas.ts</code>.
        </p>
      </div>
    );
  }

  const [cal, uso] = datos;
  return <CalendarioConfig inicial={cal} uso={uso} />;
}
