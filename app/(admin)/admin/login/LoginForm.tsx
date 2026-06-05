"use client";

import { useActionState } from "react";
import { signInAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-fg-secondary">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-border-base bg-surface px-3 py-2.5 text-fg outline-none focus:border-border-glow"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-fg-secondary">Contraseña</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-border-base bg-surface px-3 py-2.5 text-fg outline-none focus:border-border-glow"
        />
      </div>
      {state?.error && <p className="text-sm text-error">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary py-2.5 font-medium text-void transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
