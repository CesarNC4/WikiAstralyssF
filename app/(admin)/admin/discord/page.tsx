import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { discordAviso } from "@/db/schema";
import { assertAdmin } from "@/lib/actions/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { CanalesDiscord, type UltimoAviso } from "@/components/admin/CanalesDiscord";
import { canalesDelServidor, canalesPorDefecto, nombreDelServidor } from "@/lib/discord";
import { TIPOS_CON_AVISO } from "@/lib/discord-tipos";
import { entityByKey } from "@/lib/entities";
import { etiquetas } from "@/lib/relaciones/consultas";

export const dynamic = "force-dynamic";

/** Avisos a Discord: a qué canal va cada tipo de ficha (docs/arquitectura.md §14). */
export default async function DiscordPage() {
  await assertAdmin();
  const [canales, servidor, porDefecto, filas] = await Promise.all([
    canalesDelServidor(),
    nombreDelServidor(),
    canalesPorDefecto(),
    db.select().from(discordAviso).orderBy(desc(discordAviso.enviadoEn)).limit(15),
  ]);

  // El nombre de cada ficha de la que se avisó, una consulta por tipo.
  const porTipo = new Map<string, number[]>();
  for (const f of filas) if (f.clase !== "prueba") (porTipo.get(f.entidadTipo) ?? porTipo.set(f.entidadTipo, []).get(f.entidadTipo)!).push(f.entidadId);
  const nombres = new Map<string, string>();
  for (const [tipo, ids] of porTipo) {
    for (const [id, e] of await etiquetas(tipo, ids)) nombres.set(`${tipo}:${id}`, e.label);
  }
  const ultimos: UltimoAviso[] = filas.map((f) => ({
    id: f.id,
    clase: f.clase,
    ficha: f.clase === "prueba" ? null : `${entityByKey(f.entidadTipo)?.singular ?? f.entidadTipo} · ${nombres.get(`${f.entidadTipo}:${f.entidadId}`) ?? `#${f.entidadId}`}`,
    canal: f.canalId,
    nota: f.nota,
    cuando: f.enviadoEn.toISOString(),
  }));

  const tipos = TIPOS_CON_AVISO.map((t) => ({ ...t, etiqueta: entityByKey(t.tipo)?.plural ?? t.tipo }));

  return (
    <AdminShell title="Discord">
      <CanalesDiscord servidor={servidor} canales={canales} porDefecto={porDefecto} tipos={tipos} ultimos={ultimos} />
    </AdminShell>
  );
}
