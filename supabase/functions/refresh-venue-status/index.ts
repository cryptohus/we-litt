// Supabase Edge Function — verify venues are actually open (Google Places).
//
// For each distinct venue in the catalog it reads Google Places `business_status`
// (OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY) and writes it to every
// event at that venue. The app hides CLOSED_PERMANENTLY (isUnavailable); the
// pruner then deletes them. This is what catches a venue that quietly closed
// (e.g. the "Avant Gardner is listed but closed" case).
//
// Deploy:  supabase functions deploy refresh-venue-status
// Secret:  supabase secrets set GOOGLE_PLACES_KEY=...
// Schedule: daily, before prune (see migration_017_cron_refresh.sql).
//
// ⚠️ Scaffold — verify field names against the Places API version you enable and
// mind quota: it caps lookups per run (LIMIT) and reuses stored place_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY") ?? "";
const LIMIT = Number(Deno.env.get("VENUE_LOOKUP_LIMIT") ?? "60"); // per run, for quota
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

// Resolve a venue's place_id + business_status. Uses Find Place when we don't
// have an id yet, else Place Details (cheaper, exact).
async function lookup(v: { venue: string; lat: number | null; lng: number | null; place_id: string | null }) {
  if (v.place_id) {
    const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    u.searchParams.set("place_id", v.place_id);
    u.searchParams.set("fields", "business_status");
    u.searchParams.set("key", KEY);
    const r = await (await fetch(u)).json();
    return { place_id: v.place_id, business_status: r.result?.business_status };
  }
  const u = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  u.searchParams.set("input", v.venue);
  u.searchParams.set("inputtype", "textquery");
  u.searchParams.set("fields", "place_id,business_status");
  if (v.lat != null && v.lng != null) u.searchParams.set("locationbias", `point:${v.lat},${v.lng}`);
  u.searchParams.set("key", KEY);
  const r = await (await fetch(u)).json();
  const c = r.candidates?.[0];
  return { place_id: c?.place_id ?? null, business_status: c?.business_status ?? null };
}

Deno.serve(async () => {
  if (!KEY) return json({ error: "GOOGLE_PLACES_KEY not set" }, 500);
  // Distinct venues to check (skip blanks). Re-checking refreshes temporarily-closed.
  const { data, error } = await admin
    .from("events")
    .select("venue,lat,lng,place_id")
    .not("venue", "is", null).neq("venue", "")
    .limit(2000);
  if (error) return json({ error: error.message }, 500);

  const seen = new Set<string>();
  const venues = (data || []).filter((r) => { const k = r.venue.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, LIMIT);

  let updated = 0; const errors: string[] = [];
  for (const v of venues) {
    try {
      const { place_id, business_status } = await lookup(v as any);
      if (!business_status) continue;
      const { error: uErr } = await admin.from("events")
        .update({ venue_status: business_status, place_id: place_id || (v as any).place_id })
        .eq("venue", v.venue);
      if (uErr) errors.push(`${v.venue}: ${uErr.message}`); else updated++;
    } catch (e) { errors.push(`${v.venue}: ${String(e)}`); }
  }
  return json({ venues_checked: venues.length, venues_updated: updated, errors });
});
