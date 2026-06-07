import Link from "next/link";
import { FichaShell, ProseBlock, FieldGrid } from "@/components/fichas/FichaShell";
import { Tabs, type TabDef } from "@/components/fichas/Tabs";
import { StatTable, RatingGrid } from "@/components/entity/StatTable";
import { AbilityList } from "@/components/entity/AbilityList";
import { SongList } from "@/components/fichas/SongList";
import { Badge } from "@/components/entity/Badge";
import { EntityImage } from "@/components/media/EntityImage";
import type { PersonajeFicha } from "@/lib/queries/fichas";
import type { Track } from "@/hooks/usePlayerStore";

/** Cuerpo de la ficha de personaje (compartido por la página pública y el preview del admin). */
export function PersonajeFichaBody({ p }: { p: PersonajeFicha }) {
  const nombre = [p.nombre, p.surname].filter(Boolean).join(" ");
  const stats = p.estadisticas?.[0];

  const tracks: Track[] = (p.canciones ?? [])
    .filter((c) => c.cancion)
    .map((c) => ({
      id: c.cancion!.id,
      titulo: c.cancion!.titulo,
      artista: c.cancion!.artista,
      url: c.cancion!.url,
      tipoFuente: c.cancion!.tipoFuente,
      imagenUrl: c.cancion!.imagenUrl ?? p.imagenUrl,
      contexto: c.contexto,
    }));

  const historia = (
    <div>
      <ProseBlock title="Historia">{p.historia}</ProseBlock>
      <ProseBlock title="Personalidad">{p.rasgosPersonalidad}</ProseBlock>
      <div className="grid gap-x-8 md:grid-cols-2">
        <ProseBlock title="Motivación">{p.motivacion}</ProseBlock>
        <ProseBlock title="Miedos">{p.miedos}</ProseBlock>
        <ProseBlock title="Filosofía">{p.filosofia}</ProseBlock>
        <ProseBlock title="Debilidades">{p.debilidades}</ProseBlock>
        <ProseBlock title="Gustos">{p.gustos}</ProseBlock>
        <ProseBlock title="Disgustos">{p.disgustos}</ProseBlock>
      </div>
      {p.eventos && p.eventos.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-3 font-display text-xl text-accent">Eventos clave</h2>
          <ol className="relative space-y-4 border-l border-border-glow pl-5">
            {p.eventos.map((e) => (
              <li key={e.idEvento} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                {e.fecha && <p className="font-mono text-xs text-fg-muted">{e.fecha}</p>}
                <p className="font-medium text-fg">{e.titulo}</p>
                {e.descripcion && <p className="text-sm text-fg-secondary">{e.descripcion}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      <SongList tracks={tracks} />
    </div>
  );

  const primary = stats
    ? [
        { label: "Fuerza", value: stats.fuerza },
        { label: "Destreza", value: stats.destreza },
        { label: "Constitución", value: stats.constitucion },
        { label: "Inteligencia", value: stats.inteligencia },
        { label: "Sabiduría", value: stats.sabiduria },
        { label: "Carisma", value: stats.carisma },
      ]
    : [];
  const primaryMax = Math.max(20, ...primary.map((st) => st.value ?? 0));
  const combat = stats
    ? [
        { label: "Ataque físico", value: stats.ataqueFisico },
        { label: "Ataque mágico", value: stats.ataqueMagico },
        { label: "Defensa física", value: stats.defensaFisica },
        { label: "Defensa mágica", value: stats.defensaMagica },
        { label: "Velocidad", value: stats.velocidad },
        { label: "Reacción", value: stats.capacidadDeReaccion },
        { label: "MP máx", value: stats.mpMax },
      ]
    : [];
  const combatMax = Math.max(100, ...combat.map((st) => st.value ?? 0));

  const statsTab = (
    <div>
      <FieldGrid
        fields={[
          { label: "Magia principal", value: p.tipoMagiaPrincipal },
          { label: "Magia secundaria", value: p.magiaSecundaria },
          { label: "Nivel de consciencia", value: p.nivelDeConsciencia },
          { label: "Circuito Forte", value: p.circuitoForte },
          { label: "Essentia", value: p.essentia },
          { label: "Zenithra", value: p.zenithra },
          { label: "Bendición", value: p.bendicion },
          { label: "Segundo despertar", value: p.segundoDespertar },
        ]}
      />
      {!stats && <p className="text-fg-muted">Sin estadísticas registradas.</p>}
      <StatTable title="Atributos" rows={primary} max={primaryMax} />
      <StatTable title="Combate" rows={combat} max={combatMax} />
      {stats && (
        <RatingGrid
          items={[
            { label: "C. a cuerpo", value: stats.rangoCuerpoACuerpo },
            { label: "Distancia", value: stats.rangoDistancia },
            { label: "Daño mágico", value: stats.danoMagico },
            { label: "Defensa", value: stats.defensa },
            { label: "Apoyo", value: stats.apoyo },
            { label: "Movilidad", value: stats.movilidad },
            { label: "Control masas", value: stats.controlDeMasas },
          ]}
        />
      )}
    </div>
  );

  const habilidadesTab = <AbilityList habilidades={p.habilidades ?? []} />;

  const relacionesTab = (
    <div className="space-y-6">
      {p.relaciones && p.relaciones.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-lg text-secondary">Vínculos</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.relaciones.map((r) => (
              <div key={r.idRr} className="flex items-center gap-3 rounded-xl border border-border-base bg-surface/40 p-3">
                {r.relacionado ? (
                  <Link href={`/personajes/${r.relacionado.id}`} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                    <EntityImage src={r.relacionado.imagenUrl} alt={r.relacionado.nombre} name={r.relacionado.nombre} sizes="48px" />
                  </Link>
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-deep text-fg-muted">?</div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">
                    {r.relacionado
                      ? [r.relacionado.nombre, r.relacionado.surname].filter(Boolean).join(" ")
                      : r.nombreExterno ?? "Desconocido"}
                  </p>
                  <p className="text-xs text-primary-glow">{r.tipoRelacion ?? r.subtipoRelacion}</p>
                  {r.descripcion && <p className="truncate text-xs text-fg-muted">{r.descripcion}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Memberships
        title="Naciones"
        items={(p.naciones ?? []).map((n) => ({
          id: n.nacion?.id,
          nombre: n.nacion?.nombre,
          img: n.nacion?.imagenUrl,
          nota: n.tipo,
          href: n.nacion ? `/naciones/${n.nacion.id}` : undefined,
        }))}
      />
      <Memberships
        title="Razas"
        items={(p.razas ?? []).map((r) => ({
          id: r.raza?.id,
          nombre: r.raza?.nombre,
          img: r.raza?.imagenUrl,
          nota: r.esMixta ? "Mixta" : null,
          href: r.raza ? `/razas/${r.raza.id}` : undefined,
        }))}
      />
      <Memberships
        title="Organizaciones"
        items={(p.organizaciones ?? []).map((o) => ({
          id: o.organizacion?.id,
          nombre: o.organizacion?.nombre,
          img: o.organizacion?.imagenUrl,
          nota: o.rol,
          href: o.organizacion ? `/organizaciones/${o.organizacion.id}` : undefined,
        }))}
      />

      {p.equipamiento && p.equipamiento.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-lg text-secondary">Equipamiento</h3>
          {p.equipamiento.map((eq) => (
            <div key={eq.idArma} className="mb-2 rounded-xl border border-border-base bg-surface/40 p-3">
              <p className="font-medium text-fg">{eq.nombre}</p>
              {eq.descripcion && <p className="text-sm text-fg-secondary">{eq.descripcion}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const tabs: TabDef[] = [
    { id: "historia", label: "Historia", content: historia },
    { id: "stats", label: "Stats", content: statsTab },
    { id: "habilidades", label: "Habilidades", content: habilidadesTab },
    { id: "relaciones", label: "Relaciones", content: relacionesTab },
  ];

  return (
    <FichaShell
      banner={p.bannerUrl}
      imagen={p.imagenUrl}
      titulo={nombre}
      subtitulo={p.subtitulo ?? p.titulo}
      nombre={p.nombre}
      backHref="/personajes"
      backLabel="Personajes"
      galeriaTipo="personajes"
      galeriaId={p.id}
      badges={
        <>
          {p.rangoAventurero && <Badge tone="primary">{p.rangoAventurero}</Badge>}
          {p.ocupacion && <Badge>{p.ocupacion}</Badge>}
          {p.esInvocado && <Badge tone="accent">Invocado</Badge>}
          {p.genero && <Badge>{p.genero}</Badge>}
        </>
      }
    >
      <FieldGrid
        fields={[
          { label: "Edad", value: p.edad },
          { label: "Altura", value: p.altura ? `${p.altura} m` : null },
          { label: "Origen", value: p.lugarNacimiento },
          { label: "Ocupación", value: p.ocupacion },
          { label: "Familia", value: p.familia },
          { label: "Título", value: p.titulo },
        ]}
      />
      <Tabs tabs={tabs} />
    </FichaShell>
  );
}

function Memberships({
  title,
  items,
}: {
  title: string;
  items: { id?: number; nombre?: string | null; img?: string | null; nota?: string | null; href?: string }[];
}) {
  const valid = items.filter((i) => i.nombre);
  if (valid.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 font-display text-lg text-secondary">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {valid.map((i, idx) => {
          const inner = (
            <div className="flex items-center gap-2 rounded-xl border border-border-base bg-surface/40 p-2 pr-4">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                <EntityImage src={i.img} alt={i.nombre ?? ""} name={i.nombre} sizes="36px" />
              </div>
              <div>
                <p className="text-sm text-fg">{i.nombre}</p>
                {i.nota && <p className="text-xs text-fg-muted">{i.nota}</p>}
              </div>
            </div>
          );
          return i.href ? (
            <Link key={idx} href={i.href}>
              {inner}
            </Link>
          ) : (
            <div key={idx}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
