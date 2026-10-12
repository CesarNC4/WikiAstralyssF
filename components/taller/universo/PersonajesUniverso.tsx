"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EntityImage } from "@/components/media/EntityImage";
import type { PersonajeUniverso } from "@/lib/queries/taller";

type Opcion = { id: number; nombre: string };

const sel = "rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow";

/**
 * Universo › Personajes (spec §10): todos los personajes en cuadrícula, con
 * filtros por raza, nación u organización, estado vital y nombre. Cada uno abre
 * su editor del admin.
 */
export function PersonajesUniverso({
  personajes,
  razas,
  naciones,
  organizaciones,
}: {
  personajes: PersonajeUniverso[];
  razas: Opcion[];
  naciones: Opcion[];
  organizaciones: Opcion[];
}) {
  const [q, setQ] = useState("");
  const [raza, setRaza] = useState("");
  const [nacion, setNacion] = useState("");
  const [org, setOrg] = useState("");
  const [vital, setVital] = useState("");

  const estados = useMemo(
    () => [...new Set(personajes.map((p) => p.estadoVital).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)),
    [personajes],
  );

  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const filtrados = useMemo(() => {
    const t = norm(q.trim());
    return personajes.filter(
      (p) =>
        (!t || norm(`${p.nombre} ${p.titulo ?? ""}`).includes(t)) &&
        (!raza || p.razas.includes(Number(raza))) &&
        (!nacion || p.naciones.includes(Number(nacion))) &&
        (!org || p.organizaciones.includes(Number(org))) &&
        (!vital || (vital === "—" ? !p.estadoVital : p.estadoVital === vital)),
    );
  }, [personajes, q, raza, nacion, org, vital]);

  const hayFiltro = q || raza || nacion || org || vital;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" className={`${sel} min-w-48 flex-1`} />
        <select value={raza} onChange={(e) => setRaza(e.target.value)} className={sel} aria-label="Raza">
          <option value="">Todas las razas</option>
          {razas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        <select value={nacion} onChange={(e) => setNacion(e.target.value)} className={sel} aria-label="Nación">
          <option value="">Todas las naciones</option>
          {naciones.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        <select value={org} onChange={(e) => setOrg(e.target.value)} className={sel} aria-label="Organización">
          <option value="">Todas las organizaciones</option>
          {organizaciones.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        <select value={vital} onChange={(e) => setVital(e.target.value)} className={sel} aria-label="Estado vital">
          <option value="">Cualquier estado vital</option>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
          <option value="—">Sin estado</option>
        </select>
        {hayFiltro && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setRaza("");
              setNacion("");
              setOrg("");
              setVital("");
            }}
            className="text-xs text-fg-muted hover:text-fg"
          >
            Quitar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-fg-muted">
          {filtrados.length} de {personajes.length}
        </span>
        <Link href="/admin/personajes/nuevo" className="rounded-lg border border-border-glow px-3 py-1.5 text-sm text-accent hover:bg-surface">
          + Nuevo personaje
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filtrados.map((p) => (
          <Link
            key={p.id}
            href={`/admin/personajes/${p.id}/editar`}
            className="group overflow-hidden rounded-xl border border-border-base bg-surface/40 transition-colors hover:border-border-glow"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden">
              <EntityImage src={p.imagenUrl} alt={p.nombre} name={p.nombre} sizes="200px" />
              {p.estadoPublicacion !== "publicado" && (
                <span className="absolute left-1.5 top-1.5 rounded bg-void/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-warning">
                  {p.estadoPublicacion}
                </span>
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-sm text-fg group-hover:text-accent">{p.nombre}</p>
              <p className="truncate text-[11px] text-fg-muted">{[p.titulo, p.estadoVital].filter(Boolean).join(" · ") || " "}</p>
            </div>
          </Link>
        ))}
      </div>
      {filtrados.length === 0 && <p className="py-12 text-center text-sm text-fg-muted">Ningún personaje coincide.</p>}
    </div>
  );
}
