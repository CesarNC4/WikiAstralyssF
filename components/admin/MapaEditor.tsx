"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "./leafletGeomanSetup"; // expone window.L antes de geoman
import "@geoman-io/leaflet-geoman-free";
import { useCallback, useEffect, useState } from "react";
import { MapContainer, ImageOverlay, Polygon, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { CRS, type Map as LeafletMap } from "leaflet";
import { MAPA_IMG, MAPA_BOUNDS, normToLatLng, poligonoToLatLngs, latLngToNorm, estiloLocacion, CAPAS, type CapaKey } from "@/lib/mapa";
import { guardarNacionGeometria, guardarRegion, eliminarRegion, guardarLocacion, eliminarLocacion } from "@/lib/actions/mapa";
import { useToast } from "@/components/admin/Toast";
import type { MapaAdmin } from "@/lib/queries/adminMapa";
import type { EstadoPublicacion } from "@/db/schema/enums";

type Punto = [number, number];
type Kind = "nacion" | "region" | "locacion";

interface Sel {
  kind: Kind;
  id?: number;
  nombre: string;
  subtitulo: string;
  descripcion: string;
  historia: string;
  nacionId: number | null;
  regionId: number | null;
  tipo: string;
  eventoId: number | null;
  color: string;
  estado: EstadoPublicacion;
  poligono: Punto[] | null; // naciones/regiones
  punto: Punto | null; // locaciones
}

const vacio = (kind: Kind): Sel => ({
  kind, nombre: "", subtitulo: "", descripcion: "", historia: "",
  nacionId: null, regionId: null, tipo: "interes", eventoId: null,
  color: "", estado: "borrador", poligono: null, punto: null,
});

/** Puente para obtener la instancia de Leaflet y enganchar geoman. */
function MapBridge({ onReady }: { onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => onReady(map), [map, onReady]);
  return null;
}

export function MapaEditor({ data, tiposLocacion }: { data: MapaAdmin; tiposLocacion: string[] }) {
  const toast = useToast();
  const [naciones, setNaciones] = useState(data.naciones);
  const [regiones, setRegiones] = useState(data.regiones);
  const [locaciones, setLocaciones] = useState(data.locaciones);
  const [sel, setSel] = useState<Sel | null>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [drawing, setDrawing] = useState(false);
  /**
    * Capa activa. Antes eran tres interruptores independientes y con los tres
    * encendidos los polígonos de nación y de región competían por el mismo
    * clic: al intentar señalar una región dentro de una nación saltaba la que
    * estuviera encima. Ahora solo un nivel es interactivo; el resto se ve de
    * fondo, atenuado y sin capturar el ratón.
    */
  const [capa, setCapa] = useState<CapaKey>("naciones");
  const activa = (k: Exclude<CapaKey, "base">) => capa === k;
  const deFondo = (k: Exclude<CapaKey, "base">) => capa !== "base" && capa !== k;

  // ── Captura de geometría dibujada con geoman ──
  const onMap = useCallback((m: LeafletMap) => {
    setMap((prev) => {
      if (prev) return prev;
      // geoman emite "pm:create"; tipado laxo para no depender de su augmentación.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m.on("pm:create" as any, (e: any) => {
        const layer = e.layer;
        if (e.shape === "Polygon") {
          const latlngs = layer.getLatLngs()[0] as { lat: number; lng: number }[];
          const pts = latlngs.map((p) => latLngToNorm(p.lat, p.lng));
          setSel((s) => (s ? { ...s, poligono: pts } : s));
        } else if (e.shape === "Marker") {
          const ll = layer.getLatLng();
          setSel((s) => (s ? { ...s, punto: latLngToNorm(ll.lat, ll.lng) } : s));
        }
        m.removeLayer(layer); // la geometría se re-renderiza desde el estado
        setDrawing(false);
        toast("Geometría capturada. Recuerda Guardar.", "success");
      });
      return m;
    });
  }, [toast]);

  const dibujar = (modo: "Polygon" | "Marker") => {
    if (!map) return;
    setDrawing(true);
    map.pm.enableDraw(modo, { snappable: true, continueDrawing: false });
  };

  // ── Selección ──
  const elegir = (kind: Kind, item: Record<string, unknown>) => {
    setSel({
      kind,
      id: item.id as number,
      nombre: (item.nombre as string) ?? "",
      subtitulo: (item.subtitulo as string) ?? "",
      descripcion: (item.descripcion as string) ?? "",
      historia: (item.historia as string) ?? "",
      nacionId: (item.nacionId as number) ?? null,
      regionId: (item.regionId as number) ?? null,
      tipo: (item.tipo as string) ?? "",
      eventoId: (item.eventoId as number) ?? null,
      color: (item.color as string) ?? "",
      estado: (item.estadoPublicacion as EstadoPublicacion) ?? "borrador",
      poligono: (item.poligono as Punto[]) ?? null,
      punto: item.x != null && item.y != null ? [item.x as number, item.y as number] : null,
    });
  };

  const set = <K extends keyof Sel>(k: K, v: Sel[K]) => setSel((s) => (s ? { ...s, [k]: v } : s));

  // ── Guardar ──
  const guardar = async () => {
    if (!sel || !sel.nombre.trim()) { toast("Falta el nombre.", "error"); return; }
    setGuardando(true);
    try {
      if (sel.kind === "nacion") {
        await guardarNacionGeometria({ id: sel.id!, poligono: sel.poligono, centroX: sel.poligono ? centroide(sel.poligono)[0] : null, centroY: sel.poligono ? centroide(sel.poligono)[1] : null, color: sel.color || null });
        setNaciones((arr) => arr.map((n) => (n.id === sel.id ? { ...n, poligono: sel.poligono, color: sel.color || null } : n)));
      } else if (sel.kind === "region") {
        const id = await guardarRegion({ id: sel.id, nacionId: sel.nacionId, nombre: sel.nombre, subtitulo: sel.subtitulo, descripcion: sel.descripcion, historia: sel.historia, poligono: sel.poligono, centroX: sel.poligono ? centroide(sel.poligono)[0] : null, centroY: sel.poligono ? centroide(sel.poligono)[1] : null, color: sel.color || null, estadoPublicacion: sel.estado });
        const nuevo = { id, nacionId: sel.nacionId, nombre: sel.nombre, subtitulo: sel.subtitulo || null, descripcion: sel.descripcion || null, historia: sel.historia || null, poligono: sel.poligono, centroX: null, centroY: null, color: sel.color || null, imagenUrl: null, bannerUrl: null, estadoPublicacion: sel.estado, publicadoPrimeraVezEn: null, creadoEn: new Date(), actualizadoEn: new Date(), eliminadoEn: null } as MapaAdmin["regiones"][number];
        setRegiones((arr) => (sel.id ? arr.map((r) => (r.id === id ? nuevo : r)) : [...arr, nuevo]));
        setSel((s) => (s ? { ...s, id } : s));
      } else {
        const id = await guardarLocacion({ id: sel.id, regionId: sel.regionId, nacionId: sel.nacionId, tipo: sel.tipo, nombre: sel.nombre, subtitulo: sel.subtitulo, descripcion: sel.descripcion, historia: sel.historia, x: sel.punto?.[0] ?? null, y: sel.punto?.[1] ?? null, eventoId: sel.eventoId, estadoPublicacion: sel.estado });
        const nuevo = { id, regionId: sel.regionId, nacionId: sel.nacionId, tipo: sel.tipo, nombre: sel.nombre, subtitulo: sel.subtitulo || null, descripcion: sel.descripcion || null, historia: sel.historia || null, x: sel.punto?.[0] ?? null, y: sel.punto?.[1] ?? null, imagenUrl: null, bannerUrl: null, eventoId: sel.eventoId, estadoPublicacion: sel.estado, publicadoPrimeraVezEn: null, creadoEn: new Date(), actualizadoEn: new Date(), eliminadoEn: null } as MapaAdmin["locaciones"][number];
        setLocaciones((arr) => (sel.id ? arr.map((l) => (l.id === id ? nuevo : l)) : [...arr, nuevo]));
        setSel((s) => (s ? { ...s, id } : s));
      }
      toast("Guardado.", "success");
    } catch {
      toast("No se pudo guardar.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!sel?.id || sel.kind === "nacion") return;
    if (!confirm("¿Enviar a la papelera?")) return;
    try {
      if (sel.kind === "region") { await eliminarRegion(sel.id); setRegiones((a) => a.filter((r) => r.id !== sel.id)); }
      else { await eliminarLocacion(sel.id); setLocaciones((a) => a.filter((l) => l.id !== sel.id)); }
      setSel(null);
      toast("Enviado a la papelera.", "success");
    } catch { toast("No se pudo borrar.", "error"); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Mapa */}
      <div className="overflow-hidden rounded-2xl border border-border-glow">
        <MapContainer crs={CRS.Simple} bounds={MAPA_BOUNDS} maxBounds={MAPA_BOUNDS} minZoom={-2} maxZoom={2} attributionControl={false} style={{ height: "min(72vh, 700px)", width: "100%", background: "#0a0a14" }}>
          <MapBridge onReady={onMap} />
          <ImageOverlay url={MAPA_IMG} bounds={MAPA_BOUNDS} />
          {capa !== "base" && naciones.filter((n) => n.poligono && n.poligono.length >= 3).map((n) => (
            <Polygon key={`n${n.id}`} positions={poligonoToLatLngs(n.poligono)} pathOptions={{ color: n.color ?? "#7b5cff", weight: sel?.kind === "nacion" && sel.id === n.id ? 4 : 2, opacity: deFondo("naciones") ? 0.35 : 1, fillOpacity: activa("naciones") ? 0.1 : 0.03, interactive: !drawing && activa("naciones") }} eventHandlers={{ click: () => { if (!drawing) elegir("nacion", n); } }}>
              <Tooltip sticky>{n.nombre}</Tooltip>
            </Polygon>
          ))}
          {capa !== "base" && regiones.filter((r) => r.poligono && r.poligono.length >= 3).map((r) => (
            <Polygon key={`r${r.id}`} positions={poligonoToLatLngs(r.poligono)} pathOptions={{ color: r.color ?? "#2dd4bf", weight: sel?.kind === "region" && sel.id === r.id ? 4 : 1.5, dashArray: "4", opacity: deFondo("regiones") ? 0.35 : 1, fillOpacity: activa("regiones") ? 0.1 : 0.03, interactive: !drawing && activa("regiones") }} eventHandlers={{ click: () => { if (!drawing) elegir("region", r); } }}>
              <Tooltip sticky>{r.nombre}</Tooltip>
            </Polygon>
          ))}
          {/* polígono en edición */}
          {sel?.poligono && sel.poligono.length >= 3 && (
            <Polygon positions={poligonoToLatLngs(sel.poligono)} pathOptions={{ color: "#ffd66b", weight: 2, fillOpacity: 0.15 }} />
          )}
          {capa !== "base" && locaciones.filter((l) => l.x != null && l.y != null).map((l) => (
            <CircleMarker key={`l${l.id}`} center={normToLatLng([l.x as number, l.y as number])} radius={activa("locaciones") ? 6 : 4} pathOptions={{ color: "#0a0a14", weight: 1.5, fillColor: estiloLocacion(l.tipo).color, fillOpacity: deFondo("locaciones") ? 0.4 : 1, interactive: !drawing && activa("locaciones") }} eventHandlers={{ click: () => { if (!drawing) elegir("locacion", l); } }}>
              <Tooltip>{l.nombre}</Tooltip>
            </CircleMarker>
          ))}
          {sel?.punto && (
            <CircleMarker center={normToLatLng(sel.punto)} radius={8} pathOptions={{ color: "#ffd66b", weight: 2, fillColor: "#ffd66b", fillOpacity: 0.8 }} />
          )}
        </MapContainer>
      </div>

      {/* Panel */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSel(vacio("region"))} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-void">+ Región</button>
          <button onClick={() => setSel(vacio("locacion"))} className="rounded-lg bg-secondary px-3 py-1.5 text-sm text-void">+ Locación</button>
        </div>

        {/* Nivel del mapa: solo uno es interactivo, y así nada se solapa. */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {CAPAS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCapa(c.key)}
              className={`rounded-full border px-2.5 py-1 transition-colors ${
                capa === c.key ? "border-border-glow bg-surface text-fg" : "border-border-base text-fg-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {drawing && (
          <div className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
            <span>Dibujando… clic para añadir vértices, doble clic para cerrar.</span>
            <button onClick={() => { map?.pm.disableDraw(); setDrawing(false); }} className="underline">Cancelar</button>
          </div>
        )}

        {!sel ? (
          <div className="rounded-xl border border-dashed border-border-base p-4 text-sm text-fg-muted">
            Selecciona una nación/región/locación en el mapa o crea una nueva. Para fijar geometría usa “Dibujar”.
            <ul className="mt-3 space-y-1">
              {naciones.map((n) => (
                <li key={n.id}><button onClick={() => elegir("nacion", n)} className="text-left text-fg-secondary hover:text-fg">🗺 {n.nombre}</button></li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border-base bg-surface/40 p-4">
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-wide text-fg-muted">
                {sel.kind === "nacion" ? "Nación (geometría)" : sel.kind === "region" ? "Región" : "Locación"}
                {sel.id ? ` · #${sel.id}` : " · nueva"}
              </p>
              {sel.id && (
                <a
                  href={`/admin/${sel.kind === "nacion" ? "naciones" : sel.kind === "region" ? "regiones" : "locaciones"}/${sel.id}/editar`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border-glow px-2.5 py-1 text-[11px] text-accent hover:bg-surface"
                  title="Abrir el formulario completo (lore, imágenes, galería)"
                >
                  Editar ficha completa ↗
                </a>
              )}
            </div>

            {sel.kind !== "nacion" && (
              <input value={sel.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre *" className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg outline-none" />
            )}
            {sel.kind === "nacion" && <p className="text-sm text-fg">{sel.nombre}</p>}

            {sel.kind === "region" && (
              <select value={sel.nacionId ?? ""} onChange={(e) => set("nacionId", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg">
                <option value="">— Nación —</option>
                {naciones.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
            )}

            {sel.kind === "locacion" && (
              <>
                <select value={sel.tipo} onChange={(e) => set("tipo", e.target.value)} className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg">
                  <option value="">Sin tipo…</option>
                  {tiposLocacion.map((k: string) => <option key={k} value={k}>{k}</option>)}
                </select>
                <select value={sel.regionId ?? ""} onChange={(e) => set("regionId", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg">
                  <option value="">— Región —</option>
                  {regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
                <select value={sel.nacionId ?? ""} onChange={(e) => set("nacionId", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg">
                  <option value="">— Nación —</option>
                  {naciones.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                </select>
                {sel.tipo === "batalla" && (
                  <select value={sel.eventoId ?? ""} onChange={(e) => set("eventoId", e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg">
                    <option value="">— Evento (cronología) —</option>
                    {data.eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.titulo}</option>)}
                  </select>
                )}
              </>
            )}

            {sel.kind !== "nacion" && (
              <textarea value={sel.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Descripción" rows={3} className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg outline-none" />
            )}

            <input value={sel.color} onChange={(e) => set("color", e.target.value)} placeholder="Color (hex, opcional)" className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg outline-none" />

            {/* Geometría */}
            <div className="flex items-center gap-2">
              {sel.kind === "locacion" ? (
                <button onClick={() => dibujar("Marker")} className="rounded-lg border border-border-glow px-3 py-1.5 text-xs text-fg-secondary hover:text-fg">📍 Colocar punto</button>
              ) : (
                <button onClick={() => dibujar("Polygon")} className="rounded-lg border border-border-glow px-3 py-1.5 text-xs text-fg-secondary hover:text-fg">✏️ Dibujar contorno</button>
              )}
              <span className="text-xs text-fg-muted">{sel.poligono ? `${sel.poligono.length} pts` : sel.punto ? "punto fijado" : "sin geometría"}</span>
            </div>

            {sel.kind !== "nacion" && (
              <select value={sel.estado} onChange={(e) => set("estado", e.target.value as EstadoPublicacion)} className="w-full rounded-lg border border-border-base bg-deep px-3 py-2 text-sm text-fg">
                <option value="borrador">Borrador</option>
                <option value="publicado">Publicado</option>
                <option value="oculto">Oculto</option>
              </select>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={guardar} disabled={guardando} className="rounded-lg bg-primary px-4 py-2 text-sm text-void disabled:opacity-60">{guardando ? "Guardando…" : "Guardar"}</button>
              <button onClick={() => setSel(null)} className="rounded-lg border border-border-base px-3 py-2 text-sm text-fg-secondary">Cancelar</button>
              {sel.id && sel.kind !== "nacion" && <button onClick={borrar} className="ml-auto rounded-lg border border-border-base px-3 py-2 text-sm text-fg-muted hover:text-error">Papelera</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Centroide simple (media de vértices) para colocar la etiqueta de la entidad. */
function centroide(pts: Punto[]): Punto {
  const n = pts.length || 1;
  const sx = pts.reduce((a, p) => a + p[0], 0) / n;
  const sy = pts.reduce((a, p) => a + p[1], 0) / n;
  return [sx, sy];
}
