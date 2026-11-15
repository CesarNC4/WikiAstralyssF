"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useSearch } from "@/components/search/SearchProvider";
import { ENTITIES, NAV_GROUPS, type EntityGroup } from "@/lib/entities";
import { cn } from "@/lib/utils";

const ICONOS: Record<EntityGroup, string> = {
  personajes: "Users",
  mundo: "Globe2",
  lore: "ScrollText",
  musica: "Music",
  explorar: "Compass",
};

/** ¿La página actual es esta ruta o una ficha de ella? («/magia» no cuenta como «/mapa».) */
function enRuta(pathname: string, ruta: string) {
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

/**
 * Barra inferior del móvil (§8.1, §16): las mismas secciones que la barra de arriba en el
 * ordenador. Una sección con una sola página (Personajes, Música) lleva directo a ella; las demás
 * (Mundo, Lore, Explorar) abren una hoja encima de la barra con todas sus páginas. Antes eran
 * enlaces sueltos: «Mundo» solo llevaba a Naciones, y nada de Lore se alcanzaba desde el móvil
 * (decisión del autor, 2026-11-15). Inicio es el logo de arriba.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { open: abrirBuscador } = useSearch();
  // La hoja recuerda en qué página se abrió: al cambiar de página se cierra sola, también
  // con el botón «atrás» del móvil.
  const [hoja, setHoja] = useState<{ grupo: EntityGroup; en: string } | null>(null);
  const abierta = hoja && hoja.en === pathname ? NAV_GROUPS.find((g) => g.id === hoja.grupo) : undefined;
  const cerrar = () => setHoja(null);

  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && setHoja(null);
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierta]);

  const etiqueta = (grupo: EntityGroup, label: string, activa: boolean) => (
    <span className="flex flex-col items-center gap-0.5 py-2">
      <Icon name={ICONOS[grupo]} size={20} className={activa ? "text-primary" : "text-fg-muted"} />
      <span className={cn("text-[10px]", activa ? "text-primary" : "text-fg-muted")}>{label}</span>
    </span>
  );

  return (
    <>
      {/* El fondo oscuro, fuera de la barra: dentro, su `backdrop-blur` encogería un `fixed` a su tamaño. */}
      <AnimatePresence>
        {abierta && (
          <motion.div
            key="fondo"
            className="fixed inset-0 z-[46] bg-[var(--bg-overlay)] backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cerrar}
          />
        )}
      </AnimatePresence>

      <nav
        aria-label="Secciones"
        className={cn(
          "fixed inset-x-0 bottom-0 border-t border-border-base bg-void/90 backdrop-blur-xl md:hidden",
          // Con la hoja abierta, por encima del reproductor flotante (z-45).
          abierta ? "z-[47]" : "z-40",
        )}
      >
        <AnimatePresence>
          {abierta && (
            <motion.div
              key={abierta.id}
              id="hoja-seccion"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-x-2 bottom-full mb-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-border-glow bg-deep p-3 shadow-xl"
            >
              <p className="mb-2 px-1 text-xs uppercase tracking-wider text-fg-muted">{abierta.label}</p>
              <div className="grid grid-cols-2 gap-1">
                {abierta.keys.map((k) => {
                  const e = ENTITIES[k];
                  const aqui = enRuta(pathname, e.route);
                  return (
                    <Link
                      key={k}
                      href={e.route}
                      onClick={cerrar}
                      aria-current={aqui ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        aqui ? "bg-surface text-fg" : "text-fg-secondary hover:bg-surface hover:text-fg",
                      )}
                    >
                      <Icon name={e.icon} size={16} className={e.accent} />
                      {e.plural}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV_GROUPS.map((g) => {
            const activa = abierta ? abierta.id === g.id : g.keys.some((k) => enRuta(pathname, ENTITIES[k].route));
            return (
              <li key={g.id} className="flex-1">
                {g.keys.length === 1 ? (
                  <Link href={ENTITIES[g.keys[0]].route} onClick={cerrar} className="block w-full text-center">
                    {etiqueta(g.id, g.label, activa)}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHoja(abierta?.id === g.id ? null : { grupo: g.id, en: pathname })}
                    aria-expanded={abierta?.id === g.id}
                    aria-controls={abierta?.id === g.id ? "hoja-seccion" : undefined}
                    className="w-full"
                  >
                    {etiqueta(g.id, g.label, activa)}
                  </button>
                )}
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => {
                cerrar();
                abrirBuscador();
              }}
              className="w-full"
              aria-label="Buscar"
            >
              <span className="flex flex-col items-center gap-0.5 py-2">
                <Icon name="Search" size={20} className="text-fg-muted" />
                <span className="text-[10px] text-fg-muted">Buscar</span>
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
