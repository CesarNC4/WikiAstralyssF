"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/admin/Toast";
import { moverTramaAPapelera } from "@/lib/actions/taller";
import { cn } from "@/lib/utils";
import { botonCls } from "./ui";

/** Manda a la papelera del taller el arco, la hoja o el hilo que se está editando. */
export function BotonPapeleraTrama({ tipo, id, nombre }: { tipo: "arcos" | "hojas" | "hilos"; id: number; nombre: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Mandar «${nombre}» a la papelera?`)) return;
        start(async () => {
          const r = await moverTramaAPapelera(tipo, id);
          if (!r.ok) return toast(r.error, "error");
          toast("Movido a la papelera.", "success");
          router.push(`/admin/taller/trama?vista=${tipo}`);
          router.refresh();
        });
      }}
      className={cn(botonCls, "hover:text-error")}
    >
      <Icon name="Trash2" size={14} /> Papelera
    </button>
  );
}
