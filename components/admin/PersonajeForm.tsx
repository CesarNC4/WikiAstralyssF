"use client";

import { useActionState, useEffect, useMemo, useState, startTransition, type ReactNode } from "react";
import { guardarPersonaje, type PersonajeFormState } from "@/lib/actions/personajes";
import type { PersonajeParaEditar, Opcion, OpcionRegion, OpcionLocacion } from "@/lib/queries/adminPersonajes";
import type { CatalogosPersonaje } from "@/lib/queries/catalogos";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { CATALOGOS, MAGIA_FAMILIA_ELEMENTAL, etiquetaInversa } from "@/lib/catalogos";
import { crearOpcion } from "@/lib/actions/catalogos";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection, Repeater, MultiPicker } from "@/components/admin/ui";
import { ImageField, type ImageValue } from "@/components/admin/ImageField";
import { GaleriaEditor } from "@/components/admin/blocks/GaleriaEditor";
import { PanelConexiones } from "@/components/admin/vinculos/PanelConexiones";
import { StatRadar } from "@/components/fichas/personaje/StatRadar";
import { cn } from "@/lib/utils";
import {
  Field,
  TextInput,
  NumberInput,
  Select,
  ReferenceField,
  MagiaPicker,
  MarkdownField,
} from "@/components/admin/fields";
import {
  PRIMARY_KEYS,
  COMBAT_KEYS,
  RATING_KEYS,
  PRIMARY_MIN,
  PRIMARY_MAX,
  COMBAT_MIN,
  COMBAT_MAX,
  RANGOS,
  RANGO_DEFAULT,
  esRango,
  calcularPoderDeCombate,
} from "@/lib/poderCombate";

// ── tipos locales del estado del formulario ─────────────────────────────────
interface Hab {
  modo: "existente" | "nueva";
  magiaFundamentoId: number | null;
  magiaLabel: string;
  nuevoNombre: string;
  nuevoTipo: string;
  nuevoSubcategoria: string;
  categoria: string;
  descripcion: string;
}
interface Ev {
  modo: "existente" | "nueva";
  timelineEventoId: number | null;
  eventoLabel: string;
  nFecha: string;
  nTitulo: string;
  nImportancia: string;
  nCategoria: string;
  nEra: string;
  nota: string;
}
interface Ob {
  modo: "existente" | "nueva";
  armaArtefactoId: number | null;
  objetoLabel: string;
  nNombre: string;
  nTipo: string;
  nDescripcion: string;
  nPoder: string;
  nota: string;
}
interface Rel {
  idRr?: number;
  personajeRelacionadoId: number | null;
  relLabel: string;
  nombreExterno: string;
  tipoRelacion: string;
  subtipoRelacion: string;
  /** Lo que siente ESTE personaje por el otro. */
  afecto: string;
  /** Lo que siente el otro por este. No se refleja del anterior: son independientes. */
  afectoReciproco: string;
  descripcion: string;
}
interface NacSel { nacionId: number; label: string; tipo: string; descripcion: string }
interface RazSel { razaId: number; label: string; esMixta: boolean; nota: string }
interface OrgSel { organizacionId: number; label: string; rol: string; tipo: string; descripcion: string }

type StatKey = (typeof PRIMARY_KEYS)[number] | (typeof COMBAT_KEYS)[number];
type RatingKey = (typeof RATING_KEYS)[number];

const s = (v: unknown) => (v == null ? "" : String(v));

/** Mapea la ruta de un error de validación a la sección del formulario que lo contiene. */
function pathToSection(path: string): string {
  const head = path.split(".")[0];
  if (["historia", "rasgosPersonalidad", "motivacion", "miedos", "filosofia", "gustos", "disgustos", "debilidades"].includes(head)) return "historia";
  if (["magiaPrincipalTipo", "magiaPrincipalVariante", "magiaSecundariaTipo", "magiaSecundariaVariante", "nivelDeConsciencia", "circuitoForte", "essentia", "zenithra", "bendicion", "segundoDespertar"].includes(head)) return "magia";
  if (head === "estadisticas") return "stats";
  if (head === "habilidades") return "habilidades";
  if (head === "eventos") return "eventos";
  if (head === "relaciones") return "relaciones";
  if (["naciones", "razas", "organizaciones"].includes(head)) return "pertenencias";
  if (head === "objetos") return "objetos";
  return "identidad";
}

