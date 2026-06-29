// Supabase Edge Function — drop cross-source duplicate events.
//
// SerpApi (Google Events) and Ticketmaster both surface the same big concerts
// (e.g. Shakira shows up from both). Ticketmaster is the richer copy — real
// coordinates (map pins), clean dates, and a real ticket link — so when a
// SerpApi event matches a Ticketmaster event in the same city, we delete the
// SerpApi copy and keep Ticketmaster's.
//
// SAFETY: only ever deletes rows where source='serpapi'. Ticketmaster and
// curated events are never touched. Idempotent — safe to run after every ingest.
//
// Deploy:   supabase functions deploy dedupe-events
// Preview:  curl ".../dedupe-events?dry=1"   → lists matches, deletes nothing
// Run:      curl ".../dedupe-events"         → deletes the SerpApi duplicates
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Strip to lowercase alphanumerics so "SHAKIRA - LAS MUJERES…" and
// "Shakira: Las Mujeres…" collapse to the same comparable string.
function norm(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Two names match when one normalized form is a prefix of the other (catches
// "Shakira…World Tour" vs "Shakira…World Tour | World Cup Edition"). The 6-char
// floor avoids trivial collisions on very short names.
function namesMatch(a: string, b: string): boolean {
  if (a.length < 6 || b.length < 6) return false;
  return a.startsWith(b) || b.startsWith(a);
}

Deno.serve(async (req) => {
  try {
    const dry = new URL(req.url).searchParams.get("dry") === "1";

    const [tmRes, saRes] = await Promise.all([
      admin.from("events").select("id,city_id,name").eq("source", "ticketmaster"),
      admin.from("events").select("id,city_id,name").eq("source", "serpapi"),
    ]);
    if (tmRes.error) throw tmRes.error;
    if (saRes.error) throw saRes.error;

    // Index Ticketmaster names by city for quick lookup.
    const tmByCity = new Map<string, string[]>();
    for (const t of tmRes.data || []) {
      const arr = tmByCity.get(t.city_id) || [];
      arr.push(norm(t.name));
      tmByCity.set(t.city_id, arr);
    }

    const dupes: { id: number; name: string; city_id: string }[] = [];
    for (const s of saRes.data || []) {
      const sNorm = norm(s.name);
      const tmNames = tmByCity.get(s.city_id) || [];
      if (tmNames.some((tn) => namesMatch(sNorm, tn))) {
        dupes.push({ id: s.id, name: s.name, city_id: s.city_id });
      }
    }

    let deleted = 0;
    if (!dry && dupes.length) {
      const ids = dupes.map((d) => d.id);
      const { error } = await admin.from("events")
        .delete().eq("source", "serpapi").in("id", ids); // belt-and-suspenders: source guard
      if (error) throw error;
      deleted = ids.length;
    }

    return new Response(JSON.stringify({
      dry_run: dry,
      ticketmaster_events: tmRes.data?.length || 0,
      serpapi_events: saRes.data?.length || 0,
      duplicates_found: dupes.length,
      deleted,
      sample: dupes.slice(0, 15).map((d) => `${d.city_id}: ${d.name}`),
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
