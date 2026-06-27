"use client";

import { useActionState, useEffect, useMemo, useState, startTransition } from "react";
import { guardarLore, type LoreFormState } from "@/lib/actions/lore";
import { slugify } from "@/lib/utils";
import type { EstadoPublicacion } from "@/db/schema/enums";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { ImageField, type ImageValue } from "@/components/admin/ImageField";
import { Field, TextInput, MarkdownField } from "@/components/admin/fields";

type Tipo = "texto" | "cita" | "tabla";
interface Seccion {
  id?: number;
  titulo: string;
  contenido: string;
  tipo: Tipo;
  estado: EstadoPublicacion;
}

const s = (v: unknown) => (v == null ? "" : String(v));

interface LoreInicial {
  pagina: Record<string, unknown>;
  secciones: { id: number; titulo: string | null; contenido: string | null; tipo: string; estadoPublicacion: EstadoPublicacion }[];
}

export function LoreForm({ inicial }: { inicial: LoreInicial | null }) {
  const toast = useToast();
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);
  const p = inicial?.pagina;

  const [titulo, setTituloRaw] = useState(s(p?.titulo));
  const [slug, setSlug] = useState(s(p?.slug));
  const [slugTouched, setSlugTouched] = useState(!!inicial);
  const [subtitulo, setSubtitulo] = useState(s(p?.subtitulo));
  const [introduccion, setIntroduccion] = useState(s(p?.introduccion));
  const [imagen, setImagen] = useState<ImageValue>({ assetId: null, url: s(p?.imagenUrl) || null });
  const [banner, setBanner] = useState<ImageValue>({ assetId: null, url: s(p?.bannerUrl) || null });
  const [estado, setEstado] = useState<EstadoPublicacion>((p?.estadoPublicacion as EstadoPublicacion) ?? "borrador");

  const setTitulo = (v: string) => {
    setTituloRaw(v);
    if (!slugTouched) setSlug(slugify(v));
    mark();
  };

  const [secciones, setSecciones] = useState<Seccion[]>(
    (inicial?.secciones ?? []).map((sec) => ({
      id: sec.id,
      titulo: s(sec.titulo),
      contenido: s(sec.contenido),
      tipo: (["texto", "cita", "tabla"].includes(sec.tipo) ? sec.tipo : "texto") as Tipo,
      estado: sec.estadoPublicacion ?? "publicado",
    })),
  );
  const updateSec = (i: number, patch: Partial<Seccion>) => {
    setSecciones((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
    mark();
  };
  const removeSec = (i: number) => { setSecciones((prev) => prev.filter((_, idx) => idx !== i)); mark(); };
  const moveSec = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    setSecciones((prev) => {
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    mark();
  };
  const addSec = () => { setSecciones((prev) => [...prev, { titulo: "", contenido: "", tipo: "texto", estado: "publicado" }]); mark(); };

  const [state, formAction, pending] = useActionState<LoreFormState | undefined, FormData>(guardarLore, undefined);

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

  const id = p?.id as number | undefined;

  const submit = () => {
    const payload = {
      titulo, slug, subtitulo, introduccion,
      imagenUrl: imagen.url, bannerUrl: banner.url,
      estadoPublicacion: estado,
      secciones: secciones.map((sec, i) => ({
        id: sec.id, orden: i, titulo: sec.titulo, contenido: sec.contenido, tipo: sec.tipo, estadoPublicacion: sec.estado,
      })),
    };
    const fd = new FormData();
    if (id) fd.set("id", String(id));
    fd.set("payload", JSON.stringify(payload));
    setDirty(false); // optimista: guardar = persistir el estado actual
    startTransition(() => formAction(fd));
  };

  const fe = state?.fieldErrors ?? {};

  return (
    <div className="space-y-4 pb-28">
      <AccordionSection title="Cabecera" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título *" error={fe.titulo}><TextInput value={titulo} onChange={setTitulo} placeholder="El despertar cósmico" /></Field>
          <Field label="Slug (URL) *" hint="se autogenera del título; editable" error={fe.slug}>
            <TextInput value={slug} onChange={(v) => { setSlug(slugify(v)); setSlugTouched(true); mark(); }} placeholder="el-despertar-cosmico" />
          </Field>
          <div className="sm:col-span-2"><Field label="Subtítulo"><TextInput value={subtitulo} onChange={(v) => { setSubtitulo(v); mark(); }} /></Field></div>
          <div className="sm:col-span-2"><Field label="Introducción" hint="markdown"><MarkdownField value={introduccion} onChange={(v) => { setIntroduccion(v); mark(); }} rows={4} /></Field></div>
        </div>
      </AccordionSection>

      <AccordionSection title="Secciones" subtitle={`${secciones.length}`} defaultOpen>
        <div className="space-y-3">
          {secciones.length === 0 && <p className="text-sm text-fg-muted">Sin secciones. Añade la primera.</p>}
          {secciones.map((sec, i) => (
            <div key={i} className="rounded-xl border border-border-base bg-deep/40 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-fg-muted">#{i + 1}</span>
                <select value={sec.tipo} onChange={(e) => updateSec(i, { tipo: e.target.value as Tipo })} className="rounded-lg border border-border-base bg-surface px-2 py-1 text-xs text-fg">
                  <option value="texto">Texto</option>
                  <option value="cita">Cita</option>
                  <option value="tabla">Tabla</option>
                </select>
                <select value={sec.estado} onChange={(e) => updateSec(i, { estado: e.target.value as EstadoPublicacion })} className="rounded-lg border border-border-base bg-surface px-2 py-1 text-xs text-fg">
                  <option value="borrador">Borrador</option>
                  <option value="publicado">Publicado</option>
                  <option value="oculto">Oculto</option>
                </select>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => moveSec(i, -1)} className="rounded px-1.5 text-fg-muted hover:text-fg" title="Subir">↑</button>
                  <button type="button" onClick={() => moveSec(i, 1)} className="rounded px-1.5 text-fg-muted hover:text-fg" title="Bajar">↓</button>
                  <button type="button" onClick={() => removeSec(i)} className="rounded px-1.5 text-fg-muted hover:text-error" title="Quitar">✕</button>
                </div>
              </div>
              <Field label="Título de la sección"><TextInput value={sec.titulo} onChange={(v) => updateSec(i, { titulo: v })} /></Field>
              <div className="mt-2">
                {sec.tipo === "tabla" ? (
                  <Field label="Tabla"><TableEditor value={sec.contenido} onChange={(v) => updateSec(i, { contenido: v })} /></Field>
                ) : (
                  <Field label={sec.tipo === "cita" ? "Cita (markdown)" : "Contenido (markdown)"}>
                    <MarkdownField value={sec.contenido} onChange={(v) => updateSec(i, { contenido: v })} rows={sec.tipo === "cita" ? 3 : 6} placeholder={sec.tipo === "cita" ? "La cita… (termina con — Autor para la atribución)" : undefined} />
                  </Field>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={addSec} className="rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-secondary hover:text-fg">+ Añadir sección</button>
        </div>
      </AccordionSection>

      <AccordionSection title="Imágenes">
        <div className="flex flex-wrap gap-8">
          <ImageField label="Imagen" value={imagen} onChange={(v) => { setImagen(v); mark(); }} alt={titulo} />
          <ImageField label="Banner" value={banner} onChange={(v) => { setBanner(v); mark(); }} alt={titulo} aspect="aspect-video" />
        </div>
      </AccordionSection>

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

// ── Editor estructurado de tabla (serializa a markdown) ─────────────────────
function parseMd(md: string): { headers: string[]; rows: string[][] } {
  const lines = md.trim().split("\n").filter((l) => l.includes("|"));
  if (lines.length < 1) return { headers: ["Columna 1", "Columna 2"], rows: [["", ""]] };
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const headers = cells(lines[0]);
  const rows = lines.slice(1).filter((l) => !/^[\s:|-]+$/.test(l)).map(cells);
  return { headers, rows: rows.length ? rows : [headers.map(() => "")] };
}
function toMd(headers: string[], rows: string[][]): string {
  const h = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${headers.map((_, c) => r[c] ?? "").join(" | ")} |`).join("\n");
  return `${h}\n${sep}\n${body}`;
}

function TableEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const init = useMemo(() => parseMd(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [headers, setHeaders] = useState<string[]>(init.headers);
  const [rows, setRows] = useState<string[][]>(init.rows);

  const emit = (h: string[], r: string[][]) => onChange(toMd(h, r));
  const setHeader = (c: number, v: string) => { const h = headers.map((x, i) => (i === c ? v : x)); setHeaders(h); emit(h, rows); };
  const setCell = (ri: number, c: number, v: string) => { const r = rows.map((row, i) => (i === ri ? row.map((x, j) => (j === c ? v : x)) : row)); setRows(r); emit(headers, r); };
  const addRow = () => { const r = [...rows, headers.map(() => "")]; setRows(r); emit(headers, r); };
  const removeRow = (ri: number) => { const r = rows.filter((_, i) => i !== ri); setRows(r); emit(headers, r.length ? r : [headers.map(() => "")]); };
  const addCol = () => { const h = [...headers, `Columna ${headers.length + 1}`]; const r = rows.map((row) => [...row, ""]); setHeaders(h); setRows(r); emit(h, r); };
  const removeCol = (c: number) => { if (headers.length <= 1) return; const h = headers.filter((_, i) => i !== c); const r = rows.map((row) => row.filter((_, i) => i !== c)); setHeaders(h); setRows(r); emit(h, r); };

  const cell = "rounded border border-border-base bg-surface px-2 py-1 text-sm text-fg outline-none focus:border-border-glow";
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            {headers.map((h, c) => (
              <th key={c} className="text-left">
                <div className="flex items-center gap-1">
                  <input value={h} onChange={(e) => setHeader(c, e.target.value)} className={cell + " font-display"} placeholder={`Col ${c + 1}`} />
                  <button type="button" onClick={() => removeCol(c)} className="text-xs text-fg-muted hover:text-error" title="Quitar columna">✕</button>
                </div>
              </th>
            ))}
            <th><button type="button" onClick={addCol} className="rounded border border-dashed border-border-glow px-2 py-1 text-xs text-fg-secondary hover:text-fg">+ col</button></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {headers.map((_, c) => (
                <td key={c}><input value={row[c] ?? ""} onChange={(e) => setCell(ri, c, e.target.value)} className={cell} /></td>
              ))}
              <td><button type="button" onClick={() => removeRow(ri)} className="text-xs text-fg-muted hover:text-error" title="Quitar fila">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow} className="mt-1 rounded border border-dashed border-border-glow px-2 py-1 text-xs text-fg-secondary hover:text-fg">+ fila</button>
    </div>
  );
}
