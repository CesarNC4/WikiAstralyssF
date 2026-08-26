import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Admin autenticado, o `null` si no lo hay. **No redirige.**
 *
 * Las rutas de API necesitan responder con un código de estado; una redirección
 * a la página de login devolvería HTML, que el widget de subida no sabe
 * interpretar (se quedaría colgado sin decir por qué). `assertAdmin` se apoya en
 * esta comprobación y sí redirige, que es lo correcto en una Server Action.
 *
 * Vive fuera de `lib/actions/` a propósito: ese módulo es `"use server"` y todo
 * lo que exporta queda expuesto como endpoint invocable por red.
 */
export async function adminActual() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email !== adminEmail) return null;
  return user;
}
