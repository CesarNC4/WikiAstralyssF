"use client";

import { useActionState, useEffect, useMemo, useState, startTransition, type ReactNode } from "react";
import { guardarPersonaje, type PersonajeFormState } from "@/lib/actions/personajes";
import type { PersonajeParaEditar, Opcion } from "@/lib/queries/adminPersonajes";
import type { CatalogosPersonaje } from "@/lib/queries/catalogos";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection, Repeater, MultiPicker } from "@/components/admin/ui";
import { ImageField, type ImageValue } from "@/components/admin/ImageField";
import {
  Field,
  TextInput,
  NumberInput,
  Combobox,
  MagiaPicker,
  MarkdownField,
} from "@/components/admin/fields";

// ── tipos locales del estado del formulario ─────────────────────────────────
interface Hab { idHabilidad?: number; categoria: string; nombre: string; descripcion: string; tipo: string; magiaFundamentoId: number | null }
interface Ev { idEvento?: number; fecha: string; titulo: string; descripcion: string }
interface Eq { idArma?: number; nombre: string; tipo: string; descripcion: string; poderEspecial: string }
interface Ob { idObjeto?: number; nombre: string; tipo: string; descripcion: string }
interface Rel { idRr?: number; personajeRelacionadoId: number | null; relLabel: string; nombreExterno: string; tipoRelacion: string; subtipoRelacion: string; descripcion: string }
interface NacSel { nacionId: number; label: string; tipo: string; descripcion: string }
interface RazSel { razaId: number; label: string; esMixta: boolean; nota: string }
interface OrgSel { organizacionId: number; label: string; rol: string; tipo: string; descripcion: string }

const STAT_KEYS = [
  "fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma",
  "mpMax", "ataqueFisico", "ataqueMagico", "defensaFisica", "defensaMagica",
  "velocidad", "capacidadDeReaccion", "precisionVal",
] as const;
const RATING_KEYS = [
  "rangoCuerpoACuerpo", "rangoDistancia", "danoMagico", "defensa", "apoyo", "movilidad", "controlDeMasas",
] as const;
type StatKey = (typeof STAT_KEYS)[number];
type RatingKey = (typeof RATING_KEYS)[number];

const s = (v: unknown) => (v == null ? "" : String(v));

