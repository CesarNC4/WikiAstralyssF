"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { guardarGremio, type ComplejaFormState } from "@/lib/actions/complejas";
import type { RangoRow, FaccionRow, JerarquiaRow, HistorialRow } from "@/lib/admin/complejas";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { ImageField, type ImageValue } from "@/components/admin/ImageField";
import { Field, TextInput, MarkdownField } from "@/components/admin/fields";
import { RangosEditor } from "@/components/admin/blocks/RangosEditor";
import { FaccionesEditor } from "@/components/admin/blocks/FaccionesEditor";
import { JerarquiaEditor } from "@/components/admin/blocks/JerarquiaEditor";
import { HistorialEditor } from "@/components/admin/blocks/HistorialEditor";
import type { Opcion } from "@/components/admin/blocks/shared";

const v = (x: unknown) => (x == null ? "" : String(x));

export interface GremioInicial {
  gremio: Record<string, unknown>;
  rangos: RangoRow[];
  facciones: FaccionRow[];
  jerarquia: JerarquiaRow[];
  historial: HistorialRow[];
}

const CORTOS: { k: string; label: string }[] = [
  { k: "subtitulo", label: "Subtítulo" },
  { k: "lema", label: "Lema" },
  { k: "sede", label: "Sede" },
];

const LARGOS: { k: string; label: string }[] = [
  { k: "descripcion", label: "Descripción" },
  { k: "historia", label: "Historia" },
  { k: "estructuraGlobal", label: "Estructura global" },
  { k: "jerarquiaRangos", label: "Jerarquía y rangos (texto)" },
  { k: "sistemaMisiones", label: "Sistema de misiones" },
  { k: "principiosGenerales", label: "Principios generales" },
  { k: "normasContratos", label: "Normas y contratos" },
  { k: "conductaAceptable", label: "Conducta aceptable" },
  { k: "conductaIntolerable", label: "Conducta intolerable" },
  { k: "usoFuerza", label: "Uso de la fuerza" },
  { k: "lealtadDiscrecion", label: "Lealtad y discreción" },
  { k: "principioEspadaNeutral", label: "Principio de la espada neutral" },
  { k: "recompensas", label: "Recompensas" },
];

export function GremioForm({ inicial, personajes }: { inicial: GremioInicial; personajes: Opcion[] }) {
  const toast = useToast();
  const g = inicial.gremio;
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);

  const [campos, setCampos] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { nombre: v(g.nombre) };
    for (const x of [...CORTOS, ...LARGOS]) init[x.k] = v(g[x.k]);
    return init;
  });
  const set = (k: string, val: string) => { setCampos((c) => ({ ...c, [k]: val })); mark(); };

  const [imagen, setImagen] = useState<ImageValue>({ assetId: null, url: v(g.imagenUrl) || null });
  const [banner, setBanner] = useState<ImageValue>({ assetId: null, url: v(g.bannerUrl) || null });

  const [rangos, setRangos] = useState<RangoRow[]>(inicial.rangos);
  const [facciones, setFacciones] = useState<FaccionRow[]>(inicial.facciones);
  const [jerarquia, setJerarquia] = useState<JerarquiaRow[]>(inicial.jerarquia);
  const [historial, setHistorial] = useState<HistorialRow[]>(inicial.historial);
  const wrap = <T,>(fn: (x: T) => void) => (x: T) => { fn(x); mark(); };

  const [state, formAction, pending] = useActionState<ComplejaFormState | undefined, FormData>(guardarGremio, undefined);
  useEffect(() => {
    if (!state) return;
    if (state.ok) { toast("Cambios guardados.", "success"); }
    else if (state.error) toast(state.error, "error");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const id = g.id as number;

  const submit = () => {
    const payload = { campos, imagenUrl: imagen.url, bannerUrl: banner.url, rangos, facciones, jerarquia, historial };
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("payload", JSON.stringify(payload));
    setDirty(false); // optimista: guardar = persistir el estado actual
    startTransition(() => formAction(fd));
  };

  return (
    <div className="space-y-4 pb-28">
      <AccordionSection title="Identidad" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre"><TextInput value={campos.nombre} onChange={(x) => set("nombre", x)} placeholder="Gremio de Aventureros" /></Field>
          {CORTOS.map((x) => (
            <Field key={x.k} label={x.label}><TextInput value={campos[x.k]} onChange={(val) => set(x.k, val)} /></Field>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Contenido" subtitle="markdown">
        <div className="space-y-3">
          {LARGOS.map((x) => (
            <Field key={x.k} label={x.label}>
              <MarkdownField value={campos[x.k]} onChange={(val) => set(x.k, val)} rows={x.k === "historia" ? 8 : 5} />
            </Field>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Rangos" subtitle={`${rangos.length}`}>
        <RangosEditor rows={rangos} onChange={wrap(setRangos)} />
      </AccordionSection>
      <AccordionSection title="Facciones" subtitle={`${facciones.length}`}>
        <FaccionesEditor rows={facciones} onChange={wrap(setFacciones)} />
      </AccordionSection>
      <AccordionSection title="Jerarquía" subtitle={`${jerarquia.length} miembros`}>
        <JerarquiaEditor rows={jerarquia} onChange={wrap(setJerarquia)} variant="org" rangos={rangos} facciones={facciones} personajes={personajes} />
      </AccordionSection>
      <AccordionSection title="Historial" subtitle={`${historial.length}`}>
        <HistorialEditor rows={historial} onChange={wrap(setHistorial)} personajes={personajes} />
      </AccordionSection>

      <AccordionSection title="Imágenes">
        <div className="flex flex-wrap gap-8">
          <ImageField label="Imagen / emblema" entidad="gremio" value={imagen} onChange={wrap(setImagen)} alt={campos.nombre} />
          <ImageField label="Banner" entidad="gremio" value={banner} onChange={wrap(setBanner)} alt={campos.nombre} aspect="aspect-video" />
        </div>
      </AccordionSection>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-base bg-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <span className="text-xs text-fg-muted">Registro único · siempre activo</span>
          <button type="button" disabled={pending} onClick={submit} className="ml-auto rounded-lg bg-primary px-5 py-2 text-sm font-medium text-void transition-transform hover:scale-[1.02] disabled:opacity-60">
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
