import { assertAdmin } from "@/lib/actions/auth";

export default async function UniversoPersonajesPage() {
  await assertAdmin();
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <p className="text-sm italic text-fg-muted">Los personajes del Universo llegan en la Fase 8 del plan del taller.</p>
    </div>
  );
}
