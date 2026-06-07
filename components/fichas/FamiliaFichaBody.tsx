import Link from "next/link";
import { FichaShell, FieldGrid, ProseFields } from "@/components/fichas/FichaShell";
import { Badge } from "@/components/entity/Badge";
import { JerarquiaSecciones } from "@/components/fichas/JerarquiaSecciones";
import type { FichaJerarquia } from "@/lib/queries/adminComplejas";

interface FamiliaRow {
  nombre: string;
  apellido: string | null;
  subtitulo: string | null;
  origen: string | null;
  descripcion: string | null;
  historia: string | null;
  poderEconomico: string | null;
  poderPolitico: string | null;
  poderMilitar: string | null;
  estructuraNucleo: string | null;
  circuloExtendido: string | null;
  liderazgo: string | null;
  imagenUrl: string | null;
  bannerUrl: string | null;
}
interface ArbolNodo { id: number; nombre: string; generacion: number | null; estado: string | null; destacado: boolean | null; personajeId: number | null }
interface Faccion { id: number; nombre: string; color: string | null }

export function FamiliaFichaBody({
  familia,
  arbol,
  jerarquia,
  facciones,
}: {
  familia: FamiliaRow;
  arbol: ArbolNodo[];
  jerarquia: FichaJerarquia[];
  facciones: Faccion[];
}) {
  const generaciones = arbol.reduce<Record<number, ArbolNodo[]>>((acc, m) => {
    const g = m.generacion ?? 0;
    (acc[g] ??= []).push(m);
    return acc;
  }, {});
  const gens = Object.keys(generaciones).map(Number).sort((a, b) => a - b);

  return (
    <FichaShell
      banner={familia.bannerUrl}
      imagen={familia.imagenUrl}
      titulo={familia.nombre}
      subtitulo={familia.subtitulo}
      nombre={familia.nombre}
      backHref="/familias"
      backLabel="Familias"
      badges={
        <>
          {familia.origen && <Badge tone="accent">{familia.origen}</Badge>}
          {familia.apellido && <Badge>Casa {familia.apellido}</Badge>}
        </>
      }
    >
      <FieldGrid fields={[{ label: "Apellido", value: familia.apellido }, { label: "Origen", value: familia.origen }]} />
      <ProseFields
        fields={[
          { label: "Descripción", value: familia.descripcion },
          { label: "Historia", value: familia.historia },
          { label: "Poder económico", value: familia.poderEconomico },
          { label: "Poder político", value: familia.poderPolitico },
          { label: "Poder militar", value: familia.poderMilitar },
          { label: "Estructura del núcleo", value: familia.estructuraNucleo },
          { label: "Círculo extendido", value: familia.circuloExtendido },
          { label: "Liderazgo", value: familia.liderazgo },
        ]}
      />

      {facciones.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl text-accent">Facciones</h2>
          <div className="flex flex-wrap gap-2">
            {facciones.map((f) => (
              <span key={f.id} className="rounded-full border px-3 py-1 text-sm" style={f.color ? { borderColor: f.color, color: f.color } : undefined}>
                {f.nombre}
              </span>
            ))}
          </div>
        </section>
      )}

      {gens.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-4 font-display text-xl text-accent">Árbol genealógico</h2>
          <div className="space-y-6 overflow-x-auto">
            {gens.map((g) => (
              <div key={g}>
                <p className="mb-2 text-xs uppercase tracking-wider text-fg-muted">Generación {g}</p>
                <div className="flex flex-wrap gap-3">
                  {generaciones[g].map((m) => {
                    const card = (
                      <div className={`min-w-[140px] rounded-xl border p-3 ${m.destacado ? "border-accent/50 bg-accent/5" : "border-border-base bg-surface/40"}`}>
                        <p className="text-sm font-medium text-fg">{m.nombre}</p>
                        {m.estado && <p className="text-xs text-fg-muted">{m.estado}</p>}
                      </div>
                    );
                    return m.personajeId ? (
                      <Link key={m.id} href={`/personajes/${m.personajeId}`} className="transition-transform hover:-translate-y-0.5">{card}</Link>
                    ) : (
                      <div key={m.id}>{card}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <JerarquiaSecciones items={jerarquia} variant="familia" />
    </FichaShell>
  );
}
