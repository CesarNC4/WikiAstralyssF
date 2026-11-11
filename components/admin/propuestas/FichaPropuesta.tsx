"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { subInp } from "@/components/admin/blocks/shared";
import { AccordionSection } from "@/components/admin/ui";
import { AvisoDiscord, type ValorAviso } from "@/components/admin/AvisoDiscord";
import { faltaEn, type Analisis, type DatoAnalizado, type EstadoFicha, type FichaAnalizada } from "@/lib/propuestas/tipos";
import { cn } from "@/lib/utils";
import { DatoFila } from "./DatoFila";

const GRUPOS: { titulo: string; deEste: (d: DatoAnalizado) => boolean }[] = [
  { titulo: "Datos", deEste: (d) => d.clase === "campo" || d.clase === "desconocido" },
  { titulo: "Conexiones", deEste: (d) => d.clase === "conexion" || d.clase === "quitar" },
  { titulo: "Fechas", deEste: (d) => d.clase === "fecha" },
  { titulo: "Listas", deEste: (d) => d.clase === "lista" || d.clase === "quitar-lista" || d.clase === "estadisticas" },
  { titulo: "Notas de autor", deEste: (d) => d.clase === "nota" },
];

export function FichaPropuesta({
  ficha,
  datos,
  cal,
  catalogos,
  fallos,
  destino,
  ocupada,
  onDato,
  onEstado,
  onNombre,
  onDestino,
  onAplicar,
  onDescartar,
  aviso,
  onAviso,
}: {
  /** El aviso a Discord elegido en la tarjeta. */
  aviso: ValorAviso;
  onAviso: (v: ValorAviso) => void;
  ficha: FichaAnalizada;
  /** Los datos con lo que el autor haya cambiado. */
  datos: DatoAnalizado[];
  cal: Analisis["calendario"];
  catalogos: Analisis["catalogos"];
  fallos: Record<string, string>;
  destino: number | "crear" | undefined;
  ocupada: boolean;
  onDato: (clave: string, p: Partial<DatoAnalizado>) => void;
  onEstado: (e: EstadoFicha | null) => void;
  onNombre: (n: string) => void;
  onDestino: (d: number | "crear" | null) => void;
  onAplicar: () => void;
  onDescartar: () => void;
}) {
  const [verIguales, setVerIguales] = useState(false);
  const iguales = datos.filter((d) => d.igual && d.decision === "descartar");
  const porResolver = datos.filter((d) => faltaEn(d, cal)).length;
  const bloqueada = Boolean(ficha.error) || ficha.ambigua;
  const lista = porResolver === 0 && !bloqueada;
  const nueva = ficha.id == null;
  // Sobre qué ficha cae y en qué estado queda: de eso depende el aviso (estreno o cambio).
  const idDestino = destino === "crear" ? null : typeof destino === "number" ? destino : ficha.id;
  const estadoFinal = ficha.conEstado ? ficha.estado ?? (nueva ? "borrador" : ficha.estadoActual ?? "borrador") : "publicado";

  const insignia = bloqueada ? (
    <span className="rounded-full border border-error/40 px-2 py-0.5 text-[11px] text-error">Revisar</span>
  ) : porResolver ? (
    <span className="rounded-full border border-warning/40 px-2 py-0.5 text-[11px] text-warning">{porResolver} por resolver</span>
  ) : (
    <span className="rounded-full border border-success/40 px-2 py-0.5 text-[11px] text-success">Lista</span>
  );

  return (
    <AccordionSection
      title={ficha.nombre}
      subtitle={`${ficha.singular} · ${nueva ? "nueva" : `#${ficha.id}`}`}
      badge={insignia}
      defaultOpen={false}
    >
      <div className="space-y-4">
        {ficha.error && <p className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">{ficha.error}</p>}
        {ficha.avisos.map((a) => (
          <p key={a} className="flex items-start gap-1.5 text-sm text-warning">
            <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" /> {a}
          </p>
        ))}

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-base bg-deep/40 p-3">
          {ficha.modo === "nueva" && ficha.id == null && (
            <label className="min-w-48 flex-1 text-xs text-fg-muted">
              Nombre
              <input value={ficha.nombre} onChange={(e) => onNombre(e.target.value)} className={cn(subInp, "mt-1 block w-full")} />
            </label>
          )}
          {ficha.modo === "nueva" && ficha.parecidas.length > 0 && (
            <label className="min-w-48 flex-1 text-xs text-fg-muted">
              Se aplica sobre
              <select
                value={destino ?? (ficha.id != null ? String(ficha.id) : ficha.ambigua ? "" : "crear")}
                onChange={(e) => onDestino(e.target.value === "crear" ? "crear" : Number(e.target.value))}
                className={cn(subInp, "mt-1 block w-full")}
              >
                {ficha.ambigua && <option value="">Elige una…</option>}
                <option value="crear">Crear una ficha nueva</option>
                {ficha.parecidas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} #{c.id}{c.detalle ? ` · ${c.detalle}` : ""}{c.estado && c.estado !== "publicado" ? ` · ${c.estado}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {ficha.conEstado && (
            <label className="text-xs text-fg-muted">
              Estado de la ficha
              <select
                value={ficha.estado ?? (nueva ? "borrador" : "")}
                onChange={(e) => onEstado((e.target.value || null) as EstadoFicha | null)}
                className={cn(subInp, "mt-1 block")}
              >
                {nueva ? null : <option value="">Sin cambiar ({ficha.estadoActual})</option>}
                <option value="borrador">Borrador</option>
                <option value="publicado">Publicado</option>
                <option value="oculto">Oculto</option>
              </select>
            </label>
          )}
          {ficha.rutaPanel && (
            <Link href={ficha.rutaPanel} target="_blank" className="inline-flex items-center gap-1 pb-1 text-xs text-accent hover:underline">
              Abrir la ficha <Icon name="ExternalLink" size={11} />
            </Link>
          )}
          <AvisoDiscord tipo={ficha.entidad} id={idDestino} estado={estadoFinal} valor={aviso} onChange={onAviso} hacia="abajo" />
          {ficha.estado === "publicado" && ficha.estadoActual !== "publicado" && (
            <p className="w-full text-xs text-fg-muted">La verán los jugadores. Si es su primera publicación, se avisa en Discord en el canal que ves.</p>
          )}
        </div>

        {GRUPOS.map((g) => {
          const delGrupo = datos.filter((d) => g.deEste(d) && (verIguales || !(d.igual && d.decision === "descartar")));
          if (!delGrupo.length) return null;
          return (
            <section key={g.titulo} className="space-y-2">
              <h3 className="font-display text-sm text-accent">{g.titulo}</h3>
              {delGrupo.map((d) => (
                <DatoFila key={d.clave} dato={d} cal={cal} catalogos={catalogos} fallo={fallos[d.clave]} rutaFicha={ficha.rutaPanel} onCambio={(p) => onDato(d.clave, p)} />
              ))}
            </section>
          );
        })}

        {iguales.length > 0 && (
          <button type="button" onClick={() => setVerIguales(!verIguales)} className="text-xs text-fg-muted hover:text-fg">
            {verIguales ? "Ocultar" : "Ver"} {iguales.length === 1 ? "1 dato que ya está así" : `${iguales.length} datos que ya están así`}
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border-base pt-3">
          <button
            type="button"
            disabled={!lista || ocupada}
            onClick={onAplicar}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-void disabled:opacity-40"
          >
            {ocupada ? "Aplicando…" : nueva ? "Crear y aplicar" : "Aplicar"}
          </button>
          {porResolver > 0 && <span className="text-xs text-warning">Resuelve lo marcado, o decide descartarlo o dejarlo para luego.</span>}
          <button type="button" disabled={ocupada} onClick={onDescartar} className="ml-auto rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-muted hover:border-error hover:text-error disabled:opacity-40">
            Descartar la propuesta entera
          </button>
        </div>
      </div>
    </AccordionSection>
  );
}
