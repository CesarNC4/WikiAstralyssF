import { cn } from "@/lib/utils";

type BadgeTone = "default" | "primary" | "accent" | "secondary" | "rareza" | "amenaza";

const RAREZA: Record<string, string> = {
  comun: "text-rarity-comun border-rarity-comun/40",
  común: "text-rarity-comun border-rarity-comun/40",
  raro: "text-rarity-raro border-rarity-raro/40",
  epico: "text-rarity-epico border-rarity-epico/40",
  épico: "text-rarity-epico border-rarity-epico/40",
  legendario: "text-rarity-legendario border-rarity-legendario/40",
  mitico: "text-rarity-mitico border-rarity-mitico/40",
  mítico: "text-rarity-mitico border-rarity-mitico/40",
};

const TONES: Record<BadgeTone, string> = {
  default: "text-fg-secondary border-border-base bg-surface/60",
  primary: "text-primary border-primary/40 bg-primary/10",
  accent: "text-accent border-accent/40 bg-accent/10",
  secondary: "text-secondary border-secondary/40 bg-secondary/10",
  rareza: "border bg-surface/60",
  amenaza: "text-error border-error/40 bg-error/10",
};

export function Badge({
  children,
  tone = "default",
  rarezaKey,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  rarezaKey?: string | null;
  className?: string;
}) {
  const rarezaCls = rarezaKey ? RAREZA[rarezaKey.toLowerCase()] : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide backdrop-blur-sm",
        tone === "rareza" && rarezaCls ? `${TONES.rareza} ${rarezaCls}` : TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
