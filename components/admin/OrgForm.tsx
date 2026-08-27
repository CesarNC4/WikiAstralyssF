"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { guardarOrganizacion, type ComplejaFormState } from "@/lib/actions/complejas";
import type { EstadoPublicacion } from "@/db/schema/enums";
import type { RangoRow, FaccionRow, JerarquiaRow, HistorialRow } from "@/lib/admin/complejas";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { ImageField, type ImageValue } from "@/components/admin/ImageField";
import { Field, TextInput, MarkdownField, Select, type MapaCatalogos } from "@/components/admin/fields";
import { crearOpcion } from "@/lib/actions/catalogos";
import { RangosEditor } from "@/components/admin/blocks/RangosEditor";
import { FaccionesEditor } from "@/components/admin/blocks/FaccionesEditor";
import { JerarquiaEditor } from "@/components/admin/blocks/JerarquiaEditor";
import { HistorialEditor } from "@/components/admin/blocks/HistorialEditor";
import type { Opcion } from "@/components/admin/blocks/shared";
import { PanelConexiones } from "@/components/admin/vinculos/PanelConexiones";

const v = (x: unknown) => (x == null ? "" : String(x));

export interface OrgInicial {
  org: Record<string, unknown>;
  rangos: RangoRow[];
  facciones: FaccionRow[];
  jerarquia: JerarquiaRow[];
  historial: HistorialRow[];
}

const LARGOS: { k: string; label: string }[] = [
  { k: "descripcion", label: "Descripción" },
  { k: "historia", label: "Historia" },
  { k: "objetivo", label: "Objetivo" },
  { k: "fundacion", label: "Fundación" },
  { k: "ideologia", label: "Ideología" },
  { k: "liderazgo", label: "Liderazgo" },
  { k: "miembrosDestacados", label: "Miembros destacados" },
  { k: "estructuraInterna", label: "Estructura interna" },
  { k: "relacionFacciones", label: "Relación entre facciones" },
  { k: "notasAdicionales", label: "Notas adicionales" },
];

export function OrgForm({
  inicial,
  personajes,
  catalogos,
}: {
  inicial: OrgInicial | null;
  personajes: Opcion[];
  catalogos: MapaCatalogos;
}) {
  const toast = useToast();
  const o = inicial?.org;
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);

  const [campos, setCampos] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {
      nombre: v(o?.nombre),
      subtitulo: v(o?.subtitulo),
      tipo: v(o?.tipo),
      sede: v(o?.sede),
      estado: v(o?.estado),
    };
    for (const f of LARGOS) init[f.k] = v(o?.[f.k]);
    return init;
  });
  const set = (k: string, val: string) => { setCampos((c) => ({ ...c, [k]: val })); mark(); };

  const [imagen, setImagen] = useState<ImageValue>({ assetId: null, url: v(o?.imagenUrl) || null });
  const [banner, setBanner] = useState<ImageValue>({ assetId: null, url: v(o?.bannerUrl) || null });
  const [estado, setEstado] = useState<EstadoPublicacion>((o?.estadoPublicacion as EstadoPublicacion) ?? "borrador");

  const [rangos, setRangos] = useState<RangoRow[]>(inicial?.rangos ?? []);
  const [facciones, setFacciones] = useState<FaccionRow[]>(inicial?.facciones ?? []);
  const [jerarquia, setJerarquia] = useState<JerarquiaRow[]>(inicial?.jerarquia ?? []);
  const [historial, setHistorial] = useState<HistorialRow[]>(inicial?.historial ?? []);
  const wrap = <T,>(fn: (x: T) => void) => (x: T) => { fn(x); mark(); };

  const [state, formAction, pending] = useActionState<ComplejaFormState | undefined, FormData>(guardarOrganizacion, undefined);
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

  const id = o?.id as number | undefined;
  const fe = state?.fieldErrors ?? {};

  const submit = () => {
    const payload = {
      campos,
      imagenUrl: imagen.url,
      bannerUrl: banner.url,
      estadoPublicacion: estado,
      rangos, facciones, jerarquia, historial,
    };
    const fd = new FormData();
    if (id) fd.set("id", String(id));
    fd.set("payload", JSON.stringify(payload));
    setDirty(false); // optimista: guardar = persistir el estado actual
    startTransition(() => formAction(fd));
  };

  return (
    // Dos columnas en pantallas anchas: la ficha y, a la derecha, el panel de
    // conexiones fijo mientras editas.
    <div className="pb-28 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
      <div className="space-y-4">
      <AccordionSection title="Identidad" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre *" error={fe.nombre}><TextInput value={campos.nombre} onChange={(x) => set("nombre", x)} placeholder="Orden del Alba" /></Field>
          <Field label="Subtítulo"><TextInput value={campos.subtitulo} onChange={(x) => set("subtitulo", x)} /></Field>
          <Field label="Tipo"><Select value={campos.tipo} onChange={(x) => set("tipo", x)} options={catalogos.org_tipo ?? []} placeholder="Orden, gremio, secta…" onCrear={(v, g) => crearOpcion("org_tipo", v, g)} /></Field>
          <Field label="Estado" hint="vitalidad"><Select value={campos.estado} onChange={(x) => set("estado", x)} options={catalogos.org_estado ?? []} placeholder="Activa, en declive, disuelta…" /></Field>
          <Field label="Legalidad" hint="una organización activa puede ser clandestina"><Select value={campos.legalidad} onChange={(x) => set("legalidad", x)} options={catalogos.org_legalidad ?? []} placeholder="Oficial, tolerada, clandestina…" /></Field>
          <Field label="Sede"><TextInput value={campos.sede} onChange={(x) => set("sede", x)} /></Field>
        </div>
      </AccordionSection>

      <AccordionSection title="Contenido" subtitle="markdown">
        <div className="space-y-3">
          {LARGOS.map((f) => (
            <Field key={f.k} label={f.label}>
              <MarkdownField value={campos[f.k]} onChange={(x) => set(f.k, x)} rows={f.k === "historia" ? 8 : 5} />
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
          <ImageField label="Imagen / escudo" entidad="organizaciones" value={imagen} onChange={wrap(setImagen)} alt={campos.nombre} />
          <ImageField label="Banner" entidad="organizaciones" value={banner} onChange={wrap(setBanner)} alt={campos.nombre} aspect="aspect-video" />
        </div>
      </AccordionSection>

      </div>

      {id && (
        <div className="mt-4 xl:sticky xl:top-4 xl:mt-0 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <PanelConexiones entidad="organizaciones" ownerId={id} />
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
