"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { guardarFechaFicha } from "@/lib/actions/fechas";
import { validarFecha, type Calendario, type Fecha, type RolFecha } from "@/lib/fechas";
import { AccordionSection } from "@/components/admin/ui";
import { FechaInput } from "@/components/admin/FechaInput";
import { useToast } from "@/components/admin/Toast";

export interface FechaInicial {
  fecha: Fecha;
  importante: boolean;
}

/**
 * Las fechas de una ficha en su editor (spec §13): una por rol (nacimiento y
 * muerte, fundación y caída…), cada una con su casilla de importancia.
 *
 * Cada fecha se guarda por su cuenta y al momento, como las conexiones: no
 * depende del botón "Guardar" del formulario, así que sirve igual dentro de
 * cualquier editor.
 */
export function FechasEditor({
  entidad,
  id,
  roles,
  inicial,
  cal,
}: {
  entidad: string;
  id: number;
  roles: RolFecha[];
  inicial: Record<string, FechaInicial>;
  cal: Calendario;
}) {
  const n = roles.filter((r) => inicial[r.rol]).length;
  return (
    <AccordionSection
      title="Fechas"
      subtitle={n ? `${n} de ${roles.length}` : "Sin fechas"}
      defaultOpen
    >
      <div className="space-y-4">
        {roles.map((r) => (
          <UnaFecha key={r.rol} entidad={entidad} id={id} rol={r} inicial={inicial[r.rol] ?? null} cal={cal} />
        ))}
        <p className="text-xs text-fg-muted">
          El año 0 es el inicio de la trama principal; antes, negativos. Los meses y las eras se configuran en{" "}
          <Link href="/admin/taller/universo/calendario/configurar" className="text-accent hover:underline">
            Universo › Calendario
          </Link>
          .
        </p>
      </div>
    </AccordionSection>
  );
}

function UnaFecha({
  entidad,
  id,
  rol,
  inicial,
  cal,
}: {
  entidad: string;
  id: number;
  rol: RolFecha;
  inicial: FechaInicial | null;
  cal: Calendario;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [fecha, setFecha] = useState<Fecha | null>(inicial?.fecha ?? null);
  const [importante, setImportante] = useState(inicial?.importante ?? false);
  const [cambios, setCambios] = useState(false);
  // Al quitar una fecha se remonta el editor para vaciar también su texto.
  const [version, setVersion] = useState(0);

  const errores = fecha ? validarFecha(cal, fecha) : [];

  const guardar = (f: Fecha | null, imp: boolean) =>
    start(async () => {
      const r = await guardarFechaFicha(entidad, id, rol.rol, f, imp);
      if (!r.ok) return toast(r.error, "error");
      setCambios(false);
      toast(f ? `${rol.etiqueta}: guardada.` : `${rol.etiqueta}: quitada.`, "success");
      router.refresh();
    });

  return (
    <div className="rounded-xl border border-border-base bg-surface/30 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h4 className="text-sm font-medium text-fg">{rol.etiqueta}</h4>
        <label className="flex items-center gap-1.5 text-xs text-fg-secondary" title="Sale en la cronología destacada">
          <input
            type="checkbox"
            checked={importante}
            onChange={(e) => {
              setImportante(e.target.checked);
              setCambios(true);
            }}
          />
          Importante
        </label>
        <div className="ml-auto flex gap-2">
          {inicial && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setFecha(null);
                setImportante(false);
                setVersion((v) => v + 1);
                guardar(null, false);
              }}
              className="rounded-lg border border-border-base px-3 py-1 text-xs text-fg-muted hover:text-error disabled:opacity-50"
            >
              Quitar
            </button>
          )}
          <button
            type="button"
            disabled={pending || !cambios || !fecha || errores.length > 0}
            onClick={() => guardar(fecha, importante)}
            className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-void disabled:opacity-40"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
      <FechaInput
        key={version}
        cal={cal}
        value={fecha}
        onChange={(f) => {
          setFecha(f);
          setCambios(true);
        }}
      />
    </div>
  );
}