export function PersonajeForm({
  inicial,
  catalogos,
  personajesOpts,
  nacionesOpts,
  razasOpts,
  organizacionesOpts,
}: {
  inicial: PersonajeParaEditar | null;
  catalogos: CatalogosPersonaje;
  personajesOpts: Opcion[];
  nacionesOpts: Opcion[];
  razasOpts: Opcion[];
  organizacionesOpts: Opcion[];
}) {
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  const st = inicial?.estadisticas?.[0];
  const initStats: Record<string, string> = {};
  [...STAT_KEYS, ...RATING_KEYS].forEach((k) => (initStats[k] = s((st as Record<string, unknown> | undefined)?.[k])));

  // ── estado del formulario ──
  const [f, setF] = useState({
    nombre: s(inicial?.nombre), surname: s(inicial?.surname), titulo: s(inicial?.titulo),
    subtitulo: s(inicial?.subtitulo), edad: s(inicial?.edad), genero: s(inicial?.genero),
    altura: s(inicial?.altura), ocupacion: s(inicial?.ocupacion), rangoAventurero: s(inicial?.rangoAventurero),
    lugarNacimiento: s(inicial?.lugarNacimiento), familia: s(inicial?.familia),
    esInvocado: Boolean(inicial?.esInvocado), tipoInvocacion: s(inicial?.tipoInvocacion),
    historia: s(inicial?.historia), rasgosPersonalidad: s(inicial?.rasgosPersonalidad),
    motivacion: s(inicial?.motivacion), miedos: s(inicial?.miedos), filosofia: s(inicial?.filosofia),
    gustos: s(inicial?.gustos), disgustos: s(inicial?.disgustos), debilidades: s(inicial?.debilidades),
    tipoMagiaPrincipal: s(inicial?.tipoMagiaPrincipal), magiaSecundaria: s(inicial?.magiaSecundaria),
    nivelDeConsciencia: s(inicial?.nivelDeConsciencia), circuitoForte: s(inicial?.circuitoForte),
    essentia: s(inicial?.essentia), zenithra: s(inicial?.zenithra), bendicion: s(inicial?.bendicion),
    segundoDespertar: s(inicial?.segundoDespertar),
    estadoPublicacion: (inicial?.estadoPublicacion ?? "borrador") as EstadoPublicacion,
  });
  const patch = (p: Partial<typeof f>) => { setF((prev) => ({ ...prev, ...p })); markDirty(); };

  const [imagen, setImagen] = useState<ImageValue>({ assetId: inicial?.imagenAssetId ?? null, url: s(inicial?.imagenUrl) || null });
  const [banner, setBanner] = useState<ImageValue>({ assetId: inicial?.bannerAssetId ?? null, url: s(inicial?.bannerUrl) || null });
  const [stats, setStats] = useState<Record<string, string>>(initStats);
  const setStat = (k: string, v: string) => { setStats((p) => ({ ...p, [k]: v })); markDirty(); };

  const [habilidades, setHabilidades] = useState<Hab[]>(
    (inicial?.habilidades ?? []).map((h) => ({ idHabilidad: h.idHabilidad, categoria: s(h.categoria), nombre: s(h.nombre), descripcion: s(h.descripcion), tipo: s(h.tipo), magiaFundamentoId: h.magiaFundamentoId ?? null })),
  );
  const [eventos, setEventos] = useState<Ev[]>(
    (inicial?.eventos ?? []).map((e) => ({ idEvento: e.idEvento, fecha: s(e.fecha), titulo: s(e.titulo), descripcion: s(e.descripcion) })),
  );
  const [equipamiento, setEquip] = useState<Eq[]>(
    (inicial?.equipamiento ?? []).map((q) => ({ idArma: q.idArma, nombre: s(q.nombre), tipo: s(q.tipo), descripcion: s(q.descripcion), poderEspecial: s(q.poderEspecial) })),
  );
  const [objetos, setObjetos] = useState<Ob[]>(
    (inicial?.objetos ?? []).map((o) => ({ idObjeto: o.idObjeto, nombre: s(o.nombre), tipo: s(o.tipo), descripcion: s(o.descripcion) })),
  );
  const [relaciones, setRelaciones] = useState<Rel[]>(
    (inicial?.relaciones ?? []).map((r) => ({
      idRr: r.idRr, personajeRelacionadoId: r.personajeRelacionadoId ?? null,
      relLabel: r.relacionado ? [r.relacionado.nombre, r.relacionado.surname].filter(Boolean).join(" ") : "",
      nombreExterno: s(r.nombreExterno), tipoRelacion: s(r.tipoRelacion), subtipoRelacion: s(r.subtipoRelacion), descripcion: s(r.descripcion),
    })),
  );
  const [naciones, setNaciones] = useState<NacSel[]>(
    (inicial?.naciones ?? []).filter((n) => n.nacion).map((n) => ({ nacionId: n.nacion!.id, label: n.nacion!.nombre, tipo: s(n.tipo), descripcion: s(n.descripcion) })),
  );
  const [razas, setRazas] = useState<RazSel[]>(
    (inicial?.razas ?? []).filter((r) => r.raza).map((r) => ({ razaId: r.raza!.id, label: r.raza!.nombre, esMixta: Boolean(r.esMixta), nota: s(r.nota) })),
  );
  const [organizaciones, setOrgs] = useState<OrgSel[]>(
    (inicial?.organizaciones ?? []).filter((o) => o.organizacion).map((o) => ({ organizacionId: o.organizacion!.id, label: o.organizacion!.nombre, rol: s(o.rol), tipo: s(o.tipo), descripcion: s(o.descripcion) })),
  );

  const wrapSetter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); markDirty(); };

  // ── submit ──
  const [state, formAction, pending] = useActionState<PersonajeFormState | undefined, FormData>(guardarPersonaje, undefined);

  useEffect(() => {
    if (!state) return;
    // La creación redirige en el servidor; aquí solo manejamos guardado de edición y errores.
    if (state.ok) {
      toast("Cambios guardados.", "success");
      setDirty(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── aviso al salir con cambios sin guardar ──
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const submit = () => {
    const statsHasValue = [...STAT_KEYS, ...RATING_KEYS].some((k) => s(stats[k]).trim() !== "");
    const payload = {
      ...f,
      imagenAssetId: imagen.assetId, imagenUrl: imagen.url,
      bannerAssetId: banner.assetId, bannerUrl: banner.url,
      estadisticas: statsHasValue ? stats : null,
      habilidades, eventos, equipamiento, objetos,
      relaciones: relaciones.map((r) => ({
        idRr: r.idRr,
        personajeRelacionadoId: r.personajeRelacionadoId,
        nombreExterno: r.nombreExterno,
        tipoRelacion: r.tipoRelacion,
        subtipoRelacion: r.subtipoRelacion,
        descripcion: r.descripcion,
      })), // relLabel es solo de UI; no se envía
      naciones: naciones.map((n) => ({ nacionId: n.nacionId, tipo: n.tipo, descripcion: n.descripcion })),
      razas: razas.map((r) => ({ razaId: r.razaId, esMixta: r.esMixta, nota: r.nota })),
      organizaciones: organizaciones.map((o) => ({ organizacionId: o.organizacionId, rol: o.rol, tipo: o.tipo, descripcion: o.descripcion })),
    };
    const fd = new FormData();
    if (inicial?.id) fd.set("id", String(inicial.id));
    fd.set("payload", JSON.stringify(payload));
    startTransition(() => formAction(fd));
  };

  const incompleta = useMemo(() => {
    const w: string[] = [];
    if (!f.historia.trim()) w.push("Falta la historia");
    return w;
  }, [f.historia]);

  const fe = state?.fieldErrors ?? {};

  return (
    <div className="space-y-4 pb-28">
      {/* Identidad */}
      <AccordionSection title="Identidad" defaultOpen badge={fe.nombre ? <span className="text-xs text-error">!</span> : null}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre *" error={fe.nombre}><TextInput value={f.nombre} onChange={(v) => patch({ nombre: v })} placeholder="Nombre" /></Field>
          <Field label="Apellido"><TextInput value={f.surname} onChange={(v) => patch({ surname: v })} /></Field>
          <Field label="Título"><TextInput value={f.titulo} onChange={(v) => patch({ titulo: v })} /></Field>
          <Field label="Subtítulo"><TextInput value={f.subtitulo} onChange={(v) => patch({ subtitulo: v })} /></Field>
          <Field label="Edad"><TextInput value={f.edad} onChange={(v) => patch({ edad: v })} /></Field>
          <Field label="Género"><Combobox value={f.genero} onChange={(v) => patch({ genero: v })} options={catalogos.genero} campo="genero" /></Field>
          <Field label="Altura (m)"><NumberInput value={f.altura} onChange={(v) => patch({ altura: v })} placeholder="1.75" /></Field>
          <Field label="Ocupación"><TextInput value={f.ocupacion} onChange={(v) => patch({ ocupacion: v })} /></Field>
          <Field label="Rango aventurero"><Combobox value={f.rangoAventurero} onChange={(v) => patch({ rangoAventurero: v })} options={catalogos.rango_aventurero} campo="rango_aventurero" /></Field>
          <Field label="Lugar de nacimiento"><TextInput value={f.lugarNacimiento} onChange={(v) => patch({ lugarNacimiento: v })} /></Field>
          <Field label="Familia (texto)"><TextInput value={f.familia} onChange={(v) => patch({ familia: v })} /></Field>
          <Field label="Tipo de invocación"><TextInput value={f.tipoInvocacion} onChange={(v) => patch({ tipoInvocacion: v })} /></Field>
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            <input type="checkbox" checked={f.esInvocado} onChange={(e) => patch({ esInvocado: e.target.checked })} />
            Es invocado
          </label>
        </div>
      </AccordionSection>

      {/* Historia y personalidad */}
      <AccordionSection title="Historia y personalidad" subtitle="markdown">
        <div className="space-y-3">
          <Field label="Historia"><MarkdownField value={f.historia} onChange={(v) => patch({ historia: v })} rows={8} /></Field>
          <Field label="Rasgos de personalidad"><MarkdownField value={f.rasgosPersonalidad} onChange={(v) => patch({ rasgosPersonalidad: v })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Motivación"><MarkdownField value={f.motivacion} onChange={(v) => patch({ motivacion: v })} rows={4} /></Field>
            <Field label="Miedos"><MarkdownField value={f.miedos} onChange={(v) => patch({ miedos: v })} rows={4} /></Field>
            <Field label="Filosofía"><MarkdownField value={f.filosofia} onChange={(v) => patch({ filosofia: v })} rows={4} /></Field>
            <Field label="Debilidades"><MarkdownField value={f.debilidades} onChange={(v) => patch({ debilidades: v })} rows={4} /></Field>
            <Field label="Gustos"><MarkdownField value={f.gustos} onChange={(v) => patch({ gustos: v })} rows={4} /></Field>
            <Field label="Disgustos"><MarkdownField value={f.disgustos} onChange={(v) => patch({ disgustos: v })} rows={4} /></Field>
          </div>
        </div>
      </AccordionSection>

      {/* Magia y combate */}
      <AccordionSection title="Magia y combate">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Magia principal"><MagiaPicker value={f.tipoMagiaPrincipal} onChange={(v) => patch({ tipoMagiaPrincipal: v })} tipos={catalogos.magiaTipos} variantes={catalogos.magiaVariantes} /></Field>
          <Field label="Magia secundaria"><MagiaPicker value={f.magiaSecundaria} onChange={(v) => patch({ magiaSecundaria: v })} tipos={catalogos.magiaTipos} variantes={catalogos.magiaVariantes} /></Field>
          <Field label="Nivel de consciencia"><Combobox value={f.nivelDeConsciencia} onChange={(v) => patch({ nivelDeConsciencia: v })} options={catalogos.nivel_consciencia} campo="nivel_consciencia" /></Field>
          <Field label="Circuito Forte" hint="texto libre"><TextInput value={f.circuitoForte} onChange={(v) => patch({ circuitoForte: v })} /></Field>
          <Field label="Essentia" hint="texto libre"><TextInput value={f.essentia} onChange={(v) => patch({ essentia: v })} /></Field>
          <Field label="Zenithra" hint="texto libre"><TextInput value={f.zenithra} onChange={(v) => patch({ zenithra: v })} /></Field>
          <Field label="Bendición" hint="texto libre"><TextInput value={f.bendicion} onChange={(v) => patch({ bendicion: v })} /></Field>
          <Field label="Segundo despertar"><TextInput value={f.segundoDespertar} onChange={(v) => patch({ segundoDespertar: v })} /></Field>
        </div>
      </AccordionSection>

      {/* Stats */}
      <AccordionSection title="Estadísticas">
        <p className="mb-2 text-xs text-fg-muted">Atributos primarios: 0–100. El resto, enteros sin tope.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {STAT_KEYS.map((k) => (
            <Field key={k} label={statLabel(k)} error={fe[`estadisticas.${k}`]}>
              <NumberInput value={stats[k] ?? ""} onChange={(v) => setStat(k, v)} min={0} max={k === "fuerza" || k === "destreza" || k === "constitucion" || k === "inteligencia" || k === "sabiduria" || k === "carisma" ? 100 : undefined} />
            </Field>
          ))}
        </div>
        <p className="mb-2 mt-4 text-xs text-fg-muted">Valoraciones cualitativas (texto: S, A, B…).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {RATING_KEYS.map((k) => (
            <Field key={k} label={ratingLabel(k)}><TextInput value={stats[k] ?? ""} onChange={(v) => setStat(k, v)} /></Field>
          ))}
        </div>
      </AccordionSection>

      {/* Habilidades */}
      <AccordionSection title="Habilidades" subtitle={`${habilidades.length}`}>
        <Repeater
          items={habilidades}
          onChange={wrapSetter(setHabilidades)}
          blank={() => ({ categoria: "", nombre: "", descripcion: "", tipo: "", magiaFundamentoId: null })}
          addLabel="Añadir habilidad"
          renderItem={(h, up) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Categoría *"><Combobox value={h.categoria} onChange={(v) => up({ categoria: v })} options={catalogos.habilidad_categoria} campo="habilidad_categoria" /></Field>
              <Field label="Nombre"><TextInput value={h.nombre} onChange={(v) => up({ nombre: v })} /></Field>
              <Field label="Tipo"><Combobox value={h.tipo} onChange={(v) => up({ tipo: v })} options={catalogos.habilidad_tipo} campo="habilidad_tipo" /></Field>
              <div />
              <div className="sm:col-span-2"><Field label="Descripción"><MarkdownField value={h.descripcion} onChange={(v) => up({ descripcion: v })} rows={3} /></Field></div>
            </div>
          )}
        />
      </AccordionSection>

      {/* Eventos */}
      <AccordionSection title="Eventos clave" subtitle={`${eventos.length}`}>
        <Repeater
          items={eventos}
          onChange={wrapSetter(setEventos)}
          blank={() => ({ fecha: "", titulo: "", descripcion: "" })}
          addLabel="Añadir evento"
          renderItem={(e, up) => (
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Fecha (lore)"><TextInput value={e.fecha} onChange={(v) => up({ fecha: v })} /></Field>
              <div className="sm:col-span-2"><Field label="Título *"><TextInput value={e.titulo} onChange={(v) => up({ titulo: v })} /></Field></div>
              <div className="sm:col-span-3"><Field label="Descripción"><MarkdownField value={e.descripcion} onChange={(v) => up({ descripcion: v })} rows={3} /></Field></div>
            </div>
          )}
        />
      </AccordionSection>

      {/* Relaciones PJ↔PJ */}
      <AccordionSection title="Relaciones" subtitle={`${relaciones.length}`}>
        <Repeater
          items={relaciones}
          onChange={wrapSetter(setRelaciones)}
          blank={() => ({ personajeRelacionadoId: null, relLabel: "", nombreExterno: "", tipoRelacion: "", subtipoRelacion: "", descripcion: "" })}
          addLabel="Añadir relación"
          renderItem={(r, up) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Personaje vinculado" hint="busca una ficha existente">
                  {r.personajeRelacionadoId ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm">
                      <span className="text-fg">{r.relLabel}</span>
                      <button type="button" className="ml-auto text-fg-muted hover:text-error" onClick={() => up({ personajeRelacionadoId: null, relLabel: "" })}>✕</button>
                    </div>
                  ) : (
                    <MultiPicker options={personajesOpts} selectedIds={[]} placeholder="Buscar personaje…" onAdd={(id, label) => up({ personajeRelacionadoId: id, relLabel: label })} />
                  )}
                </Field>
                <Field label="o Nombre externo" hint="entidad sin ficha"><TextInput value={r.nombreExterno} onChange={(v) => up({ nombreExterno: v })} /></Field>
                <Field label="Tipo de relación"><Combobox value={r.tipoRelacion} onChange={(v) => up({ tipoRelacion: v })} options={catalogos.tipo_relacion} campo="tipo_relacion" /></Field>
                <Field label="Subtipo"><Combobox value={r.subtipoRelacion} onChange={(v) => up({ subtipoRelacion: v })} options={catalogos.subtipo_relacion} campo="subtipo_relacion" /></Field>
              </div>
              <Field label="Descripción"><TextInput value={r.descripcion} onChange={(v) => up({ descripcion: v })} /></Field>
            </div>
          )}
        />
      </AccordionSection>

      {/* Pertenencias N:M */}
      <AccordionSection title="Pertenencias" subtitle="naciones · razas · organizaciones">
        <div className="space-y-5">
          <Pertenencia<NacSel>
            titulo="Naciones" opciones={nacionesOpts} items={naciones} onChange={wrapSetter(setNaciones)}
            idOf={(x) => x.nacionId} add={(id, label) => ({ nacionId: id, label, tipo: "", descripcion: "" })}
            extra={(it, up) => <TextInput value={it.tipo} onChange={(v) => up({ tipo: v })} placeholder="Rol/tipo (ciudadano, exiliado…)" />}
          />
          <Pertenencia<RazSel>
            titulo="Razas" opciones={razasOpts} items={razas} onChange={wrapSetter(setRazas)}
            idOf={(x) => x.razaId} add={(id, label) => ({ razaId: id, label, esMixta: false, nota: "" })}
            extra={(it, up) => (
              <label className="flex items-center gap-2 text-xs text-fg-secondary">
                <input type="checkbox" checked={it.esMixta} onChange={(e) => up({ esMixta: e.target.checked })} /> Mixta
              </label>
            )}
          />
          <Pertenencia<OrgSel>
            titulo="Organizaciones" opciones={organizacionesOpts} items={organizaciones} onChange={wrapSetter(setOrgs)}
            idOf={(x) => x.organizacionId} add={(id, label) => ({ organizacionId: id, label, rol: "", tipo: "", descripcion: "" })}
            extra={(it, up) => <TextInput value={it.rol} onChange={(v) => up({ rol: v })} placeholder="Rol (miembro, líder…)" />}
          />
        </div>
      </AccordionSection>

      {/* Equipamiento y objetos */}
      <AccordionSection title="Equipamiento y objetos" subtitle={`${equipamiento.length + objetos.length}`}>
        <p className="mb-1 text-xs text-fg-muted">Equipamiento</p>
        <Repeater
          items={equipamiento}
          onChange={wrapSetter(setEquip)}
          blank={() => ({ nombre: "", tipo: "", descripcion: "", poderEspecial: "" })}
          addLabel="Añadir equipamiento"
          renderItem={(q, up) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Nombre"><TextInput value={q.nombre} onChange={(v) => up({ nombre: v })} /></Field>
              <Field label="Tipo"><TextInput value={q.tipo} onChange={(v) => up({ tipo: v })} /></Field>
              <div className="sm:col-span-2"><Field label="Descripción"><TextInput value={q.descripcion} onChange={(v) => up({ descripcion: v })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Poder especial"><TextInput value={q.poderEspecial} onChange={(v) => up({ poderEspecial: v })} /></Field></div>
            </div>
          )}
        />
        <p className="mb-1 mt-4 text-xs text-fg-muted">Objetos importantes</p>
        <Repeater
          items={objetos}
          onChange={wrapSetter(setObjetos)}
          blank={() => ({ nombre: "", tipo: "", descripcion: "" })}
          addLabel="Añadir objeto"
          renderItem={(o, up) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Nombre"><TextInput value={o.nombre} onChange={(v) => up({ nombre: v })} /></Field>
              <Field label="Tipo"><TextInput value={o.tipo} onChange={(v) => up({ tipo: v })} /></Field>
              <div className="sm:col-span-2"><Field label="Descripción"><TextInput value={o.descripcion} onChange={(v) => up({ descripcion: v })} /></Field></div>
            </div>
          )}
        />
      </AccordionSection>

      {/* Media */}
      <AccordionSection title="Imágenes">
        <div className="flex flex-wrap gap-8">
          <ImageField label="Avatar" value={imagen} onChange={wrapSetter(setImagen)} alt={f.nombre} />
          <ImageField label="Banner" value={banner} onChange={wrapSetter(setBanner)} alt={f.nombre} aspect="aspect-video" />
        </div>
      </AccordionSection>

      {/* Barra de acciones fija */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-base bg-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          {incompleta.length > 0 && <span className="text-xs text-warning">⚠ {incompleta.join(" · ")}</span>}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={f.estadoPublicacion}
              onChange={(e) => patch({ estadoPublicacion: e.target.value as EstadoPublicacion })}
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

// ── sub-componente genérico de pertenencia N:M ──────────────────────────────
function Pertenencia<T extends { label: string }>({
  titulo, opciones, items, onChange, idOf, add, extra,
}: {
  titulo: string;
  opciones: Opcion[];
  items: T[];
  onChange: (v: T[]) => void;
  idOf: (x: T) => number;
  add: (id: number, label: string) => T;
  extra: (item: T, up: (patch: Partial<T>) => void) => ReactNode;
}) {
  const selectedIds = items.map(idOf);
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-fg-muted">{titulo}</p>
      <div className="mb-2 space-y-2">
        {items.map((it, i) => (
          <div key={idOf(it)} className="flex items-center gap-2 rounded-lg border border-border-base bg-surface px-3 py-2">
            <span className="text-sm text-fg">{it.label}</span>
            <div className="ml-auto flex items-center gap-2">
              {extra(it, (patch) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x))))}
              <button type="button" className="text-fg-muted hover:text-error" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <MultiPicker options={opciones} selectedIds={selectedIds} onAdd={(id, label) => onChange([...items, add(id, label)])} placeholder={`Añadir ${titulo.toLowerCase()}…`} />
    </div>
  );
}

function statLabel(k: StatKey): string {
  const m: Record<StatKey, string> = {
    fuerza: "Fuerza", destreza: "Destreza", constitucion: "Constitución", inteligencia: "Inteligencia",
    sabiduria: "Sabiduría", carisma: "Carisma", mpMax: "MP máx", ataqueFisico: "Ataque físico",
    ataqueMagico: "Ataque mágico", defensaFisica: "Defensa física", defensaMagica: "Defensa mágica",
    velocidad: "Velocidad", capacidadDeReaccion: "Reacción", precisionVal: "Precisión",
  };
  return m[k];
}
function ratingLabel(k: RatingKey): string {
  const m: Record<RatingKey, string> = {
    rangoCuerpoACuerpo: "C. a cuerpo", rangoDistancia: "Distancia", danoMagico: "Daño mágico",
    defensa: "Defensa", apoyo: "Apoyo", movilidad: "Movilidad", controlDeMasas: "Control de masas",
  };
  return m[k];
}
