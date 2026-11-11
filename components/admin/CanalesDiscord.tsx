"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/admin/Toast";
import { guardarCanalesPorDefecto, probarCanal } from "@/lib/actions/discord";
import { canalPropuesto } from "@/lib/discord-tipos";

interface Canal {
  id: string;
  nombre: string;
  categoria: string | null;
}

export interface UltimoAviso {
  id: number;
  clase: string;
  ficha: string | null;
  canal: string;
  nota: string | null;
  cuando: string;
}

const NINGUNO = "";
const selectCls = "w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm text-fg outline-none";

/** Las opciones de canal agrupadas por su categoría del servidor. */
export function OpcionesCanal({ canales }: { canales: Canal[] }) {
  const grupos = useMemo(() => {
    const m = new Map<string, Canal[]>();
    for (const c of canales) {
      const k = c.categoria ?? "Sin categoría";
      (m.get(k) ?? m.set(k, []).get(k)!).push(c);
    }
    return [...m];
  }, [canales]);
  return (
    <>
      {grupos.map(([cat, cs]) => (
        <optgroup key={cat} label={cat}>
          {cs.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** El canal por defecto de cada tipo de ficha, una prueba y los últimos avisos (/admin/discord). */
export function CanalesDiscord({
  servidor,
  canales,
  porDefecto,
  tipos,
  ultimos,
}: {
  servidor: string | null;
  canales: Canal[] | null;
  porDefecto: Record<string, string>;
  tipos: { tipo: string; canal: string; etiqueta: string }[];
  ultimos: UltimoAviso[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  // La primera vez, sin nada guardado, se propone el canal que se llama como el de la lista.
  const propuesta = Object.keys(porDefecto).length === 0;
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tipos.map((t) => [t.tipo, porDefecto[t.tipo] ?? (propuesta && canales ? canalPropuesto(canales, t.canal)?.id ?? NINGUNO : NINGUNO)]),
    ),
  );
  const [cambios, setCambios] = useState(propuesta);
  const [prueba, setPrueba] = useState<string>(() => canales?.[0]?.id ?? NINGUNO);

  if (!canales) {
    return (
      <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-fg">
        No se puede hablar con Discord. Comprueba que <code>DISCORD_BOT_TOKEN</code> y <code>DISCORD_SERVIDOR_ID</code> están bien y que
        el bot sigue en el servidor.
      </p>
    );
  }

  const nombreDe = new Map(canales.map((c) => [c.id, `#${c.nombre}`]));

  const guardar = () =>
    start(async () => {
      const mapa = Object.fromEntries(tipos.map((t) => [t.tipo, valores[t.tipo] || null]));
      const r = await guardarCanalesPorDefecto(mapa);
      if (!r.ok) return toast(r.error, "error");
      setCambios(false);
      toast("Canales guardados.", "success");
      router.refresh();
    });

  const probar = () => {
    if (!prueba) return;
    if (!confirm(`Se enviará un mensaje de prueba a ${nombreDe.get(prueba)}. Lo verán quienes tengan acceso a ese canal. ¿Seguir?`)) return;
    start(async () => {
      const r = await probarCanal(prueba);
      if (!r.ok) return toast(r.error, "error");
      toast("Prueba enviada: míralo en Discord.", "success");
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-2 text-sm text-fg-muted">
        <p>
          Servidor <span className="text-fg">{servidor ?? "—"}</span>. El bot puede avisar en <span className="text-fg">{canales.length}</span>{" "}
          canales.
        </p>
        <p>
          Cada ficha avisa en el canal de su tipo la primera vez que se publica. Al publicar desde su formulario se puede elegir otro canal o
          «No avisar», y al guardar una ficha ya publicada se puede avisar del cambio con una nota. Desde la ventana de propuestas y las tablas
          se usa este canal.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-accent">Canal de cada tipo de ficha</h2>
        {propuesta && (
          <p className="mb-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-fg">
            Aún no hay nada guardado: te propongo los canales que se llaman como los de la categoría WIKI. Revísalos y pulsa Guardar.
          </p>
        )}
        <div className="divide-y divide-border-base rounded-lg border border-border-base">
          {tipos.map((t) => (
            <label key={t.tipo} className="grid grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[180px_1fr]">
              <span className="text-sm text-fg">{t.etiqueta}</span>
              <select
                value={valores[t.tipo]}
                onChange={(e) => {
                  setValores((v) => ({ ...v, [t.tipo]: e.target.value }));
                  setCambios(true);
                }}
                className={selectCls}
              >
                <option value={NINGUNO}>— No avisar —</option>
                <OpcionesCanal canales={canales} />
              </select>
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={pending || !cambios}
            onClick={guardar}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-void transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-accent">Probar un canal</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={prueba} onChange={(e) => setPrueba(e.target.value)} className={selectCls}>
            <OpcionesCanal canales={canales} />
          </select>
          <button
            type="button"
            disabled={pending || !prueba}
            onClick={probar}
            className="shrink-0 rounded-lg border border-border-base px-4 py-2 text-sm text-fg hover:bg-surface disabled:opacity-60"
          >
            Enviar prueba
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-accent">Últimos avisos</h2>
        {ultimos.length === 0 ? (
          <p className="text-sm text-fg-muted">Todavía no se ha enviado ninguno.</p>
        ) : (
          <ul className="divide-y divide-border-base rounded-lg border border-border-base text-sm">
            {ultimos.map((u) => (
              <li key={u.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                <span className="text-fg-muted">{new Date(u.cuando).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="text-fg">{u.clase === "prueba" ? "🔔 Prueba" : `${u.clase === "cambio" ? "📝" : "✨"} ${u.ficha}`}</span>
                <span className="text-fg-muted">en {nombreDe.get(u.canal) ?? "un canal que ya no está"}</span>
                {u.nota && <span className="w-full text-fg-muted">«{u.nota}»</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
