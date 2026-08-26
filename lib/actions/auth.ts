"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { adminActual } from "@/lib/auth/admin";

/** Verifica que hay un admin autenticado (§12.1, defensa en profundidad). */
export async function assertAdmin() {
  const user = await adminActual();
  if (!user) redirect("/admin/login");
  return user;
}

/** Login email/password (§12.3). */
export async function signInAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Credenciales inválidas." };
  redirect("/admin");
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
