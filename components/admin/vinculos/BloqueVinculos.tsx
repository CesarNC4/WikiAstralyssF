"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { EntityImage } from "@/components/media/EntityImage";
import { subInp, IconButton } from "@/components/admin/blocks/shared";
import { useToast } from "@/components/admin/Toast";
import { SelectorFicha } from "./SelectorFicha";
import {
  listarVinculos,
  crearVinculosEnLote,
  actualizarVinculo,
  borrarVinculo,
  reordenarVinculos,
  type OpcionFicha,
} from "@/lib/actions/vinculos";
import type { BloqueRelacion, FilaVinculo } from "@/lib/relaciones/tipos";
import { entityByKey } from "@/lib/entities";

/**
 * Editor de un bloque de relación. El mismo componente sirve a los dos extremos
 * de cualquier relación: lo único que cambia es el lado, y eso ya viene resuelto
 * en el descriptor que produce el registro.
 *
 * Se guarda por diferencias —cada alta, baja o cambio es una operación sobre esa
 * fila— porque el otro extremo puede estar editándose a la vez. El modelo
 * anterior, borrar el bloque entero y reinsertarlo, habría hecho que guardar una
 * ficha borrase los vínculos creados desde la otra.
 */
export function BloqueVinculos({
  bloque,
  ownerId,
  abiertoInicial,
  opciones = {},
}: {
  bloque: BloqueRelacion;
  ownerId: number;
  abiertoInicial?: boolean;
  /**
   * Las listas de los desplegables, por nombre de catálogo. Antes venían fijas
   * dentro de la declaración de cada relación y sólo se podían cambiar tocando
   * código.
   */
  opciones?: Record<string, string[]>;
}) {
  const toast = useToast();
  const [filas, setFilas] = useState<FilaVinculo[]>([]);
  const [cargado, setCargado] = useState(false);
  const [abierto, setAbierto] = useState(abiertoInicial ?? false);
  const [buscando, setBuscando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setFilas(await listarVinculos(bloque.relId, bloque.lado, ownerId));
    } catch {
      toast("No se pudieron cargar los vínculos.", "error");
    } finally {
      setCargado(true);
    }
  }, [bloque.relId, bloque.lado, ownerId, toast]);

  // Las filas se piden al abrir, desde el propio manejador del clic: una ficha
  // de personaje tiene 18 bloques y cargarlos todos de golpe sería una
  // avalancha de consultas para nada. No es un efecto porque no sincroniza con
  // ningún sistema externo, sólo reacciona a que el usuario despliegue.
  const alternar = () => {
    const abriendo = !abierto;
    setAbierto(abriendo);
    if (abriendo && !cargado) void cargar();
  };

  const conError = async (fn: () => Promise<FilaVinculo[]>) => {
    try {
      setFilas(await fn());
    } catch {
      toast("No se pudo guardar el cambio.", "error");
      void cargar();
    }
  };

  const vincular = (fichas: OpcionFicha[]) =>
    conError(() =>
      crearVinculosEnLote(
        bloque.relId,
        bloque.lado,
        ownerId,
        // Un bloque de referencia simple apunta a una sola ficha: si se marcan
        // varias, la última ganaría en silencio, así que se queda la primera.
        (bloque.unico ? fichas.slice(0, 1) : fichas).map((f) => ({ id: f.id, tipo: f.entidad })),
      ),
    );

  const quitar = (filaId: number) =>
    conError(() => borrarVinculo(bloque.relId, bloque.lado, ownerId, filaId));

  const cambiarCampo = (fila: FilaVinculo, name: string, valor: string) => {
    setFilas((prev) =>
      prev.map((f) => (f.id === fila.id ? { ...f, campos: { ...f.campos, [name]: valor } } : f)),
    );
  };

  const guardarCampos = (filaId: number) => {
    const fila = filas.find((f) => f.id === filaId);
    if (!fila) return;
    void conError(() => actualizarVinculo(bloque.relId, bloque.lado, ownerId, filaId, fila.campos));
  };

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= filas.length) return;
    const next = [...filas];
    [next[i], next[j]] = [next[j], next[i]];
    setFilas(next);
    void conError(() =>
      reordenarVinculos(bloque.relId, bloque.lado, ownerId, next.map((f) => f.id)),
    );
  };

  const meta = entityByKey(bloque.objetivo);
  const n = cargado ? filas.length : null;

  return (
    <section className="rounded-xl border border-border-base bg-surface/30">
      <button
        type="button"
        onClick={alternar}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={abierto}
      >
        <Icon name={bloque.icon} size={15} className="text-accent" />
        <span className="text-sm font-medium text-fg">{bloque.titulo}</span>
        {n !== null && n > 0 && (
          <span className="rounded-full bg-surface px-1.5 text-xs text-fg-muted">{n}</span>
        )}
        {/* Un bloque vacío no aparece en público, pero aquí sí se señala. */}
        {n === 0 && <span className="text-xs text-fg-muted">sin conectar</span>}
        <Icon name={abierto ? "ChevronUp" : "ChevronDown"} size={14} className="ml-auto text-fg-muted" />
      </button>

      {abierto && (
        <div className="space-y-2 px-3 pb-3">
          {bloque.hint && <p className="text-xs text-fg-muted">{bloque.hint}</p>}

          {bloque.editorPropio && (
            <p className="rounded-lg border border-border-base bg-surface/50 px-2 py-1.5 text-xs text-fg-muted">
              Este bloque tiene su propio editor con rangos y facciones más arriba en la ficha. Aquí
              puedes ver y quitar miembros, pero para ordenarlos usa aquel.
            </p>
          )}

          {!cargado && <p className="text-xs text-fg-muted">Cargando…</p>}

          {cargado &&
            filas.map((fila, i) => (
              <div
                key={fila.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border-base bg-surface/40 p-2"
              >
                {bloque.ordenable && !bloque.editorPropio && (
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      className="text-xs text-fg-muted disabled:opacity-30"
                      aria-label="Subir"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === filas.length - 1}
                      className="text-xs text-fg-muted disabled:opacity-30"
                      aria-label="Bajar"
                    >
                      ▼
                    </button>
                  </div>
                )}

                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded">
                  <EntityImage src={fila.imagenUrl} alt={fila.label} name={fila.label} sizes="28px" />
                </span>

                <span className="min-w-[8rem] flex-1">
                  <FichaEnlace fila={fila} objetivo={bloque.objetivo} />
                  {fila.estado && fila.estado !== "publicado" && (
                    <span className="ml-1 text-[10px] uppercase text-fg-muted">{fila.estado}</span>
                  )}
                </span>

                {bloque.campos.map((campo) =>
                  campo.tipo === "select" ? (
                    <select
                      key={campo.name}
                      value={fila.campos[campo.name] ?? ""}
                      onChange={(e) => cambiarCampo(fila, campo.name, e.target.value)}
                      onBlur={() => guardarCampos(fila.id)}
                      className={subInp + " w-36"}
                      title={campo.label}
                    >
                      <option value="">{campo.label}…</option>
                      {(campo.catalogo ? opciones[campo.catalogo] ?? [] : campo.opciones ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : campo.tipo === "checkbox" ? (
                    <label key={campo.name} className="flex items-center gap-1 text-xs text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={fila.campos[campo.name] === "true"}
                        onChange={(e) => {
                          const valor = String(e.target.checked);
                          cambiarCampo(fila, campo.name, valor);
                          void conError(() =>
                            actualizarVinculo(bloque.relId, bloque.lado, ownerId, fila.id, {
                              ...fila.campos,
                              [campo.name]: valor,
                            }),
                          );
                        }}
                      />
                      {campo.label}
                    </label>
                  ) : (
                    <input
                      key={campo.name}
                      value={fila.campos[campo.name] ?? ""}
                      onChange={(e) => cambiarCampo(fila, campo.name, e.target.value)}
                      onBlur={() => guardarCampos(fila.id)}
                      placeholder={campo.label}
                      className={subInp + " w-40"}
                    />
                  ),
                )}

                <IconButton onClick={() => quitar(fila.id)} title="Quitar vínculo" danger>
                  ✕
                </IconButton>
              </div>
            ))}

          {cargado && filas.length === 0 && !buscando && (
            <p className="text-xs text-fg-muted">Sin vínculos todavía.</p>
          )}

          {buscando ? (
            <SelectorFicha
              entidad={bloque.objetivo}
              yaVinculados={filas.map((f) => f.objetivoId)}
              onElegir={vincular}
              onCerrar={() => setBuscando(false)}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setBuscando(true)}
              className="rounded-lg border border-dashed border-border-glow px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
            >
              {bloque.unico && filas.length > 0
                ? "Cambiar"
                : `+ Vincular ${meta ? meta.plural.toLowerCase() : "fichas"}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Enlace a la ficha del otro extremo, si esa entidad tiene página pública. */
function FichaEnlace({ fila, objetivo }: { fila: FilaVinculo; objetivo: string }) {
  const meta = entityByKey(fila.objetivoTipo ?? objetivo);
  if (!meta || !fila.objetivoId) return <span className="text-sm text-fg">{fila.label}</span>;
  return (
    <Link href={`${meta.route}/${fila.objetivoId}`} className="text-sm text-fg hover:text-accent">
      {fila.label}
    </Link>
  );
}
