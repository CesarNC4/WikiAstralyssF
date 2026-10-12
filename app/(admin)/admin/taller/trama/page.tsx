import Link from "next/link";
import { assertAdmin } from "@/lib/actions/auth";
import { Icon } from "@/components/Icon";
import { TallerCabecera } from "@/components/taller/TallerShell";
import { getTramaIndice } from "@/lib/queries/taller";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VISTAS = [
  { clave: "arcos", label: "Arcos" },
  { clave: "hojas", label: "Hojas de trama" },
  { clave: "hilos", label: "Hilos" },
] as const;

type Vista = (typeof VISTAS)[number]["clave"];

/**
 * Trama (spec §8): arcos, hojas de trama e hilos, con los mismos datos que
 * tenían en el panel. Las hojas y los hilos no se publican nunca: guardan giros
 * y notas de autor.
 */
export default async function TramaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  await assertAdmin();
  const { vista: v } = await searchParams;
  const vista: Vista = VISTAS.some((x) => x.clave === v) ? (v as Vista) : "arcos";
  const t = await getTramaIndice();
  const arcoPorId = new Map(t.arcos.map((a) => [a.id, a]));

  return (
    <>
      <TallerCabecera titulo="Trama">
        {VISTAS.map((x) => (
          <Link
            key={x.clave}
            href={`/admin/taller/trama?vista=${x.clave}`}
            className={cn("rounded-lg px-3 py-1.5 text-sm", vista === x.clave ? "bg-surface text-fg" : "text-fg-muted hover:text-fg")}
          >
            {x.label}
          </Link>
        ))}
        <Link
          href={`/admin/taller/trama/${vista}/nuevo`}
          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-border-base px-3 py-1.5 text-xs text-fg-secondary hover:border-border-glow hover:text-fg"
        >
          <Icon name="Plus" size={14} /> Nuevo
        </Link>
      </TallerCabecera>

      <div className="mx-auto max-w-4xl space-y-2 px-6 py-5">
        {vista === "arcos" &&
          (t.arcos.length ? (
            t.arcos.map((a) => (
              <Fila key={a.id} href={`/admin/taller/trama/arcos/${a.id}`} color={a.color} titulo={a.nombre} detalle={[a.libro, a.tipo, a.estadoPublicacion]}>
                <span className="text-xs text-fg-muted">
                  {t.hojas.filter((h) => h.arcoId === a.id).length} hojas · {t.hilos.filter((h) => h.arcoId === a.id).length} hilos
                </span>
              </Fila>
            ))
          ) : (
            <Vacio />
          ))}

        {vista === "hojas" &&
          (t.hojas.length ? (
            t.hojas.map((h) => {
              const arco = h.arcoId != null ? arcoPorId.get(h.arcoId) : undefined;
              return (
                <Fila
                  key={h.id}
                  href={`/admin/taller/trama/hojas/${h.id}`}
                  color={arco?.color ?? null}
                  titulo={h.titulo}
                  detalle={[arco?.nombre, h.capitulo, h.acto, h.estado]}
                />
              );
            })
          ) : (
            <Vacio />
          ))}

        {vista === "hilos" &&
          (t.hilos.length ? (
            t.hilos.map((h) => {
              const arco = h.arcoId != null ? arcoPorId.get(h.arcoId) : undefined;
              return (
                <Fila key={h.id} href={`/admin/taller/trama/hilos/${h.id}`} color={arco?.color ?? null} titulo={h.nombre} detalle={[arco?.nombre, h.estado]}>
                  <span className={cn("text-xs", h.cerrado ? "text-success" : h.abierto ? "text-warning" : "text-fg-muted")}>
                    {h.cerrado ? "Cerrado" : h.abierto ? "Abierto" : "Sin abrir"}
                  </span>
                </Fila>
              );
            })
          ) : (
            <Vacio />
          ))}
      </div>
    </>
  );
}

function Fila({
  href,
  color,
  titulo,
  detalle,
  children,
}: {
  href: string;
  color: string | null;
  titulo: string;
  detalle: (string | null | undefined)[];
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-border-base bg-surface/40 px-4 py-3 hover:border-border-glow">
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color || "#3a3f55" }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">{titulo}</span>
        <span className="block truncate text-xs text-fg-muted">{detalle.filter(Boolean).join(" · ")}</span>
      </span>
      {children}
    </Link>
  );
}

function Vacio() {
  return <p className="py-10 text-center text-sm italic text-fg-muted">Nada todavía.</p>;
}
