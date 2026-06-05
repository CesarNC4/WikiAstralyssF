import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Trunca un texto a n caracteres con elipsis. */
export function truncate(text: string | null | undefined, n: number): string {
  if (!text) return "";
  return text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text;
}

/**
 * Inserta transformaciones de Cloudinary (f_auto,q_auto) en una URL de entrega
 * para reducir el peso servido. No-op si no es una URL de Cloudinary.
 */
export function cldOptimize(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (/\/upload\/(f_|q_|c_|w_|h_)/.test(url)) return url; // ya transformada
  return url.replace("/upload/", "/upload/f_auto,q_auto/");
}

/** Inicial(es) para avatares de fallback. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
