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
import { PanelConexiones } from "@/components/admin/vinculos/PanelConexiones";
import { Field, TextInput, NumberInput, Select, MultiSelect, MarkdownField, ReferenceField, SliderInput, type MapaCatalogos, type OpcionCatalogo } from "@/components/admin/fields";
import { crearOpcion } from "@/lib/actions/catalogos";
import { MAGIA_FAMILIA_ELEMENTAL } from "@/lib/catalogos";

type Referencias = Partial<Record<RefTarget, OpcionRef[]>>;

const s = (v: unknown) => (v == null ? "" : String(v));

/**
 * Vacía los campos dependientes cuyo `dependsOn` no se cumple, para no persistir
 * datos obsoletos: `submit()` serializa `values` entero, así que un campo oculto
 * con valor viejo llegaría igual a la base de datos (p.ej. la variante de un arma
 * si el tipo deja de ser "Arma").
 *
 * Se aplica al construir el estado inicial y en cada cambio, de modo que `values`
 * está siempre normalizado. Antes lo hacía un `useEffect` que corregía el estado
 * después del render, lo que costaba un render extra por cada cambio de
 * visibilidad y disparaba `react-hooks/set-state-in-effect`.
 *
 * Repite hasta estabilizar, porque vaciar un campo puede ocultar otro que dependa
 * de él. Termina siempre: cada pasada solo vacía campos, nunca los rellena.
 */
function limpiarDependientes(values: Record<string, string>, fields: FieldDef[]) {
  let next = values;
  for (;;) {
    let cambiado = false;
    for (const fd of fields) {
      if (!fd.dependsOn || !next[fd.name]) continue;
      if (next[fd.dependsOn.field] === fd.dependsOn.equals) continue;
      if (next === values) next = { ...values };
      next[fd.name] = "";
      cambiado = true;
    }
    if (!cambiado) return next;
  }
}

