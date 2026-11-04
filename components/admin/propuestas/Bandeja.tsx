"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { subInp } from "@/components/admin/blocks/shared";
import { useToast } from "@/components/admin/Toast";
import { AccordionSection } from "@/components/admin/ui";
import { SelectorFicha } from "@/components/admin/vinculos/SelectorFicha";
import { analizarPropuestas, aplicarFichaPropuesta, aplicarTextoSuelto } from "@/lib/actions/propuestas";
import { bloquePendiente, estaVacio, reemplazarBloque } from "@/lib/propuestas/archivo";
import { faltaEn, hashTexto, type Analisis, type DatoAnalizado, type EstadoFicha, type FichaAnalizada, type SueltoAnalizado } from "@/lib/propuestas/tipos";
import { cn } from "@/lib/utils";
import {
  borrarArchivo,
  carpetaRecordada,
  descargar,
  elegirCarpeta,
  escribirArchivo,
  hayCarpetas,
  leerArchivo,
  leerCarpeta,
  olvidarCarpeta,
  pedirPermiso,
  tienePermiso,
  type Carpeta,
} from "./carpeta";
import { FichaPropuesta } from "./FichaPropuesta";

/**
 * La bandeja de propuestas (docs/area-ia.md, Fase 5). Lee los archivos de
 * `lore/propuestas/` en el navegador, enseña cada ficha frente a lo que hay y aplica lo
 * que el autor decida. Lo aplicado se quita del archivo y el archivo vacío se borra: las
 * propuestas son de usar y tirar. Con un navegador sin acceso a carpetas se suben los
 * archivos y se descarga lo que queda.
 */

interface Archivo {
  nombre: string;
  texto: string;
  /** Se cambió aquí y aún no está en el disco (sin acceso a la carpeta). */
  pendiente?: boolean;
}

type Cambios = Record<string, Record<string, Partial<DatoAnalizado>>>;

interface Hecha {
  nombre: string;
  ruta: string | null;
  detalle: string;
}

