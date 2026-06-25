// Supabase Edge Function — delete the caller's own account.
//
// App Store requires in-app account deletion. Verifies the user's JWT, then
// deletes the auth user with the service role. Every user-data table FKs
// auth.users(id) ON DELETE CASCADE, so this removes all their rows too.
//
// Deploy:  supabase functions deploy delete-account
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (already set if you did the
//          Stripe webhook). No extra secrets needed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) throw new Error("no token");
    // Identify the caller from their JWT — a user can only delete themselves.
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
