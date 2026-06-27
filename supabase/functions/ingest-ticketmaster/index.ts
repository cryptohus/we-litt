// Supabase Edge Function — ingest events from the Ticketmaster Discovery API.
//
// Pulls upcoming music events near each We Litt metro and upserts them into the
// events table (source='ticketmaster', keyed by external_id). Idempotent — safe
// to run on a schedule. Curated events (source='curated') are never touched.
//
// Deploy:   supabase functions deploy ingest-ticketmaster
// Secret:   supabase secrets set TICKETMASTER_API_KEY=...
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
// Schedule (optional): supabase cron, or call the URL daily.
//
// Tip: pass ?free=1 to only ingest free events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const TM_KEY = Deno.env.get("TICKETMASTER_API_KEY") ?? "";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// We Litt metros (id must match public.cities.id) + gradient for the type.
const METROS = [
  { id: "atlanta", lat: 33.749, lng: -84.388 },
  { id: "miami", lat: 25.774, lng: -80.19 },
  { id: "nyc", lat: 40.73, lng: -73.935 },
  { id: "la", lat: 34.052, lng: -118.243 },
  { id: "houston", lat: 29.76, lng: -95.37 },
  { id: "chicago", lat: 41.878, lng: -87.63 },
  { id: "dallas", lat: 32.776, lng: -96.797 },
  { id: "dc", lat: 38.907, lng: -77.037 },
];
const CONCERT_GRADIENT = "linear-gradient(135deg,#1D4ED8,#7C3AED)";

function fmtDate(d?: string) {
  if (!d) return "TBD";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Ticketmaster status code → our status (so cancelled/postponed get hidden).
function mapStatus(code?: string) {
  const c = String(code || "").toLowerCase();
  if (c === "cancelled" || c === "canceled") return "cancelled";
  if (c === "postponed" || c === "rescheduled") return "postponed";
  return "active";
}
function mapEvent(ev: any, metroId: string) {
  const venue = ev._embedded?.venues?.[0];
  const loc = venue?.location;
  const pr = ev.priceRanges?.[0];
  const isFree = pr && Number(pr.min) === 0;
  const price = pr ? (isFree ? "Free" : `From $${Math.round(pr.min)}`) : "See tickets";
  // Real timestamp: prefer the absolute dateTime; fall back to local date @ noon.
  const startIso = ev.dates?.start?.dateTime
    || (ev.dates?.start?.localDate ? `${ev.dates.start.localDate}T${ev.dates.start.localTime || "20:00:00"}` : null);
  return {
    external_id: `tm_${ev.id}`,
    source: "ticketmaster",
    city_id: metroId,
    name: ev.name,
    type: "concert",
    type_label: ev.classifications?.[0]?.genre?.name || "Concert",
    venue: venue?.name || "",
    neighborhood: [venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", "),
    date: fmtDate(ev.dates?.start?.localDate),
    time: fmtTime(ev.dates?.start?.localTime),
    starts_at: startIso,                 // real start → app uses this, not the string
    status: mapStatus(ev.dates?.status?.code),
    url: ev.url || null,
    last_seen_at: new Date().toISOString(),
    price,
    litt_score: 80,
    rating: 0, reviews: 0, going: 0,
    lat: loc ? Number(loc.latitude) : null,
    lng: loc ? Number(loc.longitude) : null,
    vibes: ["🎟️ Ticketmaster", ev.classifications?.[0]?.genre?.name || "Live"].filter(Boolean),
    description: ev.info || ev.pleaseNote || `${ev.name} — via Ticketmaster.`,
    emoji: "🎵",
    gradient: CONCERT_GRADIENT,
    featured: false, trending: false, tonight: false,
  };
}

Deno.serve(async (req) => {
  try {
    if (!TM_KEY) throw new Error("TICKETMASTER_API_KEY not set");
    const freeOnly = new URL(req.url).searchParams.get("free") === "1";
    let total = 0;
    const errors: string[] = [];

    for (const m of METROS) {
      const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
      url.searchParams.set("apikey", TM_KEY);
      url.searchParams.set("latlong", `${m.lat},${m.lng}`);
      url.searchParams.set("radius", "50");
      url.searchParams.set("unit", "miles");
      url.searchParams.set("classificationName", "music");
      url.searchParams.set("size", "50");
      url.searchParams.set("sort", "date,asc");
      const res = await fetch(url.toString());
      if (!res.ok) { errors.push(`${m.id}: ${res.status}`); continue; }
      const json = await res.json();
      let rows = (json._embedded?.events || [])
        .map((e: any) => mapEvent(e, m.id))
        .filter((r: any) => r.lat != null && r.lng != null);
      if (freeOnly) rows = rows.filter((r: any) => r.price === "Free");
      if (!rows.length) continue;
      const { error } = await admin.from("events").upsert(rows, { onConflict: "external_id" });
      if (error) errors.push(`${m.id}: ${error.message}`);
      else total += rows.length;
    }

    return new Response(JSON.stringify({ upserted: total, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