export function PersonajeForm({
  inicial,
  catalogos,
  personajesOpts,
  nacionesOpts,
  razasOpts,
  organizacionesOpts,
  magiaHechizosOpts,
  timelineOpts,
  artefactosOpts,
  familiasDelPersonaje,
  regionesOpts,
  locacionesOpts,
}: {
  inicial: PersonajeParaEditar | null;
  catalogos: CatalogosPersonaje;
  personajesOpts: Opcion[];
  nacionesOpts: Opcion[];
  razasOpts: Opcion[];
  organizacionesOpts: Opcion[];
  magiaHechizosOpts: Opcion[];
  timelineOpts: Opcion[];
  artefactosOpts: Opcion[];
  familiasDelPersonaje: string[];
  regionesOpts: OpcionRegion[];
  locacionesOpts: OpcionLocacion[];
}) {
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  const st = inicial?.estadisticas?.[0] as Record<string, unknown> | undefined;
  // Regla: los campos sin valor parten del mínimo de su escala (1, 1, "D").
  const initStats: Record<string, string> = {};
  PRIMARY_KEYS.forEach((k) => (initStats[k] = s(st?.[k]) || String(PRIMARY_MIN)));
  COMBAT_KEYS.forEach((k) => (initStats[k] = s(st?.[k]) || String(COMBAT_MIN)));
  RATING_KEYS.forEach((k) => (initStats[k] = esRango(st?.[k]) ? String(st?.[k]) : RANGO_DEFAULT));

  // ── estado del formulario ──
  const [f, setF] = useState({
    nombre: s(inicial?.nombre), surname: s(inicial?.surname), titulo: s(inicial?.titulo),
    edad: s(inicial?.edad), genero: s(inicial?.genero),
    altura: s(inicial?.altura), ocupacion: s(inicial?.ocupacion), ocupacionDetalle: s(inicial?.ocupacionDetalle),
    estadoVital: s(inicial?.estadoVital), rangoAventurero: s(inicial?.rangoAventurero),
    lugarNacimiento: s(inicial?.lugarNacimiento),
    lugarNacimientoNacionId: s(inicial?.lugarNacimientoNacionId),
    lugarNacimientoRegionId: s(inicial?.lugarNacimientoRegionId),
    lugarNacimientoLocacionId: s(inicial?.lugarNacimientoLocacionId),
    esInvocado: Boolean(inicial?.esInvocado), tipoInvocacion: s(inicial?.tipoInvocacion),
    historia: s(inicial?.historia), rasgosPersonalidad: s(inicial?.rasgosPersonalidad),
    motivacion: s(inicial?.motivacion), miedos: s(inicial?.miedos), filosofia: s(inicial?.filosofia),
    gustos: s(inicial?.gustos), disgustos: s(inicial?.disgustos), debilidades: s(inicial?.debilidades),
    magiaPrincipalTipo: s(inicial?.magiaPrincipalTipo), magiaPrincipalVariante: s(inicial?.magiaPrincipalVariante),
    magiaSecundariaTipo: s(inicial?.magiaSecundariaTipo), magiaSecundariaVariante: s(inicial?.magiaSecundariaVariante),
    nivelDeConsciencia: s(inicial?.nivelDeConsciencia), circuitoForte: s(inicial?.circuitoForte),
    essentia: s(inicial?.essentia), zenithra: s(inicial?.zenithra), bendicion: s(inicial?.bendicion),
    segundoDespertar: s(inicial?.segundoDespertar),
    estadoPublicacion: (inicial?.estadoPublicacion ?? "borrador") as EstadoPublicacion,
  });
  const patch = (p: Partial<typeof f>) => { setF((prev) => ({ ...prev, ...p })); markDirty(); };
  // Punto 1: "Es invocado" gobierna el tipo de invocación; al desactivarlo se limpia.
  const setEsInvocado = (v: boolean) => patch(v ? { esInvocado: true } : { esInvocado: false, tipoInvocacion: "" });

  const [imagen, setImagen] = useState<ImageValue>({ assetId: inicial?.imagenAssetId ?? null, url: s(inicial?.imagenUrl) || null });
  const [banner, setBanner] = useState<ImageValue>({ assetId: inicial?.bannerAssetId ?? null, url: s(inicial?.bannerUrl) || null });
  const [stats, setStats] = useState<Record<string, string>>(initStats);
  const setStat = (k: string, v: string) => { setStats((p) => ({ ...p, [k]: v })); markDirty(); };

  const [habilidades, setHabilidades] = useState<Hab[]>(
    (inicial?.habilidades ?? []).map((h) => ({
      modo: h.magiaFundamentoId ? "existente" : "nueva",
      magiaFundamentoId: h.magiaFundamentoId ?? null,
      magiaLabel: h.fundamento?.nombre ?? s(h.nombre),
      nuevoNombre: s(h.nombre),
      nuevoTipo: s(h.tipo),
      nuevoSubcategoria: "",
      categoria: s(h.categoria),
      descripcion: s(h.descripcion),
    })),
  );
  const [eventos, setEventos] = useState<Ev[]>(
    (inicial?.eventos ?? []).map((e) => ({
      modo: "existente" as const,
      timelineEventoId: e.timelineEventoId ?? null,
      eventoLabel: e.evento ? [e.evento.fechaLore, e.evento.titulo].filter(Boolean).join(" · ") : "",
      nFecha: "", nTitulo: "", nImportancia: "", nCategoria: "", nEra: "",
      nota: s(e.nota),
    })),
  );
  const [objetos, setObjetos] = useState<Ob[]>(
    (inicial?.objetos ?? []).map((o) => ({
      modo: "existente" as const,
      armaArtefactoId: o.armaArtefactoId ?? null,
      objetoLabel: o.objeto ? (o.objeto.tipo ? `${o.objeto.nombre} (${o.objeto.tipo})` : o.objeto.nombre) : "",
      nNombre: "", nTipo: "", nDescripcion: "", nPoder: "",
      nota: s(o.nota),
    })),
  );
  const [relaciones, setRelaciones] = useState<Rel[]>(
    (inicial?.relaciones ?? []).map((r) => ({
      idRr: r.idRr, personajeRelacionadoId: r.personajeRelacionadoId ?? null,
      relLabel: r.relacionado ? [r.relacionado.nombre, r.relacionado.surname].filter(Boolean).join(" ") : "",
      nombreExterno: s(r.nombreExterno), tipoRelacion: s(r.tipoRelacion), subtipoRelacion: s(r.subtipoRelacion),
      afecto: s(r.afecto), afectoReciproco: s(r.afectoReciproco), descripcion: s(r.descripcion),
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

  // Apertura de secciones (controlada) para el índice lateral y el salto al error.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ identidad: true });
  const setOpen = (id: string, v: boolean) => setOpenMap((m) => ({ ...m, [id]: v }));

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast("Cambios guardados.", "success");
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Al guardar con errores: desplaza a la primera sección con problema (la apertura
  // de esa sección es derivada en `sec()`, así que aquí solo hacemos scroll).
  useEffect(() => {
    if (!state || state.ok || !state.fieldErrors) return;
    const keys = Object.keys(state.fieldErrors);
    if (keys.length === 0) return;
    const target = pathToSection(keys[0]);
    document.getElementById(`sec-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  const submit = () => {
    const habilidadesPayload = habilidades
      .filter((h) => (h.modo === "nueva" ? h.nuevoNombre.trim() : h.magiaFundamentoId))
      .map((h) =>
        h.modo === "nueva"
          ? {
              magiaFundamentoId: null,
              nuevaMagia: { nombre: h.nuevoNombre.trim(), tipo: h.nuevoTipo, subcategoria: h.nuevoSubcategoria },
              categoria: h.categoria,
              nombre: h.nuevoNombre.trim(),
              tipo: h.nuevoTipo,
              descripcion: h.descripcion,
            }
          : {
              magiaFundamentoId: h.magiaFundamentoId,
              nuevaMagia: null,
              categoria: h.categoria,
              nombre: null,
              tipo: null,
              descripcion: h.descripcion,
            },
      );

    const eventosPayload = eventos
      .filter((e) => (e.modo === "nueva" ? e.nTitulo.trim() && e.nFecha.trim() : e.timelineEventoId))
      .map((e) =>
        e.modo === "nueva"
          ? {
              timelineEventoId: null,
              nuevoEvento: {
                fechaLore: e.nFecha.trim(),
                titulo: e.nTitulo.trim(),
                importancia: e.nImportancia,
                categoria: e.nCategoria,
                era: e.nEra,
              },
              nota: e.nota,
            }
          : { timelineEventoId: e.timelineEventoId, nuevoEvento: null, nota: e.nota },
      );

    const objetosPayload = objetos
      .filter((o) => (o.modo === "nueva" ? o.nNombre.trim() : o.armaArtefactoId))
      .map((o) =>
        o.modo === "nueva"
          ? {
              armaArtefactoId: null,
              nuevoObjeto: { nombre: o.nNombre.trim(), tipo: o.nTipo, descripcion: o.nDescripcion, poderEspecial: o.nPoder },
              nota: o.nota,
            }
          : { armaArtefactoId: o.armaArtefactoId, nuevoObjeto: null, nota: o.nota },
      );

    const payload = {
      ...f,
      imagenAssetId: imagen.assetId, imagenUrl: imagen.url,
      bannerAssetId: banner.assetId, bannerUrl: banner.url,
      estadisticas: stats,
      habilidades: habilidadesPayload,
      eventos: eventosPayload,
      objetos: objetosPayload,
      relaciones: relaciones
        // Descarta filas vacías: una relación necesita un PJ vinculado o un nombre externo.
        .filter((r) => r.personajeRelacionadoId || r.nombreExterno.trim())
        .map((r) => ({
          idRr: r.idRr,
          personajeRelacionadoId: r.personajeRelacionadoId,
          nombreExterno: r.nombreExterno,
          tipoRelacion: r.tipoRelacion,
          subtipoRelacion: r.subtipoRelacion,
          afecto: r.afecto,
          afectoReciproco: r.afectoReciproco,
          descripcion: r.descripcion,
        })),
      naciones: naciones.map((n) => ({ nacionId: n.nacionId, tipo: n.tipo, descripcion: n.descripcion })),
      razas: razas.map((r) => ({ razaId: r.razaId, esMixta: r.esMixta, nota: r.nota })),
      organizaciones: organizaciones.map((o) => ({ organizacionId: o.organizacionId, rol: o.rol, tipo: o.tipo, descripcion: o.descripcion })),
    };
    setDirty(false); // optimista: guardar = persistir el estado actual
    const fd = new FormData();
    if (inicial?.id) fd.set("id", String(inicial.id));
    fd.set("payload", JSON.stringify(payload));
    startTransition(() => formAction(fd));
  };

  const incompleta = useMemo(() => {
    const w: string[] = [];
    if (!f.nombre.trim()) w.push("Falta el nombre");
    if (!imagen.url && !imagen.assetId) w.push("Sin avatar");
    if (!f.historia.trim()) w.push("Falta la historia");
    if (!f.magiaPrincipalTipo.trim()) w.push("Sin magia principal");
    return w;
  }, [f.nombre, f.historia, f.magiaPrincipalTipo, imagen.url, imagen.assetId]);

  // Poder de Combate dinámico: recalcula con cada cambio de estadística.
  const poder = useMemo(() => calcularPoderDeCombate(stats), [stats]);

  const fe = state?.fieldErrors ?? {};
  const errores = Object.entries(fe).map(([path, msg]) => ({ path, msg, section: pathToSection(path) }));
  const jumpTo = (sectionId: string) => {
    setOpen(sectionId, true);
    document.getElementById(`sec-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Lugar de nacimiento en cascada (nación → región → locación) ──
  const nacId = f.lugarNacimientoNacionId;
  const regId = f.lugarNacimientoRegionId;
  const regionesDisp = regionesOpts.filter((r) => !nacId || String(r.nacionId) === nacId);
  const locacionesDisp = locacionesOpts.filter((l) =>
    regId ? String(l.regionId) === regId : !nacId || String(l.nacionId) === nacId,
  );
  const setNacNacion = (v: string) =>
    patch({ lugarNacimientoNacionId: v, lugarNacimientoRegionId: "", lugarNacimientoLocacionId: "" });
  const setNacRegion = (v: string) => {
    const reg = regionesOpts.find((r) => String(r.id) === v);
    patch({
      lugarNacimientoRegionId: v,
      lugarNacimientoLocacionId: "",
      ...(reg?.nacionId && !nacId ? { lugarNacimientoNacionId: String(reg.nacionId) } : {}),
    });
  };
  const setNacLocacion = (v: string) => {
    const loc = locacionesOpts.find((l) => String(l.id) === v);
    patch({
      lugarNacimientoLocacionId: v,
      ...(loc?.regionId && !regId ? { lugarNacimientoRegionId: String(loc.regionId) } : {}),
      ...(loc?.nacionId && !nacId ? { lugarNacimientoNacionId: String(loc.nacionId) } : {}),
    });
  };

  // ── Índice de secciones ──
  const sectionHasError = (id: string) => errores.some((e) => e.section === id);
  const sec = (id: string) => ({
    id: `sec-${id}`,
    open: (openMap[id] ?? false) || sectionHasError(id),
    onOpenChange: (v: boolean) => setOpen(id, v),
  });
  const sections = [
    { id: "identidad", label: "Identidad", content: !!f.nombre.trim() },
    { id: "historia", label: "Historia", content: !!(f.historia || f.rasgosPersonalidad || f.motivacion || f.miedos || f.filosofia || f.gustos || f.disgustos || f.debilidades) },
    { id: "magia", label: "Magia y combate", content: !!(f.magiaPrincipalTipo || f.circuitoForte || f.essentia || f.zenithra || f.bendicion || f.segundoDespertar) },
    { id: "stats", label: "Estadísticas", content: poder.total > 0 },
    { id: "habilidades", label: "Habilidades", content: habilidades.length > 0 },
    { id: "eventos", label: "Eventos clave", content: eventos.length > 0 },
    { id: "relaciones", label: "Relaciones", content: relaciones.length > 0 || (inicial?.relacionesInversas?.length ?? 0) > 0 },
    { id: "pertenencias", label: "Pertenencias", content: naciones.length > 0 || razas.length > 0 || organizaciones.length > 0 },
    { id: "objetos", label: "Objetos", content: objetos.length > 0 },
    { id: "imagenes", label: "Imágenes", content: !!(imagen.url || imagen.assetId || banner.url || banner.assetId) },
  ];

  return (
    <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[180px_minmax(0,1fr)_20rem]">
      {/* Índice de secciones (lateral fijo) */}
      <aside className="hidden lg:block">
        <nav className="sticky top-4 space-y-0.5">
          {sections.map((sc) => (
            <a
              key={sc.id}
              href={`#sec-${sc.id}`}
              onClick={() => setOpen(sc.id, true)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-fg-secondary hover:bg-surface hover:text-fg"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  sectionHasError(sc.id) ? "bg-error" : sc.content ? "bg-success" : "bg-border-base",
                )}
              />
              {sc.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="space-y-4 pb-28">
      {/* Identidad */}
      <AccordionSection {...sec("identidad")} title="Identidad" badge={fe.nombre ? <span className="text-xs text-error">!</span> : null}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre *" error={fe.nombre}><TextInput value={f.nombre} onChange={(v) => patch({ nombre: v })} placeholder="Nombre" /></Field>
          <Field label="Apellido"><TextInput value={f.surname} onChange={(v) => patch({ surname: v })} /></Field>
          <Field label="Título"><TextInput value={f.titulo} onChange={(v) => patch({ titulo: v })} /></Field>
          <Field label="Edad"><TextInput value={f.edad} onChange={(v) => patch({ edad: v })} /></Field>
          <Field label="Género"><Select value={f.genero} onChange={(v) => patch({ genero: v })} options={catalogos.genero} /></Field>
          <Field label="Altura (m)"><NumberInput value={f.altura} onChange={(v) => patch({ altura: v })} placeholder="1.75" /></Field>
          <Field label="Ocupación"><Select value={f.ocupacion} onChange={(v) => patch({ ocupacion: v })} options={catalogos.ocupacion} onCrear={(valor) => crearOpcion("ocupacion", valor)} /></Field>
          <Field label="Ocupación (detalle)" hint="el matiz: 'Ex Princesa', 'Escriba del Consejo'…"><TextInput value={f.ocupacionDetalle} onChange={(v) => patch({ ocupacionDetalle: v })} /></Field>
          <Field label="Estado vital"><Select value={f.estadoVital} onChange={(v) => patch({ estadoVital: v })} options={catalogos.estado_vital} /></Field>
          <Field label="Rango aventurero"><Select value={f.rangoAventurero} onChange={(v) => patch({ rangoAventurero: v })} options={catalogos.rango_aventurero} /></Field>
          {/* Lugar de nacimiento en 3 niveles (todos opcionales, en cascada). */}
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">Lugar de nacimiento</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Nación"><ReferenceField value={f.lugarNacimientoNacionId} onChange={setNacNacion} options={nacionesOpts} placeholder="Buscar nación…" /></Field>
              <Field label="Región"><ReferenceField value={f.lugarNacimientoRegionId} onChange={setNacRegion} options={regionesDisp} placeholder="Buscar región…" /></Field>
              <Field label="Locación"><ReferenceField value={f.lugarNacimientoLocacionId} onChange={setNacLocacion} options={locacionesDisp} placeholder="Buscar locación…" /></Field>
            </div>
            <div className="mt-2"><Field label="Detalle libre" hint="Opcional, si el lugar no tiene ficha"><TextInput value={f.lugarNacimiento} onChange={(v) => patch({ lugarNacimiento: v })} placeholder="p. ej. 'una aldea en las montañas'" /></Field></div>
          </div>
          {/* Punto 2: Familia derivada (solo lectura). */}
          <Field label="Familia" hint="Se asigna desde el editor de Familia (no editable)">
            <div className="min-h-10 rounded-lg border border-border-base bg-deep/40 px-3 py-2 text-sm">
              {familiasDelPersonaje.length > 0 ? (
                <span className="text-fg">{familiasDelPersonaje.join(", ")}</span>
              ) : (
                <span className="text-fg-muted">Sin familia asignada</span>
              )}
            </div>
          </Field>
          <div />
          {/* Punto 1: invocación. */}
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-fg-secondary">
            <input type="checkbox" checked={f.esInvocado} onChange={(e) => setEsInvocado(e.target.checked)} />
            Es invocado
          </label>
          <Field label="Tipo de invocación">
            <select
              value={f.tipoInvocacion}
              disabled={!f.esInvocado}
              onChange={(e) => patch({ tipoInvocacion: e.target.value })}
              className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-border-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{f.esInvocado ? "Selecciona…" : "—"}</option>
              {CATALOGOS.tipo_invocacion.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      </AccordionSection>

      {/* Historia y personalidad */}
      <AccordionSection {...sec("historia")} title="Historia y personalidad" subtitle="markdown">
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

      {/* Magia y combate (punto 4: campos grandes markdown) */}
      <AccordionSection {...sec("magia")} title="Magia y combate">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Magia principal"><MagiaPicker tipo={f.magiaPrincipalTipo} variante={f.magiaPrincipalVariante} onTipo={(v) => patch({ magiaPrincipalTipo: v })} onVariante={(v) => patch({ magiaPrincipalVariante: v })} tipos={catalogos.magiaTipos} elementos={catalogos.elementos} familias={MAGIA_FAMILIA_ELEMENTAL} /></Field>
          <Field label="Magia secundaria"><MagiaPicker tipo={f.magiaSecundariaTipo} variante={f.magiaSecundariaVariante} onTipo={(v) => patch({ magiaSecundariaTipo: v })} onVariante={(v) => patch({ magiaSecundariaVariante: v })} tipos={catalogos.magiaTipos} elementos={catalogos.elementos} familias={MAGIA_FAMILIA_ELEMENTAL} /></Field>
          <Field label="Nivel de consciencia"><Select value={f.nivelDeConsciencia} onChange={(v) => patch({ nivelDeConsciencia: v })} options={catalogos.nivel_consciencia} /></Field>
          <div />
        </div>
        <div className="mt-3 space-y-3">
          <Field label="Circuito Forte"><MarkdownField value={f.circuitoForte} onChange={(v) => patch({ circuitoForte: v })} rows={4} /></Field>
          <Field label="Essentia"><MarkdownField value={f.essentia} onChange={(v) => patch({ essentia: v })} rows={4} /></Field>
          <Field label="Zenithra"><MarkdownField value={f.zenithra} onChange={(v) => patch({ zenithra: v })} rows={4} /></Field>
          <Field label="Bendición"><MarkdownField value={f.bendicion} onChange={(v) => patch({ bendicion: v })} rows={4} /></Field>
          <Field label="Segundo despertar"><MarkdownField value={f.segundoDespertar} onChange={(v) => patch({ segundoDespertar: v })} rows={4} /></Field>
        </div>
      </AccordionSection>

      {/* Stats (punto 5: tres grupos + Poder de Combate dinámico) */}
      <AccordionSection {...sec("stats")} title="Estadísticas" subtitle={`Poder de Combate ${poder.total}% · ${poder.letra}`}>
        <div className="grid gap-3 lg:grid-cols-[1fr_15rem]">
          <PoderDeCombatePanel poder={poder} />
          <div className="grid place-items-center rounded-xl border border-border-base bg-deep/40 p-2">
            <StatRadar
              stats={PRIMARY_KEYS.map((k) => ({ label: statLabel(k), value: Number(stats[k]) || 0 }))}
              max={PRIMARY_MAX}
            />
          </div>
        </div>

        <p className="mb-2 mt-5 text-xs uppercase tracking-wide text-accent">Atributos primarios</p>
        <p className="mb-2 text-xs text-fg-muted">Rango {PRIMARY_MIN}–{PRIMARY_MAX}.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {PRIMARY_KEYS.map((k) => (
            <Field key={k} label={statLabel(k)} error={fe[`estadisticas.${k}`]}>
              <NumberInput value={stats[k] ?? ""} onChange={(v) => setStat(k, v)} min={PRIMARY_MIN} max={PRIMARY_MAX} />
            </Field>
          ))}
        </div>

        <p className="mb-2 mt-5 text-xs uppercase tracking-wide text-accent">Estadísticas de combate</p>
        <p className="mb-2 text-xs text-fg-muted">Rango {COMBAT_MIN}–{COMBAT_MAX}.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {COMBAT_KEYS.map((k) => (
            <Field key={k} label={statLabel(k)} error={fe[`estadisticas.${k}`]}>
              <NumberInput value={stats[k] ?? ""} onChange={(v) => setStat(k, v)} min={COMBAT_MIN} max={COMBAT_MAX} />
            </Field>
          ))}
        </div>

        <p className="mb-2 mt-5 text-xs uppercase tracking-wide text-accent">Rangos</p>
        <p className="mb-2 text-xs text-fg-muted">Valoración cualitativa (D · C · B · A · S · SS · SSS).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {RATING_KEYS.map((k) => (
            <Field key={k} label={ratingLabel(k)} error={fe[`estadisticas.${k}`]}>
              <RangoSelect value={stats[k] ?? RANGO_DEFAULT} onChange={(v) => setStat(k, v)} />
            </Field>
          ))}
        </div>
      </AccordionSection>

      {/* Habilidades (punto 6) */}
      <AccordionSection {...sec("habilidades")} title="Habilidades" subtitle={`${habilidades.length}`}>
        <p className="mb-3 text-xs text-fg-muted">Enlaza una técnica del catálogo de Magia (técnicas y técnicas avanzadas; los fundamentos y conceptos son teoría y no se enlazan) o crea una nueva (se guardará en Magia). La descripción es la nota propia de este personaje.</p>
        <Repeater
          items={habilidades}
          onChange={wrapSetter(setHabilidades)}
          blank={(): Hab => ({ modo: "existente", magiaFundamentoId: null, magiaLabel: "", nuevoNombre: "", nuevoTipo: "", nuevoSubcategoria: "", categoria: "", descripcion: "" })}
          addLabel="Añadir habilidad"
          renderItem={(h, up) => (
            <div className="space-y-2">
              <ModoToggle
                modo={h.modo}
                etiquetas={["Escoger de Magia", "Crear nueva"]}
                onChange={(modo) => up({ modo })}
              />
              {h.modo === "existente" ? (
                <Field label="Técnica">
                  <Picker
                    label={h.magiaLabel}
                    options={magiaHechizosOpts}
                    placeholder="Buscar técnica en el catálogo de Magia…"
                    onPick={(id, label) => up({ magiaFundamentoId: id, magiaLabel: label })}
                    onClear={() => up({ magiaFundamentoId: null, magiaLabel: "" })}
                  />
                </Field>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="Nombre *"><TextInput value={h.nuevoNombre} onChange={(v) => up({ nuevoNombre: v })} /></Field>
                  <Field label="Tipo / escuela"><Select value={h.nuevoTipo} onChange={(v) => up({ nuevoTipo: v, nuevoSubcategoria: "" })} options={catalogos.magiaTipos} /></Field>
                  <Field label="Elemento"><Select value={h.nuevoSubcategoria} onChange={(v) => up({ nuevoSubcategoria: v })} options={catalogos.elementos} grupoActivo={h.nuevoTipo ? MAGIA_FAMILIA_ELEMENTAL[h.nuevoTipo] ?? null : null} /></Field>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Categoría" hint="agrupa en la ficha"><Select value={h.categoria} onChange={(v) => up({ categoria: v })} options={catalogos.habilidad_categoria} /></Field>
                <div />
              </div>
              <Field label="Descripción"><MarkdownField value={h.descripcion} onChange={(v) => up({ descripcion: v })} rows={3} /></Field>
            </div>
          )}
        />
      </AccordionSection>

      {/* Eventos (punto 7) */}
      <AccordionSection {...sec("eventos")} title="Eventos clave" subtitle={`${eventos.length}`}>
        <p className="mb-3 text-xs text-fg-muted">Vincula un evento de la cronología o crea uno nuevo (se ubicará en la cronología global). La nota es lo que significa este evento para este personaje.</p>
        <Repeater
          items={eventos}
          onChange={wrapSetter(setEventos)}
          blank={(): Ev => ({ modo: "existente", timelineEventoId: null, eventoLabel: "", nFecha: "", nTitulo: "", nImportancia: "", nCategoria: "", nEra: "", nota: "" })}
          addLabel="Añadir evento"
          renderItem={(e, up) => (
            <div className="space-y-2">
              <ModoToggle
                modo={e.modo}
                etiquetas={["Escoger de cronología", "Crear evento"]}
                onChange={(modo) => up({ modo })}
              />
              {e.modo === "existente" ? (
                <Field label="Evento de la cronología">
                  <Picker
                    label={e.eventoLabel}
                    options={timelineOpts}
                    placeholder="Buscar en la cronología…"
                    onPick={(id, label) => up({ timelineEventoId: id, eventoLabel: label })}
                    onClear={() => up({ timelineEventoId: null, eventoLabel: "" })}
                  />
                </Field>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Fecha (lore) *"><TextInput value={e.nFecha} onChange={(v) => up({ nFecha: v })} /></Field>
                  <Field label="Título *"><TextInput value={e.nTitulo} onChange={(v) => up({ nTitulo: v })} /></Field>
                  <Field label="Importancia"><Select value={e.nImportancia} onChange={(v) => up({ nImportancia: v })} options={catalogos.timeline_importancia} /></Field>
                  <Field label="Categoría"><Select value={e.nCategoria} onChange={(v) => up({ nCategoria: v })} options={catalogos.timeline_categoria} /></Field>
                  <Field label="Era"><TextInput value={e.nEra} onChange={(v) => up({ nEra: v })} /></Field>
                  <div />
                </div>
              )}
              <Field label="Nota del personaje"><MarkdownField value={e.nota} onChange={(v) => up({ nota: v })} rows={3} /></Field>
            </div>
          )}
        />
      </AccordionSection>

      {/* Relaciones PJ↔PJ */}
      <AccordionSection {...sec("relaciones")} title="Relaciones" subtitle={`${relaciones.length}`}>
        {(inicial?.relacionesInversas ?? []).filter((r) => r.personaje).length > 0 && (
          <div className="mb-3 rounded-xl border border-dashed border-border-base bg-deep/30 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-fg-muted">Relacionado por otros (automático)</p>
            <div className="space-y-1">
              {(inicial?.relacionesInversas ?? []).filter((r) => r.personaje).map((r) => (
                <div key={r.idRr} className="flex items-center gap-2 text-sm">
                  <span className="text-fg">{[r.personaje!.nombre, r.personaje!.surname].filter(Boolean).join(" ")}</span>
                  <span className="text-xs text-primary-glow">{etiquetaInversa(r.tipoRelacion) ?? r.subtipoRelacion}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-fg-muted">Estas se definen en la ficha del otro personaje; aparecen aquí automáticamente.</p>
          </div>
        )}
        <Repeater
          items={relaciones}
          onChange={wrapSetter(setRelaciones)}
          blank={() => ({ personajeRelacionadoId: null, relLabel: "", nombreExterno: "", tipoRelacion: "", subtipoRelacion: "", afecto: "", afectoReciproco: "", descripcion: "" })}
          addLabel="Añadir relación"
          renderItem={(r, up) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Personaje vinculado" hint="busca una ficha existente">
                  {r.personajeRelacionadoId ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm">
                      <span className="text-fg">{r.relLabel}</span>
                      <button type="button" className="ml-auto text-fg-muted hover:text-error" onClick={() => up({ personajeRelacionadoId: null, relLabel: "" })} aria-label={`Quitar ${r.relLabel}`}>✕</button>
                    </div>
                  ) : (
                    <MultiPicker options={personajesOpts} selectedIds={[]} placeholder="Buscar personaje…" onAdd={(id, label) => up({ personajeRelacionadoId: id, relLabel: label })} />
                  )}
                </Field>
                <Field label="o Nombre externo" hint="entidad sin ficha"><TextInput value={r.nombreExterno} onChange={(v) => up({ nombreExterno: v })} /></Field>
                <Field label="Tipo de relación"><Select value={r.tipoRelacion} onChange={(v) => up({ tipoRelacion: v, subtipoRelacion: "" })} options={catalogos.tipo_relacion} /></Field>
                <Field label="Subtipo" hint="depende del tipo"><Select value={r.subtipoRelacion} onChange={(v) => up({ subtipoRelacion: v })} options={catalogos.subtipo_relacion} grupoActivo={r.tipoRelacion || null} /></Field>
                <Field label="Lo que siente" hint="este personaje hacia el otro"><Select value={r.afecto} onChange={(v) => up({ afecto: v })} options={catalogos.afecto} /></Field>
                <Field label="Lo que le devuelve" hint="puede ser distinto: uno ama y el otro odia"><Select value={r.afectoReciproco} onChange={(v) => up({ afectoReciproco: v })} options={catalogos.afecto} /></Field>
              </div>
              <Field label="Descripción"><MarkdownField value={r.descripcion} onChange={(v) => up({ descripcion: v })} rows={2} /></Field>
            </div>
          )}
        />
      </AccordionSection>

      {/* Pertenencias N:M */}
      <AccordionSection {...sec("pertenencias")} title="Pertenencias" subtitle="naciones · razas · organizaciones">
        <div className="space-y-5">
          <Pertenencia<NacSel>
            titulo="Naciones" opciones={nacionesOpts} items={naciones} onChange={wrapSetter(setNaciones)}
            idOf={(x) => x.nacionId} add={(id, label) => ({ nacionId: id, label, tipo: "", descripcion: "" })}
            extra={(it, up) => <div className="w-44"><Select value={it.tipo} onChange={(v) => up({ tipo: v })} options={catalogos.nacion_rol} placeholder="Rol…" /></div>}
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
            extra={(it, up) => <div className="w-44"><Select value={it.rol} onChange={(v) => up({ rol: v })} options={catalogos.org_rol} placeholder="Rol…" /></div>}
          />
        </div>
      </AccordionSection>

      {/* Objetos, armas y artefactos (punto 8) */}
      <AccordionSection {...sec("objetos")} title="Objetos, armas y artefactos" subtitle={`${objetos.length}`}>
        <p className="mb-3 text-xs text-fg-muted">Enlaza un objeto del catálogo Armas y Artefactos (el tipo distingue arma/artefacto/objeto) o crea uno nuevo (aparecerá en /artefactos). La nota es propia de este personaje.</p>
        <Repeater
          items={objetos}
          onChange={wrapSetter(setObjetos)}
          blank={(): Ob => ({ modo: "existente", armaArtefactoId: null, objetoLabel: "", nNombre: "", nTipo: "", nDescripcion: "", nPoder: "", nota: "" })}
          addLabel="Añadir objeto"
          renderItem={(o, up) => (
            <div className="space-y-2">
              <ModoToggle
                modo={o.modo}
                etiquetas={["Escoger del catálogo", "Crear nuevo"]}
                onChange={(modo) => up({ modo })}
              />
              {o.modo === "existente" ? (
                <Field label="Objeto / arma / artefacto">
                  <Picker
                    label={o.objetoLabel}
                    options={artefactosOpts}
                    placeholder="Buscar en Armas y Artefactos…"
                    onPick={(id, label) => up({ armaArtefactoId: id, objetoLabel: label })}
                    onClear={() => up({ armaArtefactoId: null, objetoLabel: "" })}
                  />
                </Field>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Nombre *"><TextInput value={o.nNombre} onChange={(v) => up({ nNombre: v })} /></Field>
                  <Field label="Tipo" hint="arma · artefacto · objeto…"><Select value={o.nTipo} onChange={(v) => up({ nTipo: v })} options={catalogos.artefacto_tipo} /></Field>
                  <div className="sm:col-span-2"><Field label="Descripción"><MarkdownField value={o.nDescripcion} onChange={(v) => up({ nDescripcion: v })} rows={3} /></Field></div>
                  <div className="sm:col-span-2"><Field label="Poder especial"><TextInput value={o.nPoder} onChange={(v) => up({ nPoder: v })} /></Field></div>
                </div>
              )}
              <Field label="Nota del personaje"><TextInput value={o.nota} onChange={(v) => up({ nota: v })} /></Field>
            </div>
          )}
        />
      </AccordionSection>

      {/* Media */}
      <AccordionSection {...sec("imagenes")} title="Imágenes">
        <div className="flex flex-wrap gap-8">
          <ImageField label="Avatar" entidad="personajes" value={imagen} onChange={wrapSetter(setImagen)} alt={f.nombre} />
          <ImageField label="Banner" entidad="personajes" value={banner} onChange={wrapSetter(setBanner)} alt={f.nombre} aspect="aspect-video" />
        </div>
      </AccordionSection>

      {/* Galería (solo al editar) */}
      {inicial?.id && (
        <GaleriaEditor entidadTipo="personajes" entidadId={inicial.id} revalidar={`/personajes/${inicial.id}`} alt={f.nombre} />
      )}

      </div>

      {/* Conexiones con el resto del mundo, visibles mientras editas. */}
      {inicial?.id && (
        <div className="mt-4 pb-28 xl:sticky xl:top-4 xl:mt-0 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <PanelConexiones entidad="personajes" ownerId={inicial.id} />
        </div>
      )}

      {/* Barra de acciones fija */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-base bg-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          {errores.length > 0 ? (
            <div className="min-w-0 text-xs text-error">
              <span className="font-medium">⛔ Corrige:</span>{" "}
              {errores.map((e, i) => (
                <span key={e.path}>
                  <button type="button" onClick={() => jumpTo(e.section)} className="underline decoration-dotted hover:text-fg" title={e.msg}>
                    {e.path}
                  </button>
                  {i < errores.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          ) : (
            incompleta.length > 0 && <span className="text-xs text-warning">⚠ {incompleta.join(" · ")}</span>
          )}
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

// ── Conmutador de modo (escoger existente / crear nuevo) ─────────────────────
function ModoToggle({
  modo,
  etiquetas,
  onChange,
}: {
  modo: "existente" | "nueva";
  etiquetas: [string, string];
  onChange: (m: "existente" | "nueva") => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border-base p-0.5 text-xs">
      {(["existente", "nueva"] as const).map((m, i) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            modo === m ? "bg-primary text-void" : "text-fg-muted hover:text-fg",
          )}
        >
          {etiquetas[i]}
        </button>
      ))}
    </div>
  );
}

// ── Selector de una entidad existente (chip + buscador) ──────────────────────
function Picker({
  label,
  options,
  placeholder,
  onPick,
  onClear,
}: {
  label: string;
  options: Opcion[];
  placeholder?: string;
  onPick: (id: number, label: string) => void;
  onClear: () => void;
}) {
  if (label) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm">
        <span className="text-fg">{label}</span>
        <button type="button" className="ml-auto text-fg-muted hover:text-error" onClick={onClear} aria-label={`Quitar ${label}`}>✕</button>
      </div>
    );
  }
  return <MultiPicker options={options} selectedIds={[]} placeholder={placeholder} onAdd={onPick} />;
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
              <button type="button" className="text-fg-muted hover:text-error" onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label={`Quitar ${it.label}`}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <MultiPicker options={opciones} selectedIds={selectedIds} onAdd={(id, label) => onChange([...items, add(id, label)])} placeholder={`Añadir ${titulo.toLowerCase()}…`} />
    </div>
  );
}

// ── Select de rango cualitativo (D…SSS) ─────────────────────────────────────
function RangoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={(RANGOS as readonly string[]).includes(value) ? value : RANGO_DEFAULT}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-border-glow"
    >
      {RANGOS.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}

// ── Panel del Poder de Combate (promedio dinámico de las tres secciones) ─────
function PoderDeCombatePanel({ poder }: { poder: ReturnType<typeof calcularPoderDeCombate> }) {
  const subs: { label: string; value: number }[] = [
    { label: "Atributos primarios", value: poder.primarios },
    { label: "Estadísticas de combate", value: poder.combate },
    { label: "Rangos", value: poder.rangos },
  ];
  return (
    <div className="rounded-xl border border-border-glow bg-deep/40 p-4">
      <div className="flex items-end gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">Poder de Combate</p>
          <p className="font-display text-3xl text-fg">
            {poder.total}
            <span className="text-lg text-fg-muted">%</span>
          </p>
        </div>
        <span className="mb-1 rounded-lg border border-border-glow bg-surface px-2.5 py-1 font-mono text-lg text-primary-glow">
          {poder.letra}
        </span>
        <p className="mb-1.5 ml-auto max-w-[16rem] text-right text-[11px] text-fg-muted">
          Promedio dinámico de los tres porcentajes por sección.
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {subs.map((sb) => (
          <div key={sb.label} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-xs text-fg-secondary">{sb.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-deep">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${sb.value}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-xs text-fg">{sb.value}%</span>
          </div>
        ))}
      </div>
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
