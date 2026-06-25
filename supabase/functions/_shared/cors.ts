// Shared CORS helper for browser-called Edge Functions.
//
// Locks Access-Control-Allow-Origin to an allowlist instead of "*". The request's
// Origin is echoed back only if it is on the list (so credentials/headers are not
// exposed to arbitrary sites). Override the list with the ALLOWED_ORIGINS secret
// (comma-separated), e.g.:
//   supabase secrets set ALLOWED_ORIGINS="https://welitt.app,https://cryptohus.github.io"
//
// Default covers both the planned custom domain and the current GitHub Pages host
// so launching on either works without a redeploy.
const DEFAULT_ALLOWED = "https://welitt.app,https://cryptohus.github.io";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ALLOWED)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  // Echo the caller's origin when allowed; otherwise fall back to the first
  // allowed origin (a disallowed browser will block the response).
  const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
