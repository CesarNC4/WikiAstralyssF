import { redirect } from "next/navigation";

/** Personajes llega en la Fase 8; mientras, Universo abre en el calendario. */
export default function UniversoPage() {
  redirect("/admin/taller/universo/calendario");
}