export function Bandeja() {
  const toast = useToast();
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null);
  const [recordada, setRecordada] = useState<Carpeta | null>(null);
  const [conCarpetas, setConCarpetas] = useState(false);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const refArchivos = useRef<Archivo[]>([]);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [cambios, setCambios] = useState<Cambios>({});
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [estados, setEstados] = useState<Record<string, EstadoFicha | null>>({});
  const [destinos, setDestinos] = useState<Record<string, number | "crear">>({});
  const [fallos, setFallos] = useState<Record<string, Record<string, string>>>({});
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [hechas, setHechas] = useState<Hecha[]>([]);

  const ponerArchivos = useCallback((a: Archivo[]) => {
    refArchivos.current = a;
    setArchivos(a);
  }, []);

  const analizar = useCallback(
    async (lista: Archivo[], dest: Record<string, number | "crear">) => {
      setCargando(true);
      try {
        setAnalisis(await analizarPropuestas(lista.map(({ nombre, texto }) => ({ nombre, texto })), dest));
      } catch (e) {
        console.error(e);
        toast("No se pudieron analizar las propuestas.", "error");
      } finally {
        setCargando(false);
      }
    },
    [toast],
  );

  const abrir = useCallback(
    async (c: Carpeta) => {
      setCarpeta(c);
      setRecordada(null);
      const leidos = await leerCarpeta(c);
      ponerArchivos(leidos);
      await analizar(leidos, {});
    },
    [analizar, ponerArchivos],
  );

  // Si el navegador recuerda la carpeta y aún tiene permiso, se abre sola.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const soporta = hayCarpetas();
      if (vivo) setConCarpetas(soporta);
      if (!soporta) return;
      const c = await carpetaRecordada();
      if (!vivo || !c) return;
      if (await tienePermiso(c)) await abrir(c);
      else setRecordada(c);
    })().catch(() => toast("No se pudo abrir la carpeta recordada.", "error"));
    return () => {
      vivo = false;
    };
  }, [abrir, toast]);

  // Lo editado aquí no se guarda en ningún sitio hasta aplicarlo.
  useEffect(() => {
    if (Object.keys(cambios).length === 0) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cambios]);

  const elegir = async () => {
    try {
      const c = await elegirCarpeta();
      if (c) await abrir(c);
    } catch {
      toast("No se pudo abrir esa carpeta.", "error");
    }
  };

  const reabrir = async () => {
    if (!recordada) return;
    if (await pedirPermiso(recordada)) await abrir(recordada);
    else toast("Sin permiso no se puede leer la carpeta.", "error");
  };

  const subir = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const leidos = await Promise.all([...lista].map(async (f) => ({ nombre: f.name, texto: await f.text() })));
    // Un archivo con el mismo nombre sustituye al que había.
    const siguen = refArchivos.current.filter((a) => !leidos.some((l) => l.nombre === a.nombre));
    const todos = [...siguen, ...leidos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    ponerArchivos(todos);
    await analizar(todos, destinos);
  };

  const releer = async () => {
    if (carpeta) await abrir(carpeta);
    else await analizar(refArchivos.current, destinos);
  };

  const cerrarCarpeta = async () => {
    await olvidarCarpeta();
    setCarpeta(null);
    setRecordada(null);
    ponerArchivos([]);
    setAnalisis(null);
    setCambios({});
  };

  /** Cambia un bloque del archivo por otro (o lo quita). En la carpeta, sobre lo que haya en el disco. */
  const reescribir = useCallback(
    async (nombre: string, raw: string, nuevo: string | null): Promise<boolean> => {
      const propio = refArchivos.current.find((a) => a.nombre === nombre);
      if (!propio) return false;
      const base = carpeta ? ((await leerArchivo(carpeta, nombre)) ?? propio.texto) : propio.texto;
      const texto = reemplazarBloque(base, raw, nuevo);
      if (texto === null) {
        toast(`«${nombre}» cambió mientras tanto y no pude quitar la propuesta: bórrala a mano.`, "error");
        return false;
      }
      const vacio = estaVacio(texto);
      if (carpeta) {
        if (vacio) await borrarArchivo(carpeta, nombre);
        else await escribirArchivo(carpeta, nombre, texto);
      }
      ponerArchivos(
        vacio && carpeta
          ? refArchivos.current.filter((a) => a.nombre !== nombre)
          : refArchivos.current.map((a) => (a.nombre === nombre ? { ...a, texto, pendiente: !carpeta } : a)),
      );
      return true;
    },
    [carpeta, ponerArchivos, toast],
  );

  /** Los datos de una ficha con lo que el autor haya cambiado encima. */
  const datosDe = useCallback((f: FichaAnalizada): DatoAnalizado[] => f.datos.map((d) => ({ ...d, ...(cambios[f.clave]?.[d.clave] ?? {}) })), [cambios]);

  const nombreDe = useCallback((f: FichaAnalizada) => nombres[f.clave] ?? f.nombre, [nombres]);
  const estadoDe = useCallback((f: FichaAnalizada) => (f.clave in estados ? estados[f.clave] : f.estado), [estados]);

  const lista = useCallback(
    (f: FichaAnalizada, cal: Analisis["calendario"]) => !f.error && !f.ambigua && datosDe(f).every((d) => !faltaEn(d, cal)),
    [datosDe],
  );

  const aplicarUna = useCallback(
    async (f: FichaAnalizada): Promise<boolean> => {
      const datos = datosDe(f);
      const nombre = nombreDe(f);
      setOcupadas((o) => new Set(o).add(f.clave));
      try {
        const r = await aplicarFichaPropuesta({
          entidad: f.entidad,
          id: f.id,
          crearOtra: destinos[f.clave] === "crear",
          nombre,
          estado: estadoDe(f) ?? null,
          datos,
        });
        if (!r.ok || r.id == null) {
          toast(r.error ?? "No se pudo aplicar.", "error");
          return false;
        }
        const aplicados = new Set(r.aplicados);
        // Lo que se deja para luego, y lo que falló, se queda en el archivo.
        const pendientes = datos.filter((d) => d.raw && (!aplicados.has(d.clave) || r.fallidos[d.clave]));
        const cabecera = `## ${f.singular} #${r.id}: ${nombre} · cambios`;
        const nuevo = pendientes.length ? bloquePendiente(cabecera, pendientes) : null;
        await reescribir(f.archivo, f.raw, nuevo);
        setFallos((a) => ({ ...a, [f.clave]: r.fallidos, [hashTexto(`${f.archivo}\n${cabecera}`)]: r.fallidos }));
        const conFallos = Object.keys(r.fallidos).length;
        const ruta = f.rutaPanel ?? (f.entidad === "gremio" ? "/admin/gremio" : `/admin/${f.entidad}/${r.id}/editar`);
        setHechas((h) => [{ nombre, ruta: ["capitulos", "actos", "arcos", "hojas", "hilos"].includes(f.entidad) ? f.rutaPanel : ruta, detalle: `${f.singular} #${r.id}${pendientes.length ? ` · ${pendientes.length === 1 ? "1 dato pendiente" : `${pendientes.length} datos pendientes`} en el archivo` : ""}` }, ...h]);
        if (conFallos) toast(`${nombre}: ${conFallos === 1 ? "1 dato no se pudo aplicar" : `${conFallos} datos no se pudieron aplicar`}.`, "error");
        else if (r.error) toast(r.error, "error");
        else toast(`${nombre}: aplicada.`, "success");
        return true;
      } catch (e) {
        console.error(e);
        toast(`${nombre}: no se pudo aplicar.`, "error");
        return false;
      } finally {
        setOcupadas((o) => {
          const n = new Set(o);
          n.delete(f.clave);
          return n;
        });
      }
    },
    [datosDe, destinos, estadoDe, nombreDe, reescribir, toast],
  );

  const aplicarYReanalizar = async (f: FichaAnalizada) => {
    if (await aplicarUna(f)) await analizar(refArchivos.current, destinos);
  };

  const aplicarTodas = async () => {
    if (!analisis) return;
    const listas = analisis.fichas.filter((f) => lista(f, analisis.calendario));
    const publica = listas.filter((f) => estadoDe(f) === "publicado").length;
    const texto = `¿Aplicar ${listas.length === 1 ? "la ficha que está lista" : `las ${listas.length} fichas que están listas`}?${publica ? ` ${publica} quedarán publicadas para los jugadores, con su aviso en Discord si es la primera vez.` : ""}`;
    if (!window.confirm(texto)) return;
    for (const f of listas) await aplicarUna(f);
    await analizar(refArchivos.current, destinos);
  };

  const descartarFicha = async (f: FichaAnalizada) => {
    if (!window.confirm(`¿Descartar la propuesta «${nombreDe(f)}» entera? Se quita del archivo y no se aplica nada.`)) return;
    if (await reescribir(f.archivo, f.raw, null)) await analizar(refArchivos.current, destinos);
  };

  const quitarBloque = async (archivo: string, raw: string) => {
    if (await reescribir(archivo, raw, null)) await analizar(refArchivos.current, destinos);
  };

  const cambiarDestino = async (f: FichaAnalizada, d: number | "crear" | null) => {
    const siguiente = { ...destinos };
    if (d == null) delete siguiente[f.clave];
    else siguiente[f.clave] = d;
    setDestinos(siguiente);
    // Al cambiar de ficha, "lo que hay ahora" es otra cosa.
    setCambios((c) => {
      const resto = { ...c };
      delete resto[f.clave];
      return resto;
    });
    await analizar(refArchivos.current, siguiente);
  };

  const fichas = useMemo(() => analisis?.fichas ?? [], [analisis]);
  const porArchivo = useMemo(() => {
    const m = new Map<string, FichaAnalizada[]>();
    for (const f of fichas) m.set(f.archivo, [...(m.get(f.archivo) ?? []), f]);
    return m;
  }, [fichas]);
  const nombresArchivo = archivos.map((a) => a.nombre);
  const totalListas = analisis ? fichas.filter((f) => lista(f, analisis.calendario)).length : 0;
  const hayAlgo = fichas.length > 0 || (analisis?.sueltos.length ?? 0) > 0 || (analisis?.raros.length ?? 0) > 0;
  const pendientesDisco = archivos.filter((a) => a.pendiente);

  return (
    <div className="space-y-6 pb-16">
      <section className="space-y-3 rounded-2xl border border-border-base bg-surface/40 p-4">
        {carpeta ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Icon name="FolderOpen" size={16} className="text-accent" />
            <span className="text-fg">{carpeta.name}</span>
            <span className="text-fg-muted">{archivos.length === 1 ? "1 archivo" : `${archivos.length} archivos`}</span>
            {carpeta.name !== "propuestas" && <span className="text-xs text-warning">¿Es la carpeta correcta? Debería ser lore/propuestas.</span>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button type="button" onClick={releer} disabled={cargando} className="rounded-lg border border-border-base px-3 py-1.5 text-xs text-fg-secondary hover:text-fg disabled:opacity-40">
                Volver a leer
              </button>
              <button type="button" onClick={cerrarCarpeta} className="rounded-lg border border-border-base px-3 py-1.5 text-xs text-fg-muted hover:text-fg">
                Olvidar la carpeta
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-fg-secondary">
              Las propuestas viven en <code className="text-fg">lore/propuestas/</code>, en tu equipo. Se leen aquí y no se guardan en ningún sitio: solo pasa a la wiki lo que apliques.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {recordada && (
                <button type="button" onClick={reabrir} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-void">
                  <Icon name="FolderOpen" size={14} /> Abrir «{recordada.name}»
                </button>
              )}
              {conCarpetas && (
                <button type="button" onClick={elegir} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm", recordada ? "border border-border-base text-fg-secondary hover:text-fg" : "bg-primary font-medium text-void")}>
                  <Icon name="FolderOpen" size={14} /> Elegir la carpeta
                </button>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-secondary hover:text-fg">
                <Icon name="Upload" size={14} /> Subir archivos
                <input type="file" accept=".md,text/markdown" multiple className="sr-only" onChange={(e) => { void subir(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            {!conCarpetas && <p className="text-xs text-fg-muted">Este navegador no da acceso a carpetas: al terminar, descarga lo que queda y sustituye tu archivo. En Chrome o Edge se hace solo.</p>}
          </>
        )}
        {cargando && <p className="text-xs text-fg-muted">Analizando…</p>}
      </section>

      {pendientesDisco.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-warning/40 bg-warning/5 p-4">
          <p className="text-sm text-fg-secondary">Lo aplicado solo se ha quitado aquí. Descarga lo que queda y sustituye tu archivo:</p>
          <div className="flex flex-wrap gap-2">
            {pendientesDisco.map((a) => (
              <button key={a.nombre} type="button" onClick={() => descargar(a.nombre, a.texto)} className="inline-flex items-center gap-1.5 rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-secondary hover:text-fg">
                <Icon name="Download" size={14} /> {a.nombre}{estaVacio(a.texto) ? " (vacío: puedes borrarlo)" : ""}
              </button>
            ))}
          </div>
        </section>
      )}

      {analisis && !hayAlgo && !cargando && (
        <p className="rounded-2xl border border-border-base bg-surface/40 p-6 text-center text-sm text-fg-muted">
          {archivos.length ? "No hay nada pendiente en estos archivos." : "No hay propuestas pendientes."}
        </p>
      )}

      {totalListas > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={aplicarTodas} disabled={ocupadas.size > 0 || cargando} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-void disabled:opacity-40">
            Aplicar las {totalListas} listas
          </button>
          <span className="text-xs text-fg-muted">Cada una con lo que hayas decidido en ella; las que tengan algo por resolver se quedan.</span>
        </div>
      )}

      {analisis &&
        nombresArchivo.map((nombre) => {
          const delArchivo = porArchivo.get(nombre) ?? [];
          const sueltos = analisis.sueltos.filter((s) => s.archivo === nombre);
          const raros = analisis.raros.filter((r) => r.archivo === nombre);
          if (!delArchivo.length && !sueltos.length && !raros.length) return null;
          return (
            <section key={nombre} className="space-y-2">
              <h2 className="font-display text-base text-fg">{nombre}</h2>
              {delArchivo.map((f) => (
                <FichaPropuesta
                  key={f.clave}
                  ficha={{ ...f, nombre: nombreDe(f), estado: estadoDe(f) ?? null }}
                  datos={datosDe(f)}
                  cal={analisis.calendario}
                  catalogos={analisis.catalogos}
                  fallos={fallos[f.clave] ?? {}}
                  destino={destinos[f.clave]}
                  ocupada={ocupadas.has(f.clave)}
                  onDato={(clave, p) => setCambios((c) => ({ ...c, [f.clave]: { ...c[f.clave], [clave]: { ...c[f.clave]?.[clave], ...p } } }))}
                  onEstado={(e) => setEstados((x) => ({ ...x, [f.clave]: e }))}
                  onNombre={(n) => setNombres((x) => ({ ...x, [f.clave]: n }))}
                  onDestino={(d) => void cambiarDestino(f, d)}
                  onAplicar={() => void aplicarYReanalizar(f)}
                  onDescartar={() => void descartarFicha(f)}
                />
              ))}
              {sueltos.map((s) => (
                <Suelto key={s.clave} suelto={s} onHecho={() => void quitarBloque(s.archivo, s.raw)} />
              ))}
              {raros.map((r) => (
                <div key={r.clave} className="rounded-2xl border border-warning/40 bg-warning/5 p-4">
                  <p className="text-sm text-warning">{r.motivo}</p>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border-base bg-deep/40 p-2 text-xs text-fg-secondary">{r.raw}</pre>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-fg-muted">Corrígelo en el archivo y vuelve a leer, o:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("¿Quitar este bloque del archivo?")) void quitarBloque(r.archivo, r.raw);
                      }}
                      className="rounded-lg border border-border-base px-2 py-1 text-xs text-fg-muted hover:border-error hover:text-error"
                    >
                      Quitarlo
                    </button>
                  </div>
                </div>
              ))}
            </section>
          );
        })}

      {hechas.length > 0 && (
        <section className="rounded-2xl border border-border-base bg-surface/30 p-4">
          <h2 className="mb-2 font-display text-sm text-accent">Aplicadas ahora</h2>
          <ul className="space-y-1 text-sm">
            {hechas.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Icon name="Check" size={13} className="text-success" />
                {h.ruta ? <Link href={h.ruta} target="_blank" className="text-fg hover:text-accent">{h.nombre}</Link> : <span className="text-fg">{h.nombre}</span>}
                <span className="text-xs text-fg-muted">{h.detalle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Lo que no es una ficha: el autor decide si va a una hoja de trama, a unas notas o a la basura. */
function Suelto({ suelto, onHecho }: { suelto: SueltoAnalizado; onHecho: () => void }) {
  const toast = useToast();
  const [titulo, setTitulo] = useState(suelto.titulo);
  const [texto, setTexto] = useState(suelto.texto);
  /** Qué se está eligiendo: el arco de la hoja nueva, o la ficha que recibe la nota. */
  const [buscando, setBuscando] = useState<"arco" | "ficha" | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (destino: Parameters<typeof aplicarTextoSuelto>[0]) => {
    setOcupado(true);
    const r = await aplicarTextoSuelto(destino);
    setOcupado(false);
    if (!r.ok) {
      toast(r.error, "error");
      return;
    }
    toast("Guardado.", "success");
    onHecho();
  };

  return (
    <AccordionSection title={suelto.titulo} subtitle="Suelto" defaultOpen={false}>
      <div className="space-y-3">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título" className={cn(subInp, "w-full")} />
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto" rows={Math.min(12, texto.split("\n").length + 2)} className={cn(subInp, "w-full")} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={ocupado} onClick={() => setBuscando(buscando === "arco" ? null : "arco")} className="rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-secondary hover:text-fg disabled:opacity-40">
            A una hoja de trama nueva
          </button>
          <button type="button" disabled={ocupado} onClick={() => setBuscando(buscando === "ficha" ? null : "ficha")} className="rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-secondary hover:text-fg disabled:opacity-40">
            A las notas de una ficha
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              if (window.confirm("¿Descartar este texto? Se quita del archivo.")) onHecho();
            }}
            className="ml-auto rounded-lg border border-border-base px-3 py-1.5 text-sm text-fg-muted hover:border-error hover:text-error disabled:opacity-40"
          >
            Descartar
          </button>
        </div>
        {buscando && (
          <div>
            <p className="mb-1 text-xs text-fg-muted">{buscando === "arco" ? "Toda hoja de trama va en un arco: elige cuál." : "Elige la ficha."}</p>
            <SelectorFicha
              key={buscando}
              entidad={buscando === "arco" ? "arcos" : "*"}
              yaVinculados={[]}
              autoFocus
              onCerrar={() => setBuscando(null)}
              onElegir={async (fichas) => {
                const f = fichas[0];
                if (!f) return;
                await enviar(buscando === "arco" ? { tipo: "hoja", arcoId: f.id, titulo, texto } : { tipo: "nota", entidad: f.entidad, id: f.id, titulo, texto });
              }}
            />
          </div>
        )}
      </div>
    </AccordionSection>
  );
}
