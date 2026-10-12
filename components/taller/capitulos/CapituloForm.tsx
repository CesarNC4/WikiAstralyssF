"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { borrarCapitulo, cambiarPlantillaCapitulo, guardarCapitulo } from "@/lib/actions/taller";
import type { CapituloEditor, OpcionesCapitulo, PlantillaTaller } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";
import { botonCls, botonPrimarioCls, Campo, inputCls, SelectEstado, SelectId, SelectTexto } from "../ui";

/**
 * Datos propios de un capítulo (spec §3). Sirve a la edición rápida del panel
 * de Organizar (`compacto`) y a la pantalla propia del capítulo. El número no se
 * edita: lo pone el servidor según el orden y el tipo.
 */
export function CapituloForm({
  capitulo,
  opciones,
  plantillas,
  compacto = false,
}: {
  capitulo: CapituloEditor;
  opciones: OpcionesCapitulo;
  plantillas: PlantillaTaller[];
  compacto?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const c = capitulo;

  const [v, setV] = useState({
    titulo: c.titulo,
    libro: c.libro ?? "",
    tipo: c.tipo ?? "",
    tipoTemporal: c.tipoTemporal ?? "",
    marcoNarrativo: c.marcoNarrativo ?? "",
    narrador: c.narrador ?? "",
    narradorPersonajeId: c.narradorPersonajeId,
    narradorTipo: c.narradorTipo ?? "",
    paraleloACapituloId: c.paraleloACapituloId,
    descripcion: c.descripcion ?? "",
    discordUrl: c.discordUrl ?? "",
    notasPrivadas: c.notasPrivadas ?? "",
    estadoPublicacion: c.estadoPublicacion,
  });
  const [cambios, setCambios] = useState(false);
  const set = <K extends keyof typeof v>(k: K) => (val: (typeof v)[K]) => {
    setV((prev) => ({ ...prev, [k]: val }));
    setCambios(true);
  };

  useEffect(() => {
    if (!cambios) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [cambios]);

  const guardar = () =>
    start(async () => {
      const r = await guardarCapitulo(c.id, v);
      if (!r.ok) return toast(r.error, "error");
      setCambios(false);
      toast("Capítulo guardado.", "success");
      router.refresh();
    });

  const plantilla = plantillas.find((p) => p.id === c.plantillaId);
  const cambiarPlantilla = (nueva: number | null) => {
    if (nueva == null || nueva === c.plantillaId) return;
    const destino = plantillas.find((p) => p.id === nueva);
    const aviso = c.plantillaId
      ? `Al cambiar a «${destino?.nombre}», todos los actos del capítulo pasan a su primera fase. ¿Seguir?`
      : `Se asigna «${destino?.nombre}» y todos los actos del capítulo pasan a su primera fase. ¿Seguir?`;
    if (!confirm(aviso)) return;
    start(async () => {
      const r = await cambiarPlantillaCapitulo(c.id, nueva);
      if (!r.ok) return toast(r.error, "error");
      toast("Plantilla cambiada.", "success");
      router.refresh();
    });
  };

  const opcionesPersonajes = opciones.personajes.map((p) => ({ id: p.id, label: p.nombre }));
  const opcionesParalelo = opciones.capitulos.filter((x) => x.id !== c.id);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-sm text-accent">{c.numero}</span>
        {compacto && (
          <Link href={`/admin/taller/capitulos/${c.id}`} className="ml-auto text-xs text-accent hover:underline">
            Abrir pantalla del capítulo →
          </Link>
        )}
      </div>

      <Campo label="Título">
        <input value={v.titulo} onChange={(e) => set("titulo")(e.target.value)} className={cn(inputCls, "font-display text-lg")} />
      </Campo>

      <div className={cn("grid gap-3", compacto ? "grid-cols-2" : "grid-cols-4")}>
        <Campo label="Libro">
          <SelectTexto value={v.libro} onChange={set("libro")} opciones={opciones.libros} vacio="Sin libro" />
        </Campo>
        <Campo label="Tipo" hint={compacto ? undefined : "Prólogo, Interludio… no consumen número."}>
          <SelectTexto value={v.tipo} onChange={set("tipo")} opciones={opciones.tipos} />
        </Campo>
        <Campo label="Plantilla">
          <SelectId
            value={c.plantillaId}
            onChange={cambiarPlantilla}
            opciones={plantillas.map((p) => ({ id: p.id, label: p.nombre }))}
            vacio="— Sin plantilla —"
          />
          {!plantilla && <span className="mt-1 block text-xs text-warning">Todo capítulo necesita plantilla.</span>}
        </Campo>
        <Campo label="Publicación">
          <SelectEstado value={v.estadoPublicacion} onChange={set("estadoPublicacion")} />
        </Campo>
      </div>

      <Campo label="Intro" hint="La ficha pública añade debajo los resúmenes de sus actos.">
        <textarea value={v.descripcion} onChange={(e) => set("descripcion")(e.target.value)} rows={compacto ? 4 : 6} className={inputCls} />
      </Campo>

      {!compacto && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tipo temporal">
              <SelectTexto value={v.tipoTemporal} onChange={set("tipoTemporal")} opciones={opciones.tiposTemporales} />
            </Campo>
            <Campo label="Marco narrativo">
              <input value={v.marcoNarrativo} onChange={(e) => set("marcoNarrativo")(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Paralelo al capítulo">
              <SelectId value={v.paraleloACapituloId} onChange={set("paraleloACapituloId")} opciones={opcionesParalelo} />
            </Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Narrador (ficha)">
              <SelectId value={v.narradorPersonajeId} onChange={set("narradorPersonajeId")} opciones={opcionesPersonajes} />
            </Campo>
            <Campo label="Narrador (sin ficha)">
              <input value={v.narrador} onChange={(e) => set("narrador")(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Cómo narra">
              <SelectTexto value={v.narradorTipo} onChange={set("narradorTipo")} opciones={opciones.narradorTipos} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Enlace en Discord">
              <input value={v.discordUrl} onChange={(e) => set("discordUrl")(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Notas privadas" hint="No se publican nunca.">
              <textarea value={v.notasPrivadas} onChange={(e) => set("notasPrivadas")(e.target.value)} rows={2} className={inputCls} />
            </Campo>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 border-t border-border-base pt-3">
        <button
          type="button"
          onClick={() => {
            if (!confirm(`¿Mandar «${c.titulo}» a la papelera? Sus actos se quedan con él.`)) return;
            start(async () => {
              const r = await borrarCapitulo(c.id);
              if (!r.ok) return toast(r.error, "error");
              toast("Capítulo en la papelera.", "success");
              router.push("/admin/taller/capitulos");
            });
          }}
          className={cn(botonCls, "hover:text-error")}
        >
          <Icon name="Trash2" size={14} /> Papelera
        </button>
        {cambios && <span className="ml-auto text-xs text-warning">Sin guardar</span>}
        <button type="button" onClick={guardar} disabled={pending || !cambios} className={cn(botonPrimarioCls, !cambios && "ml-auto")}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