export function EntidadForm({
  config,
  inicial,
  catalogos,
  elementos = [],
  referencias = {},
}: {
  config: EntidadConfig;
  inicial: Record<string, unknown> | null;
  catalogos: MapaCatalogos;
  /** El catálogo elemental, agrupado por familia. Viene de la tabla `elementos`. */
  elementos?: OpcionCatalogo[];
  referencias?: Referencias;
}) {
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = { [config.nameField]: s(inicial?.[config.nameField]) };
    for (const fd of config.fields) {
      if (fd.type === "multi") continue;
      v[fd.name] = fd.type === "checkbox" ? String(inicial?.[fd.name] === true) : s(inicial?.[fd.name]);
    }
    return limpiarDependientes(v, config.fields);
  });

  // Los campos de varios valores llevan estado propio: `values` es de textos y
  // una lista no cabe ahí sin inventarse un separador que algún día aparecería
  // dentro de un valor.
  const [multis, setMultis] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    for (const fd of config.fields) {
      if (fd.type !== "multi") continue;
      const raw = inicial?.[fd.name];
      m[fd.name] = Array.isArray(raw) ? raw.map(String) : [];
    }
    return m;
  });
  const setMulti = (name: string, val: string[]) => {
    setMultis((prev) => ({ ...prev, [name]: val }));
    mark();
  };
  const set = (name: string, val: string) => {
    setValues((prev) => limpiarDependientes({ ...prev, [name]: val }, config.fields));
    mark();
  };

  // Campo dependiente: visible solo si su `dependsOn` se cumple con el valor actual.
  const isVisible = (fd: FieldDef) =>
    !fd.dependsOn || values[fd.dependsOn.field] === fd.dependsOn.equals;

  /**
   * Qué grupo del catálogo se ofrece en un campo que depende de otro.
   *
   * `undefined` significa "sin dependencia: enséñalo todo, agrupado". `null`
   * significa "depende de un campo que aún está vacío", y entonces el
   * desplegable se queda a propósito sin opciones en vez de ofrecer las de
   * todos los grupos mezcladas, que es justo lo que pasaba antes en Magia.
   */
  const grupoDe = (fd: FieldDef): string | null | undefined => {
    if (fd.familia) return fd.familia;
    if (!fd.dependeDe) return undefined;
    const padre = values[fd.dependeDe];
    if (!padre) return null;
    // El elemento de una magia no depende de la escuela sino de su familia:
    // "Antigua" ofrece los Antiguos (Lumino, Umbra).
    if (fd.type === "elemento") return MAGIA_FAMILIA_ELEMENTAL[padre] ?? null;
    return padre;
  };

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
    const payload: Record<string, unknown> = { ...values, ...multis, estadoPublicacion: estado };
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
    // Dos columnas en pantallas anchas: la ficha a la izquierda y el panel de
    // conexiones fijo a la derecha, visible mientras editas el resto.
    <div className="pb-28 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
      <div className="space-y-4">
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
              <FieldRender key={fd.name} fd={fd} value={values[fd.name]} onChange={(v) => set(fd.name, v)} multi={multis[fd.name] ?? []} onMulti={(v) => setMulti(fd.name, v)} catalogos={catalogos} elementos={elementos} referencias={referencias} grupoActivo={grupoDe(fd)} error={fe[fd.name]} />
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
                <div key={fd.name} className={fd.type === "textarea" || fd.type === "multi" ? "sm:col-span-2" : ""}>
                  <FieldRender fd={fd} value={values[fd.name]} onChange={(v) => set(fd.name, v)} multi={multis[fd.name] ?? []} onMulti={(v) => setMulti(fd.name, v)} catalogos={catalogos} elementos={elementos} referencias={referencias} grupoActivo={grupoDe(fd)} error={fe[fd.name]} />
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
              <ImageField label="Imagen" entidad={config.key} value={imagen} onChange={(v) => { setImagen(v); mark(); }} alt={values[config.nameField]} />
            )}
            {config.hasBanner && (
              <ImageField label="Banner" entidad={config.key} value={banner} onChange={(v) => { setBanner(v); mark(); }} alt={values[config.nameField]} aspect="aspect-video" />
            )}
          </div>
        </AccordionSection>
      )}

      {/* Sub-listas de texto propias de la ficha (solo al editar: necesitan id) */}
      {id && <RelacionesEditor entidad={config.key} ownerId={id} revalidar={`${config.route}/${id}`} />}

      {/* Galería (solo al editar: necesita un id de entidad existente) */}
      {id && config.hasImage && (
        <GaleriaEditor entidadTipo={config.key} entidadId={id} revalidar={`${config.route}/${id}`} alt={values[config.nameField]} />
      )}

      </div>

      {id && (
        <div className="mt-4 xl:sticky xl:top-4 xl:mt-0 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <PanelConexiones entidad={config.key} ownerId={id} />
        </div>
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
  multi,
  onMulti,
  catalogos,
  elementos,
  referencias,
  grupoActivo,
  error,
}: {
  fd: FieldDef;
  value: string;
  onChange: (v: string) => void;
  multi: string[];
  onMulti: (v: string[]) => void;
  catalogos: MapaCatalogos;
  elementos: OpcionCatalogo[];
  referencias: Referencias;
  grupoActivo?: string | null;
  error?: string;
}) {
  const label = fd.required ? `${fd.label} *` : fd.label;

  // "Añadir al vuelo": lo que escribas queda en el catálogo y disponible para
  // todas las fichas, así que no ensucia como lo haría un campo de texto libre.
  const crear = fd.catalogCampo
    ? (valor: string, grupo: string | null) => crearOpcion(fd.catalogCampo!, valor, grupo)
    : undefined;

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
  if (fd.type === "checkbox") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <label className="flex cursor-pointer items-center gap-2 py-2 text-sm text-fg-secondary">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="h-4 w-4 rounded border-border-base bg-surface accent-[var(--accent)]"
          />
          {fd.label}
        </label>
      </Field>
    );
  }
  if (fd.type === "multi") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <MultiSelect
          values={multi}
          onChange={onMulti}
          options={catalogos[fd.catalogCampo ?? ""] ?? []}
          onCrear={crear}
        />
      </Field>
    );
  }
  if (fd.type === "elemento") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <Select value={value} onChange={onChange} options={elementos} grupoActivo={grupoActivo} />
      </Field>
    );
  }
  if (fd.type === "combobox") {
    return (
      <Field label={label} hint={fd.hint} error={error}>
        <Select
          value={value}
          onChange={onChange}
          options={catalogos[fd.catalogCampo ?? ""] ?? []}
          grupoActivo={grupoActivo}
          onCrear={crear}
        />
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
