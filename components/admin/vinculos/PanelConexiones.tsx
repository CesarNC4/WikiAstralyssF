"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { BloqueVinculos } from "./BloqueVinculos";
import { resumenConexiones } from "@/lib/actions/vinculos";
import { bloquesDe } from "@/lib/relaciones/registro";
import { entityByKey } from "@/lib/entities";
import { NotaPrivada } from "@/components/admin/NotaPrivada";
import { VisibilidadCampos } from "@/components/admin/VisibilidadCampos";

/**
 * Panel de conexiones de una ficha. Está siempre visible mientras editas el
 * resto, que es lo que convierte la wiki en algo conectado: no hay que ir a
 * buscar el bloque de relaciones, se ve de un vistazo qué está enlazado y qué
 * no.
 *
 * Los bloques salen del registro, así que aparecen los dos sentidos de cada
 * relación sin escribir nada por ficha: la organización lista a sus miembros y
 * el personaje sus organizaciones desde una única declaración.
 */
export function PanelConexiones({
  entidad,
  ownerId,
}: {
  entidad: string;
  /** Sin id no hay nada que vincular: la ficha aún no existe. */
  ownerId: number | null;
}) {
  const bloques = bloquesDe(entidad);
  const [conteo, setConteo] = useState<Record<string, number> | null>(null);
  const [soloConectados, setSoloConectados] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    let vivo = true;
    resumenConexiones(entidad, ownerId)
      .then((r) => { if (vivo) setConteo(r); })
      .catch(() => { if (vivo) setConteo({}); });
    return () => { vivo = false; };
  }, [entidad, ownerId]);

  if (bloques.length === 0) return null;

  if (!ownerId) {
    return (
      <aside className="rounded-xl border border-border-base bg-surface/30 p-3">
        <Cabecera />
        <p className="mt-2 text-xs text-fg-muted">
          Guarda la ficha para poder conectarla con el resto del mundo.
        </p>
      </aside>
    );
  }

  const total = conteo ? Object.values(conteo).reduce((a, b) => a + b, 0) : null;
  const conectados = conteo ? bloques.filter((b) => (conteo[`${b.relId}:${b.lado}`] ?? 0) > 0).length : null;
  const visibles = soloConectados && conteo
    ? bloques.filter((b) => (conteo[`${b.relId}:${b.lado}`] ?? 0) > 0)
    : bloques;

  return (
    <aside className="space-y-2">
      <NotaPrivada entidadTipo={entidad} entidadId={ownerId} />
      <VisibilidadCampos entidad={entidad} ownerId={ownerId} />

      <div className="rounded-xl border border-border-base bg-surface/30 p-3">
        <Cabecera />
        <p className="mt-1 text-xs text-fg-muted">
          {total === null
            ? "Contando…"
            : `${total} ${total === 1 ? "vínculo" : "vínculos"} en ${conectados} de ${bloques.length} bloques.`}
        </p>
        {conteo && conectados !== null && conectados < bloques.length && (
          <label className="mt-2 flex items-center gap-1.5 text-xs text-fg-secondary">
            <input
              type="checkbox"
              checked={soloConectados}
              onChange={(e) => setSoloConectados(e.target.checked)}
            />
            Ocultar los bloques sin conectar
          </label>
        )}
      </div>

      {visibles.map((b) => (
        <BloqueVinculos
          key={`${b.relId}:${b.lado}`}
          bloque={b}
          ownerId={ownerId}
          // Se abre solo lo que ya tiene contenido: el resto se queda plegado
          // para que la lista siga siendo legible con 18 bloques.
          abiertoInicial={(conteo?.[`${b.relId}:${b.lado}`] ?? 0) > 0}
        />
      ))}
    </aside>
  );
}

function Cabecera() {
  return (
    <h2 className="flex items-center gap-2 text-sm font-medium text-fg">
      <Icon name="Network" size={15} className="text-accent" />
      Conexiones
    </h2>
  );
}

/** Versión compacta para cabeceras: sólo el número total. */
export function ContadorConexiones({ entidad, ownerId }: { entidad: string; ownerId: number }) {
  const [total, setTotal] = useState<number | null>(null);
  const meta = entityByKey(entidad);

  useEffect(() => {
    let vivo = true;
    resumenConexiones(entidad, ownerId)
      .then((r) => { if (vivo) setTotal(Object.values(r).reduce((a, b) => a + b, 0)); })
      .catch(() => { if (vivo) setTotal(null); });
    return () => { vivo = false; };
  }, [entidad, ownerId]);

  if (total === null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-fg-muted" title={`Conexiones de esta ${meta?.singular ?? "ficha"}`}>
      <Icon name="Network" size={12} />
      {total}
    </span>
  );
}
