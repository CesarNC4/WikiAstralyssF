import Link from "next/link";
import { ProseBlock } from "@/components/fichas/FichaShell";
import { StatTable, RatingGrid } from "@/components/entity/StatTable";
import { AbilityList } from "@/components/entity/AbilityList";
import { SongList } from "@/components/fichas/SongList";
import { Badge } from "@/components/entity/Badge";
import { EntityImage } from "@/components/media/EntityImage";
import { Icon } from "@/components/Icon";
import { FadeIn } from "@/components/motion/Motion";
import { Galeria } from "@/components/fichas/Galeria";
import { StatRadar } from "@/components/fichas/personaje/StatRadar";
import { RelacionesGraph, type RelNode } from "@/components/fichas/personaje/RelacionesGraph";
import { PerfilMagico } from "@/components/fichas/personaje/PerfilMagico";
import { getGaleria } from "@/lib/queries/galeria";
import { resolveMagiaLinks } from "@/lib/queries/magia";
import type { PersonajeFicha } from "@/lib/queries/fichas";
import type { Track } from "@/hooks/usePlayerStore";

/** Cuerpo de la ficha de personaje: hero cinematográfico + secciones (§ punto 2). */
export async function PersonajeFichaBody({ p }: { p: PersonajeFicha }) {
  const nombre = [p.nombre, p.surname].filter(Boolean).join(" ");
  const stats = p.estadisticas?.[0];

  const [galeria, magiaLinksMap] = await Promise.all([
    getGaleria("personajes", p.id).catch(() => []),
    resolveMagiaLinks([p.tipoMagiaPrincipal, p.magiaSecundaria]).catch(() => new Map<string, number>()),
  ]);
  const magiaLinks = Object.fromEntries(magiaLinksMap);

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

  const vinculos: RelNode[] = (p.relaciones ?? []).map((r) => ({
    key: String(r.idRr),
    nombre: r.relacionado
      ? [r.relacionado.nombre, r.relacionado.surname].filter(Boolean).join(" ")
      : r.nombreExterno ?? "Desconocido",
    tipo: r.tipoRelacion ?? r.subtipoRelacion,
    href: r.relacionado ? `/personajes/${r.relacionado.id}` : null,
  }));

  const keyFacts = [
    { label: "Edad", value: p.edad },
    { label: "Altura", value: p.altura ? `${p.altura} m` : null },
    { label: "Origen", value: p.lugarNacimiento },
    { label: "Ocupación", value: p.ocupacion },
    { label: "Familia", value: p.familia },
  ].filter((f) => f.value);

  return (
    <div>
      {/* Hero cinematográfico */}
      <div className="relative">
        <div className="relative h-60 w-full overflow-hidden md:h-80">
          <EntityImage src={p.bannerUrl ?? p.imagenUrl} alt={nombre} name={p.nombre} sizes="100vw" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-void/20" />
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_120%,rgba(139,123,255,0.25),transparent)]" />
          <div className="absolute left-4 top-4">
            <Link
              href="/personajes"
              className="inline-flex items-center gap-1.5 rounded-full border border-border-base bg-void/60 px-3 py-1.5 text-xs text-fg-secondary backdrop-blur hover:text-fg"
            >
              <Icon name="ChevronLeft" size={14} /> Personajes
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4">
          <div className="-mt-20 flex flex-col items-start gap-5 md:-mt-24 md:flex-row md:items-end">
            <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-3xl border-2 border-border-glow shadow-[var(--shadow-glow-primary)] md:h-44 md:w-44">
              <EntityImage src={p.imagenUrl} alt={nombre} name={p.nombre} sizes="176px" priority />
            </div>
            <FadeIn className="pb-2">
              {p.titulo && <p className="font-display text-sm uppercase tracking-[0.2em] text-primary-glow">{p.titulo}</p>}
              <h1 className="font-display text-4xl text-fg md:text-6xl">{nombre}</h1>
              {p.subtitulo && <p className="mt-1 text-fg-secondary">{p.subtitulo}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {p.rangoAventurero && <Badge tone="primary">{p.rangoAventurero}</Badge>}
                {p.ocupacion && <Badge>{p.ocupacion}</Badge>}
                {p.esInvocado && <Badge tone="accent">Invocado</Badge>}
                {p.genero && <Badge>{p.genero}</Badge>}
              </div>
            </FadeIn>
          </div>

          {keyFacts.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {keyFacts.map((f) => (
                <span key={f.label} className="rounded-xl border border-border-base bg-surface/60 px-3 py-1.5 text-xs">
                  <span className="text-fg-muted">{f.label}: </span>
                  <span className="text-fg">{f.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        {/* Perfil mágico */}
        <Section icon="Sparkles" title="Perfil mágico">
          <PerfilMagico
            valores={{
              tipoMagiaPrincipal: p.tipoMagiaPrincipal,
              magiaSecundaria: p.magiaSecundaria,
              nivelDeConsciencia: p.nivelDeConsciencia,
              circuitoForte: p.circuitoForte,
              essentia: p.essentia,
              zenithra: p.zenithra,
              bendicion: p.bendicion,
              segundoDespertar: p.segundoDespertar,
            }}
            magiaLinks={magiaLinks}
          />
          {p.debilidades && (
            <div className="mt-4">
              <ProseBlock title="Debilidades">{p.debilidades}</ProseBlock>
            </div>
          )}
        </Section>

        {/* Historia y personalidad */}
        {(p.historia || p.rasgosPersonalidad || p.motivacion || p.miedos || (p.eventos?.length ?? 0) > 0) && (
          <Section icon="ScrollText" title="Historia">
            <ProseBlock title="Historia">{p.historia}</ProseBlock>
            <ProseBlock title="Personalidad">{p.rasgosPersonalidad}</ProseBlock>
            <div className="grid gap-x-8 md:grid-cols-2">
              <ProseBlock title="Motivación">{p.motivacion}</ProseBlock>
              <ProseBlock title="Miedos">{p.miedos}</ProseBlock>
              <ProseBlock title="Filosofía">{p.filosofia}</ProseBlock>
              <ProseBlock title="Gustos">{p.gustos}</ProseBlock>
              <ProseBlock title="Disgustos">{p.disgustos}</ProseBlock>
            </div>
            {p.eventos && p.eventos.length > 0 && (
              <div className="mt-2">
                <h3 className="mb-3 font-display text-lg text-accent">Eventos clave</h3>
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
              </div>
            )}
            <SongList tracks={tracks} />
          </Section>
        )}

        {/* Atributos y combate */}
        {stats && (
          <Section icon="Activity" title="Atributos y combate">
            <div className="grid items-start gap-8 lg:grid-cols-2">
              {primary.length > 0 && <StatRadar stats={primary} max={primaryMax} />}
              <div>
                <StatTable title="Combate" rows={combat} max={combatMax} />
              </div>
            </div>
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
          </Section>
        )}

        {/* Habilidades */}
        {(p.habilidades?.length ?? 0) > 0 && (
          <Section icon="Swords" title="Habilidades">
            <AbilityList habilidades={p.habilidades ?? []} />
          </Section>
        )}

        {/* Relaciones */}
        {(vinculos.length > 0 ||
          (p.naciones?.length ?? 0) > 0 ||
          (p.razas?.length ?? 0) > 0 ||
          (p.organizaciones?.length ?? 0) > 0 ||
          (p.equipamiento?.length ?? 0) > 0) && (
          <Section icon="Network" title="Relaciones y vínculos">
            {vinculos.length > 0 && (
              <>
                <RelacionesGraph centro={nombre} vinculos={vinculos} />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {p.relaciones!.map((r) => (
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
              </>
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
                <div className="grid gap-2 sm:grid-cols-2">
                  {p.equipamiento.map((eq) => (
                    <div key={eq.idArma} className="rounded-xl border border-border-base bg-surface/40 p-3">
                      <p className="font-medium text-fg">{eq.nombre}</p>
                      {eq.descripcion && <p className="text-sm text-fg-secondary">{eq.descripcion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {galeria.length > 0 && <Galeria images={galeria} />}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-border-glow bg-surface text-primary">
          <Icon name={icon} size={16} />
        </span>
        <h2 className="font-display text-2xl text-fg">{title}</h2>
        <span className="ml-2 h-px flex-1 bg-gradient-to-r from-border-glow to-transparent" />
      </div>
      <div className="space-y-4">{children}</div>
    </section>
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
