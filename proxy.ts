import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Proxy (Next 16) — protege /admin/* y refresca la sesión (§12.1). */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
