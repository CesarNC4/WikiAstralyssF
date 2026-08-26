"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import dynamic from "next/dynamic";
import { guardarFamilia, type ComplejaFormState } from "@/lib/actions/complejas";
import type { EstadoPublicacion } from "@/db/schema/enums";
import type { RangoRow, FaccionRow, JerarquiaRow, ArbolRow } from "@/lib/admin/complejas";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { ImageField, type ImageValue } from "@/components/admin/ImageField";
import { Field, TextInput, MarkdownField, Select } from "@/components/admin/fields";
import { RangosEditor } from "@/components/admin/blocks/RangosEditor";
import { FaccionesEditor } from "@/components/admin/blocks/FaccionesEditor";
import { JerarquiaEditor } from "@/components/admin/blocks/JerarquiaEditor";
import type { Opcion } from "@/components/admin/blocks/shared";
import { PanelConexiones } from "@/components/admin/vinculos/PanelConexiones";

// React Flow accede a `window`: cargar solo en cliente.
const ArbolEditor = dynamic(() => import("@/components/admin/blocks/ArbolEditor").then((m) => m.ArbolEditor), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-sm text-fg-muted">Cargando árbol…</p>,
});

const v = (x: unknown) => (x == null ? "" : String(x));

export interface FamiliaInicial {
  familia: Record<string, unknown>;
  rangos: RangoRow[];
  facciones: FaccionRow[];
  jerarquia: JerarquiaRow[];
  arbol: ArbolRow[];
}

const LARGOS: { k: string; label: string }[] = [
  { k: "descripcion", label: "Descripción" },
  { k: "historia", label: "Historia" },
  { k: "poderEconomico", label: "Poder económico" },
  { k: "poderPolitico", label: "Poder político" },
  { k: "poderMilitar", label: "Poder militar" },
  { k: "estructuraNucleo", label: "Estructura del núcleo" },
  { k: "circuloExtendido", label: "Círculo extendido" },
  { k: "liderazgo", label: "Liderazgo" },
];

