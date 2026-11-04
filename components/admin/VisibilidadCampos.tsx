"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { CandadosFicha, useCandados } from "@/components/admin/candados";
import { moldeDe } from "@/lib/propuestas/moldes";
import { BLOQUES_OCULTABLES } from "@/lib/visibilidad";

/** Lo que no es una columna de texto del molde pero también se puede ocultar. */
const IMAGENES = [
  { name: "imagenUrl", label: "Imagen" },
  { name: "bannerUrl", label: "Banner" },
  { name: "galeria", label: "Galería" },
];
const SIN_IMAGENES = new Set(["actos", "timeline"]);
/** Colocan la ficha en su sitio: sin ellos no habría URL ni orden. */
const NO_OCULTABLES = new Set(["slug", "capituloId", "numeroOrden", "orden"]);

/**
 * Todo lo que se puede ocultar de una ficha, de un vistazo. Cada campo lleva
 * además su candado junto al rótulo en el formulario; esta lista es el resumen y
 * el único sitio para lo que no tiene campo propio (imágenes, galería).
 */
export function VisibilidadCampos({ entidad, ownerId }: { entidad: string; ownerId: number }) {
  // Dentro de un formulario comparte los candados con sus campos.
  return useCandados() ? (
    <Lista entidad={entidad} />
  ) : (
    <CandadosFicha entidad={entidad} id={ownerId}>
      <Lista entidad={entidad} />
    </CandadosFicha>
  );
}

function Lista({ entidad }: { entidad: string }) {
  const c = useCandados();
  const [abierto, setAbierto] = useState(false);
  const molde = moldeDe(entidad);
  if (!molde || !c) return null;

  const campos = [
    ...molde.campos.filter((f) => f.name !== molde.nombre && !NO_OCULTABLES.has(f.name)),
    ...(BLOQUES_OCULTABLES[entidad] ?? []),
    ...(SIN_IMAGENES.has(entidad) ? [] : IMAGENES),
  ];
  const n = campos.filter((f) => c.ocultos.has(f.name)).length;

  return (
    <section className="rounded-xl border border-border-base bg-surface/30">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={abierto}
      >
        <Icon name="EyeOff" size={15} className="text-fg-muted" />
        <span className="text-sm font-medium text-fg">Campos ocultos</span>
        {n > 0 && <span className="rounded-full bg-surface px-1.5 text-xs text-warning">{n}</span>}
        <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={14} className="ml-auto text-fg-muted" />
      </button>

      {abierto && (
        <div className="px-3 pb-3">
          <p className="mb-2 text-xs text-fg-muted">
            Lo marcado sale como «???» en la ficha pública, pero sigue guardado y editable aquí. Las conexiones y las fechas llevan su propio candado.
          </p>
          <ul className="space-y-1">
            {campos.map((f) => {
              const oculto = c.ocultos.has(f.name);
              return (
                <li key={f.name}>
                  <label className="flex items-center gap-2 text-sm text-fg-secondary">
                    <input type="checkbox" checked={oculto} onChange={() => c.alternar(f.name)} />
                    <span className={oculto ? "text-warning" : undefined}>{f.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
