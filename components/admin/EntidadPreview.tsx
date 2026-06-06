import { FichaShell, FieldGrid, ProseBlock } from "@/components/fichas/FichaShell";
import type { EntidadConfig } from "@/lib/admin/fields";

const str = (v: unknown) => (v == null || v === "" ? null : String(v));

/** Preview genérico de una entidad simple a partir de su configuración. */
export function EntidadPreview({ config, row }: { config: EntidadConfig; row: Record<string, unknown> }) {
  const nombre = String(row[config.nameField] ?? "");
  const shortFields = config.fields
    .filter((f) => f.type !== "textarea" && f.name !== "subtitulo")
    .map((f) => ({ label: f.label, value: str(row[f.name]) }));
  const longFields = config.fields.filter((f) => f.type === "textarea");

  return (
    <FichaShell
      banner={config.hasBanner ? str(row.bannerUrl) : str(row.imagenUrl)}
      imagen={config.hasImage ? str(row.imagenUrl) : null}
      titulo={nombre}
      subtitulo={str(row.subtitulo)}
      nombre={nombre}
      backHref={config.route}
      backLabel={config.plural}
    >
      <FieldGrid fields={shortFields} />
      {longFields.map((f) => (
        <ProseBlock key={f.name} title={f.label}>
          {str(row[f.name]) ?? undefined}
        </ProseBlock>
      ))}
    </FichaShell>
  );
}
