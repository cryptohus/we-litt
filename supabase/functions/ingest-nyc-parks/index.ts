// Supabase Edge Function — ingest free NYC Parks events (e.g. SummerStage) from
// NYC Open Data (Socrata). Upserts into events (source='nyc-parks', keyed by
// external_id). Idempotent; curated/Ticketmaster rows are untouched.
//
// Deploy:  supabase functions deploy ingest-nyc-parks
// Secrets (optional): NYC_OPENDATA_APP_TOKEN (raises Socrata rate limit),
//                     NYC_PARKS_DATASET (Socrata resource id; default below).
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
//
// ⚠️ Socrata datasets vary in field names. This maps defensively and is
// configurable — verify field mapping against your chosen dataset and adjust.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
const APP_TOKEN = Deno.env.get("NYC_OPENDATA_APP_TOKEN") ?? "";
const DATASET = Deno.env.get("NYC_PARKS_DATASET") ?? "fudw-fgrp"; // NYC Parks Events Listing
const NYC = { lat: 40.73, lng: -73.94 };
const CONCERT_GRADIENT = "linear-gradient(135deg,#1D4ED8,#7C3AED)";

const num = (v: any) => { const n = Number(v); return isFinite(n) ? n : null; };
const pick = (o: any, keys: string[]) => { for (const k of keys) if (o[k] != null && o[k] !== "") return o[k]; return null; };
const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

function mapRow(d: any) {
  const title = pick(d, ["title", "name", "event_name"]);
  if (!title) return null;
  const lat = num(pick(d, ["latitude", "lat"])) ?? (d.location?.latitude ? num(d.location.latitude) : null);
  const lng = num(pick(d, ["longitude", "lng", "lon"])) ?? (d.location?.longitude ? num(d.location.longitude) : null);
  const dateRaw = pick(d, ["start_date_time", "date", "startdate", "start"]);
  const dt = dateRaw ? new Date(dateRaw) : null;
  return {
    external_id: `nycparks_${(pick(d, ["event_id", "id"]) || title).toString().slice(0, 80)}`,
    source: "nyc-parks",
    city_id: "nyc",
    name: String(title),
    type: "concert",
    type_label: pick(d, ["categories", "event_type"]) || "Free Event",
    venue: pick(d, ["location_name", "parknames", "location_1", "location"]) || "NYC Parks",
    neighborhood: pick(d, ["borough"]) || "New York, NY",
    date: dt && !isNaN(+dt) ? dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "TBD",
    time: dt && !isNaN(+dt) ? dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
    price: "Free",
    litt_score: 82, rating: 0, reviews: 0, going: 0,
    lat: lat ?? NYC.lat, lng: lng ?? NYC.lng,   // fall back to NYC center if no coords
    vibes: ["🌳 NYC Parks", "🆓 Free"],
    description: pick(d, ["description", "snippet"]) || `${title} — a free NYC Parks event.`,
    emoji: "🌳", gradient: CONCERT_GRADIENT,
    featured: false, trending: false, tonight: false,
  };
}

Deno.serve(async () => {
  try {
    const url = `https://data.cityofnewyork.us/resource/${DATASET}.json?$limit=200`;
    const res = await fetch(url, APP_TOKEN ? { headers: { "X-App-Token": APP_TOKEN } } : {});
    if (!res.ok) throw new Error(`socrata ${res.status}`);
    const data = await res.json();
    const rows = (Array.isArray(data) ? data : []).map(mapRow).filter(Boolean);
    if (!rows.length) return json({ upserted: 0, note: "no rows — check NYC_PARKS_DATASET / field mapping" });
    const { error } = await admin.from("events").upsert(rows, { onConflict: "external_id" });
    if (error) throw error;
    return json({ upserted: rows.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
