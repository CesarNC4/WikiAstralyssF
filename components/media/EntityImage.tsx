import Image from "next/image";
import { cn, initials, cldOptimize } from "@/lib/utils";

/**
 * Imagen de entidad con fallback temático cuando no hay imagen_url (§5.1).
 * Sirve desde R2/Supabase (configurado en next.config remotePatterns).
 */
export function EntityImage({
  src,
  alt,
  name,
  fill = true,
  width,
  height,
  className,
  priority = false,
  sizes = "(max-width: 768px) 50vw, 25vw",
}: {
  src: string | null | undefined;
  alt: string;
  name?: string | null;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  src = cldOptimize(src);
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-elevated to-deep",
          fill ? "absolute inset-0" : "",
          className,
        )}
        style={!fill ? { width, height } : undefined}
        aria-label={alt}
      >
        <span className="font-display text-3xl text-border-glow select-none">
          {initials(name ?? alt)}
        </span>
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 400}
      height={height ?? 400}
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}