export function FamiliaForm({
  inicial,
  personajes,
  catalogos,
}: {
  inicial: FamiliaInicial | null;
  personajes: Opcion[];
  catalogos: Record<string, string[]>;
}) {
  const toast = useToast();
  const f = inicial?.familia;
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);

  const [campos, setCampos] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {
      nombre: v(f?.nombre),
      apellido: v(f?.apellido),
      subtitulo: v(f?.subtitulo),
      origen: v(f?.origen),
      poderEconomicoNivel: v(f?.poderEconomicoNivel),
      poderPoliticoNivel: v(f?.poderPoliticoNivel),
      poderMilitarNivel: v(f?.poderMilitarNivel),
    };
    for (const x of LARGOS) init[x.k] = v(f?.[x.k]);
    return init;
  });
  const set = (k: string, val: string) => { setCampos((c) => ({ ...c, [k]: val })); mark(); };

  const [imagen, setImagen] = useState<ImageValue>({ assetId: null, url: v(f?.imagenUrl) || null });
  const [banner, setBanner] = useState<ImageValue>({ assetId: null, url: v(f?.bannerUrl) || null });
  const [estado, setEstado] = useState<EstadoPublicacion>((f?.estadoPublicacion as EstadoPublicacion) ?? "borrador");

  const [rangos, setRangos] = useState<RangoRow[]>(inicial?.rangos ?? []);
  const [facciones, setFacciones] = useState<FaccionRow[]>(inicial?.facciones ?? []);
  const [jerarquia, setJerarquia] = useState<JerarquiaRow[]>(inicial?.jerarquia ?? []);
  const [arbol, setArbol] = useState<ArbolRow[]>(inicial?.arbol ?? []);
  const wrap = <T,>(fn: (x: T) => void) => (x: T) => { fn(x); mark(); };

  const [state, formAction, pending] = useActionState<ComplejaFormState | undefined, FormData>(guardarFamilia, undefined);
  useEffect(() => {
    if (!state) return;
    if (state.ok) { toast("Cambios guardados.", "success"); queueMicrotask(() => setDirty(false)); }
    else if (state.error) toast(state.error, "error");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const id = f?.id as number | undefined;
  const fe = state?.fieldErrors ?? {};

  const submit = () => {
    const payload = {
      campos,
      imagenUrl: imagen.url,
      bannerUrl: banner.url,
      estadoPublicacion: estado,
      rangos, facciones, jerarquia, arbol,
    };
    const fd = new FormData();
    if (id) fd.set("id", String(id));
    fd.set("payload", JSON.stringify(payload));
    startTransition(() => formAction(fd));
  };

  return (
    // Dos columnas en pantallas anchas: la ficha y, a la derecha, el panel de
    // conexiones fijo mientras editas.
    <div className="pb-28 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
      <div className="space-y-4">
      <AccordionSection title="Identidad" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre *" error={fe.nombre}><TextInput value={campos.nombre} onChange={(x) => set("nombre", x)} placeholder="Casa Valeria" /></Field>
          <Field label="Apellido / casa"><TextInput value={campos.apellido} onChange={(x) => set("apellido", x)} /></Field>
          <Field label="Subtítulo"><TextInput value={campos.subtitulo} onChange={(x) => set("subtitulo", x)} /></Field>
          <Field label="Origen"><Select value={campos.origen} onChange={(x) => set("origen", x)} options={catalogos.familia_origen ?? []} placeholder="Selecciona origen…" /></Field>
        </div>
      </AccordionSection>

      <AccordionSection title="Contenido" subtitle="markdown">
        <div className="space-y-3">
          {LARGOS.map((x) => (
            <Field key={x.k} label={x.label}>
              <MarkdownField value={campos[x.k]} onChange={(val) => set(x.k, val)} rows={x.k === "historia" ? 8 : 5} />
            </Field>
          ))}
          <Field label="Niveles de poder (0–100)" hint="Alimentan el radar de 3 ejes en la ficha pública.">
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: "poderEconomicoNivel", label: "Económico" },
                { k: "poderPoliticoNivel", label: "Político" },
                { k: "poderMilitarNivel", label: "Militar" },
              ].map((n) => (
                <label key={n.k} className="block">
                  <span className="mb-1 block text-xs text-fg-muted">{n.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={campos[n.k] ?? ""}
                    onChange={(e) => set(n.k, e.target.value)}
                    className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 font-mono text-sm text-fg outline-none focus:border-border-glow"
                  />
                </label>
              ))}
            </div>
          </Field>
        </div>
      </AccordionSection>

      <AccordionSection title="Rangos" subtitle={`${rangos.length}`}>
        <RangosEditor rows={rangos} onChange={wrap(setRangos)} />
      </AccordionSection>
      <AccordionSection title="Facciones" subtitle={`${facciones.length}`}>
        <FaccionesEditor rows={facciones} onChange={wrap(setFacciones)} />
      </AccordionSection>
      <AccordionSection title="Jerarquía" subtitle={`${jerarquia.length} miembros`}>
        <JerarquiaEditor rows={jerarquia} onChange={wrap(setJerarquia)} variant="familia" rangos={rangos} facciones={facciones} personajes={personajes} />
      </AccordionSection>
      <AccordionSection title="Árbol genealógico" subtitle={`${arbol.length} personas`} defaultOpen>
        <ArbolEditor rows={arbol} onChange={wrap(setArbol)} personajes={personajes} estadoOptions={catalogos.arbol_estado ?? []} />
      </AccordionSection>

      <AccordionSection title="Imágenes">
        <div className="flex flex-wrap gap-8">
          <ImageField label="Imagen / escudo" entidad="familias" value={imagen} onChange={wrap(setImagen)} alt={campos.nombre} />
          <ImageField label="Banner" entidad="familias" value={banner} onChange={wrap(setBanner)} alt={campos.nombre} aspect="aspect-video" />
        </div>
      </AccordionSection>

      </div>

      {id && (
        <div className="mt-4 xl:sticky xl:top-4 xl:mt-0 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <PanelConexiones entidad="familias" ownerId={id} />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-base bg-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="ml-auto flex items-center gap-2">
            <select value={estado} onChange={(e) => { setEstado(e.target.value as EstadoPublicacion); mark(); }} className="rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none">
              <option value="borrador">Borrador</option>
              <option value="publicado">Publicado</option>
              <option value="oculto">Oculto</option>
            </select>
            <button type="button" disabled={pending} onClick={submit} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-void transition-transform hover:scale-[1.02] disabled:opacity-60">
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
