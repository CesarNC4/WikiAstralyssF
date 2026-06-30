"use client";

import { useActionState, useEffect, useMemo, useState, startTransition } from "react";
import Link from "next/link";
import { guardarEntidad, type EntidadFormState } from "@/lib/actions/entidades";
import type { EntidadConfig, FieldDef, RefTarget } from "@/lib/admin/fields";
import type { OpcionRef } from "@/lib/queries/adminEntidades";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { ImageField, type ImageValue } from "@/components/admin/ImageField";
import { GaleriaEditor } from "@/components/admin/blocks/GaleriaEditor";
import { RelacionesEditor } from "@/components/admin/blocks/RelacionEditor";
import { Field, TextInput, NumberInput, Select, MarkdownField, ReferenceField, SliderInput } from "@/components/admin/fields";

type Referencias = Partial<Record<RefTarget, OpcionRef[]>>;

const s = (v: unknown) => (v == null ? "" : String(v));

export function EntidadForm({
  config,
  inicial,
  catalogos,
  referencias = {},
}: {
  config: EntidadConfig;
  inicial: Record<string, unknown> | null;
  catalogos: Record<string, string[]>;
  referencias?: Referencias;
}) {
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = { [config.nameField]: s(inicial?.[config.nameField]) };
    for (const fd of config.fields) v[fd.name] = s(inicial?.[fd.name]);
    return v;
  });
  const set = (name: string, val: string) => {
    setValues((prev) => ({ ...prev, [name]: val }));
    mark();
  };

  // Campo dependiente: visible solo si su `dependsOn` se cumple con el valor actual.
  const isVisible = (fd: FieldDef) =>
    !fd.dependsOn || values[fd.dependsOn.field] === fd.dependsOn.equals;

  // Limpia el valor de un campo dependiente cuando deja de ser visible, para no
  // persistir datos obsoletos (p.ej. la variante de un arma si el tipo deja de ser "Arma").
  useEffect(() => {
    const stale = config.fields.filter((fd) => !isVisible(fd) && values[fd.name]);
    if (stale.length === 0) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const fd of stale) next[fd.name] = "";
      return next;
    });
  }, [values, config.fields]); // eslint-disable-line react-hooks/exhaustive-deps

  const [imagen, setImagen] = useState<ImageValue>({ assetId: null, url: s(inicial?.imagenUrl) || null });
  const [banner, setBanner] = useState<ImageValue>({ assetId: null, url: s(inicial?.bannerUrl) || null });
  const [estado, setEstado] = useState<EstadoPublicacion>(
    (inicial?.estadoPublicacion as EstadoPublicacion) ?? "borrador",
  );

  const [state, formAction, pending] = useActionState<EntidadFormState | undefined, FormData>(
    guardarEntidad,
    undefined,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast("Cambios guardados.", "success");
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const id = inicial?.id as number | undefined;

  const submit = () => {
    const payload: Record<string, unknown> = { ...values, estadoPublicacion: estado };
    if (config.hasImage) {
      payload.imagenUrl = imagen.url;
      payload.imagenAssetId = imagen.assetId;
    }
    if (config.hasBanner) {
      payload.bannerUrl = banner.url;
      payload.bannerAssetId = banner.assetId;
    }
    const fd = new FormData();
    fd.set("entidad", config.key);
    if (id) fd.set("id", String(id));
    fd.set("payload", JSON.stringify(payload));
    setDirty(false); // optimista: guardar = persistir el estado actual
    startTransition(() => formAction(fd));
  };

  // Agrupar campos por sección, preservando el orden de aparición.
  const groups = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, FieldDef[]> = {};
    for (const fd of config.fields) {
      if (!map[fd.group]) {
        map[fd.group] = [];
        order.push(fd.group);
      }
      map[fd.group].push(fd);
    }
    return order.map((g) => ({ group: g, fields: map[g] }));
  }, [config]);

  const fe = state?.fieldErrors ?? {};

  return (
    <div className="space-y-4 pb-28">
      {config.nota && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-glow/60 bg-deep/40 px-4 py-3 text-sm text-fg-secondary">
          <span>{config.nota}</span>
          <Link href="/admin/mapa" className="ml-auto shrink-0 text-accent hover:underline">Abrir Mapa →</Link>
        </div>
      )}
      {/* Nombre (siempre primero, obligatorio) */}
      <AccordionSection title="Identidad" defaultOpen badge={fe[config.nameField] ? <span className="text-xs text-error">!</span> : null}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`${config.nameLabel ?? "Nombre"} *`} error={fe[config.nameField]}>
            <TextInput value={values[config.nameField]} onChange={(v) => set(config.nameField, v)} placeholder={config.nameLabel ?? "Nombre"} />
          </Field>
          {groups
            .find((g) => g.group === "Identidad")
            ?.fields.filter(isVisible)
            .map((fd) => (
              <FieldRender key={fd.name} fd={fd} value={values[fd.name]} onChange={(v) => set(fd.name, v)} catalogos={catalogos} referencias={referencias} error={fe[fd.name]} />
            ))}
        </div>
      </AccordionSection>

      {/* Resto de grupos */}
      {groups
        .filter((g) => g.group !== "Identidad")
        .map(({ group, fields }) => (
          <AccordionSection key={group} title={group}>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.filter(isVisible).map((fd) => (
                <div key={fd.name} className={fd.type === "textarea" ? "sm:col-span-2" : ""}>
                  <FieldRender fd={fd} value={values[fd.name]} onChange={(v) => set(fd.name, v)} catalogos={catalogos} referencias={referencias} error={fe[fd.name]} />
                </div>
              ))}
            </div>
          </AccordionSection>
        ))}

      {/* Imágenes */}
      {(config.hasImage || config.hasBanner) && (
        <AccordionSection title="Imágenes">
          <div className="flex flex-wrap gap-8">
            {config.hasImage && (
              <ImageField label="Imagen" value={imagen} onChange={(v) => { setImagen(v); mark(); }} alt={values[config.nameField]} />
            )}
            {config.hasBanner && (
              <ImageField label="Banner" value={banner} onChange={(v) => { setBanner(v); mark(); }} alt={values[config.nameField]} aspect="aspect-video" />
            )}
          </div>
        </AccordionSection>
      )}

      {/* Relaciones N:M (solo al editar: necesitan un id de entidad existente) */}
      {id && <RelacionesEditor entidad={config.key} ownerId={id} revalidar={`${config.route}/${id}`} />}

      {/* Galería (solo al editar: necesita un id de entidad existente) */}
      {id && config.hasImage && (
        <GaleriaEditor entidadTipo={config.key} entidadId={id} revalidar={`${config.route}/${id}`} alt={values[config.nameField]} />
      )}

      {/* Barra de acciones */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-base bg-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="ml-auto flex items-center gap-2">
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value as EstadoPublicacion); mark(); }}
              className="rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none"
            >
              <option value="borrador">Borrador</option>
              <option value="publicado">Publicado</option>
              <option value="oculto">Oculto</option>
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-void transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRender({
  fd,
  value,
  onChange,
  catalogos,
  referencias,
  error,
}: {
  fd: FieldDef;
  value: string;
  onChange: (v: string) => void;
  catalogos: Record<string, string[]>;
  referencias: Referencias;
  error?: string;
}) {
  const label = fd.required ? `${fd.label} *` : fd.label;
  if (fd.type === "textarea") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <MarkdownField value={value} onChange={onChange} rows={fd.rows ?? 5} />
      </Field>
    );
  }
  if (fd.type === "number") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <NumberInput value={value} onChange={onChange} />
      </Field>
    );
  }
  if (fd.type === "slider") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <SliderInput value={value} onChange={onChange} />
      </Field>
    );
  }
  if (fd.type === "combobox") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <Select value={value} onChange={onChange} options={catalogos[fd.catalogCampo ?? ""] ?? []} />
      </Field>
    );
  }
  if (fd.type === "reference") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <ReferenceField value={value} onChange={onChange} options={referencias[fd.refTarget!] ?? []} />
      </Field>
    );
  }
  return (
    <Field label={label} hint={fd.hint} error={error}>
      <TextInput value={value} onChange={onChange} />
    </Field>
  );
}
