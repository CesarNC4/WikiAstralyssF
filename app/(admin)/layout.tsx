import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Astralys",
  robots: { index: false, follow: false },
};

/** Shell de admin (§3.1) — sin navegación pública. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-void">{children}</div>;
}
