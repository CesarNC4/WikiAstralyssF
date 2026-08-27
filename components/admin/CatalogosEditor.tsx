"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { TextInput } from "@/components/admin/fields";
import {
  borrarOpcion,
  crearOpcion,
  listarCatalogo,
  renombrarOpcion,
  reordenarOpciones,
  type OpcionFila,
} from "@/lib/actions/catalogos";

/**
 * Editor de los catálogos: las listas que alimentan todos los desplegables.
 *
 * Hasta ahora la fuente de verdad era un archivo de código y sincronizarlo
 * pedía terminal y un seed en modo espejo. Con esto se añade una opción sin
 * desplegar, y renombrar arrastra el valor en las fichas que lo usaban — que es
 * la parte que de verdad importa: sin ese arrastre, renombrar dejaría los
 * desplegables en blanco en cada ficha afectada.
 */

export interface CampoResumen {
  campo: string;
  opciones: number;
  grupos: number;
  /** Fichas que leen de este catálogo, para explicar a qué afecta un cambio. */
  usos: string[];
  /** Etiqueta legible; los catálogos compartidos la llevan explicada. */
  titulo: string;
  descripcion?: string;
}

export function CatalogosEditor({ campos }: { campos: CampoResumen[] }) {
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-border-glow/60 bg-deep/40 px-4 py-3 text-sm text-fg-secondary">
        Estas listas son las que ves en los desplegables de todas las fichas. Lo que edites aquí se
        aplica al instante en el panel y en la web. Renombrar una opción arrastra el valor en las
        fichas que la usaban; borrarla las deja con el campo vacío.
      </p>
      {campos.map((c) => (
        <CampoBloque key={c.campo} resumen={c} />
      ))}
    </div>
  );
}

function CampoBloque({ resumen }: { resumen: CampoResumen }) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<OpcionFila[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [pending, start] = useTransition();

  /**
   * Carga bajo demanda al abrir: con sesenta catálogos, traerlos todos de golpe
   * serían miles de filas para mirar una. La carga va en el manejador y no en un
   * efecto, que en React 19 avisa de cambiar estado durante el render.
   */
  const alternar = (v: boolean) => {
    setAbierto(v);
    if (!v || filas || cargando) return;
    setCargando(true);
    void listarCatalogo(resumen.campo)
      .then(setFilas)
      .catch(() => toast("No se pudo cargar el catálogo.", "error"))
      .finally(() => setCargando(false));
  };

  const recargar = async () => setFilas(await listarCatalogo(resumen.campo));

  const anadir = () => {
    const v = nuevo.trim();
    if (!v) return;
    start(async () => {
      await crearOpcion(resumen.campo, v, nuevoGrupo.trim() || null);
      setNuevo("");
      await recargar();
      toast(`«${v}» añadida.`, "success");
    });
  };

  const renombrar = (fila: OpcionFila, valor: string) => {
    const v = valor.trim();
    if (!v || v === fila.valor) return;
    start(async () => {
      const { fichas } = await renombrarOpcion(fila.id, v);
      await recargar();
      toast(
        fichas > 0 ? `Renombrada. ${fichas} ficha(s) actualizada(s).` : "Renombrada.",
        "success",
      );
    });
  };

  const borrar = (fila: OpcionFila) => {
    start(async () => {
      const { fichas } = await borrarOpcion(fila.id);
      await recargar();
      toast(
        fichas > 0
          ? `Borrada. ${fichas} ficha(s) se han quedado con el campo vacío.`
          : "Borrada.",
        fichas > 0 ? "info" : "success",
      );
    });
  };

  const mover = (i: number, delta: number) => {
    if (!filas) return;
    const j = i + delta;
    if (j < 0 || j >= filas.length) return;
    const copia = [...filas];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setFilas(copia);
    start(async () => {
      await reordenarOpciones(copia.map((f) => f.id));
    });
  };

  return (
    <AccordionSection
      title={resumen.titulo}
      subtitle={`${resumen.opciones} opciones${resumen.grupos > 1 ? ` · ${resumen.grupos} grupos` : ""}`}
      open={abierto}
      onOpenChange={alternar}
    >
        <div className="space-y-3">
          {resumen.descripcion && <p className="text-xs text-fg-muted">{resumen.descripcion}</p>}
          {resumen.usos.length > 0 && (
            <p className="text-xs text-fg-muted">
              <Icon name="Link2" size={11} className="mr-1 inline" />
              Lo usan: {resumen.usos.join(", ")}
            </p>
          )}

          {cargando && <p className="text-sm text-fg-muted">Cargando…</p>}

          {filas && (
            <ul className="space-y-1">
              {filas.map((f, i) => (
                <li key={f.id} className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-right text-xs text-fg-muted">{i + 1}</span>
                  {f.grupo && (
                    <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fg-muted">
                      {f.grupo}
                    </span>
                  )}
                  <input
                    defaultValue={f.valor}
                    onBlur={(e) => renombrar(f, e.target.value)}
                    className="w-full rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-border-glow"
                  />
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    className="rounded px-1 text-fg-muted hover:text-fg"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    className="rounded px-1 text-fg-muted hover:text-fg"
                    title="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(f)}
                    className="rounded px-1 text-fg-muted hover:text-error"
                    title="Borrar"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {filas.length === 0 && <li className="text-sm text-fg-muted">Todavía no hay opciones.</li>}
            </ul>
          )}

          {filas && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border-base pt-3">
              <div className="min-w-40 flex-1">
                <TextInput value={nuevo} onChange={setNuevo} placeholder="Nueva opción…" />
              </div>
              {resumen.grupos > 1 && (
                <div className="w-40">
                  <TextInput value={nuevoGrupo} onChange={setNuevoGrupo} placeholder="Grupo" />
                </div>
              )}
              <button
                type="button"
                onClick={anadir}
                disabled={pending || !nuevo.trim()}
                className="rounded-lg border border-border-glow px-3 py-2 text-sm text-accent hover:bg-surface disabled:opacity-40"
              >
                Añadir
              </button>
            </div>
          )}
        </div>
    </AccordionSection>
  );
}
