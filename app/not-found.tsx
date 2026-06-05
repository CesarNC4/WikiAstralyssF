import Link from "next/link";

/** 404 global temático (§17). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-7xl text-gradient-cosmic md:text-9xl">404</p>
      <h1 className="mt-4 font-display text-2xl text-fg">Perdido en el vacío</h1>
      <p className="mt-2 max-w-md text-fg-secondary">
        Esta página se ha desvanecido entre las estrellas de Astralys. Quizá nunca
        existió, o el cosmos la reclamó.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-primary px-6 py-3 font-medium text-void transition-transform hover:scale-105 hover:shadow-[var(--shadow-glow-primary)]"
      >
        Volver al cosmos
      </Link>
    </div>
  );
}
