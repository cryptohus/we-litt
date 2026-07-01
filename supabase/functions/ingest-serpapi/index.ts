// Supabase Edge Function — ingest public events via SerpApi's Google Events engine.
//
// Eventbrite removed its public event-search API in Dec 2019, so Google Events
// (through SerpApi) is the closest working way to *discover* events near a city.
// This pulls events for each We Litt metro and upserts them into the events
// table (source='serpapi', keyed by external_id). Idempotent — safe to re-run
// on a schedule; curated rows (source='curated') are never touched.
//
// IMPORTANT: writes only columns that exist on the live events table today
// (no gradient/url/starts_at/status — those live in unapplied migrations).
//
// Deploy:   supabase functions deploy ingest-serpapi
// Secret:   supabase secrets set SERPAPI_API_KEY=...
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
//
// Query params:
//   ?pages=N   pages per metro (~10 events each). Default 1. Each page costs one
//              SerpApi search credit, so a full run = pages × 8 credits. The free
//              SerpApi plan is ~100 searches/month — keep pages low.
//   ?city=ID   restrict to one metro (atlanta|miami|nyc|la|houston|chicago|
//              dallas|dc) to save credits while testing.
//   ?free=1    keep only events that look free.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const SERP_KEY = Deno.env.get("SERPAPI_API_KEY") ?? "";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// metro id must match public.cities(id); q/loc drive the Google Events search.
const METROS = [
  { id: "atlanta", q: "Atlanta",       loc: "Atlanta, Georgia" },
  { id: "miami",   q: "Miami",         loc: "Miami, Florida" },
  { id: "nyc",     q: "New York City", loc: "New York, New York" },
  { id: "la",      q: "Los Angeles",   loc: "Los Angeles, California" },
  { id: "houston", q: "Houston",       loc: "Houston, Texas" },
  { id: "chicago", q: "Chicago",       loc: "Chicago, Illinois" },
  { id: "dallas",  q: "Dallas",        loc: "Dallas, Texas" },
  { id: "dc",      q: "Washington DC", loc: "Washington, District of Columbia" },
];

// Community/civic-leaning query set. To keep the community character without
// burning extra SerpApi credits, we ROTATE one query per run (weekly), so over
// a few weeks all facets get covered at the same per-run cost. Override with ?q=.
const QUERIES = [
  "Events",
  "Free events",
  "Block parties and street festivals",
  "Festivals and cultural events",
  "Live music and concerts",
  "Day parties and community events",
];

// Best-effort ISO start from Google Events' "Jul 17" + time (pins the year;
// rolls to next year if it lands far in the past). Enables real timeline + prune.
function toIso(startDate: string, timeStr: string): string | null {
  if (!startDate) return null;
  const now = new Date();
  let d = new Date(`${startDate}, ${now.getFullYear()} ${timeStr || ""}`.trim());
  if (isNaN(+d)) d = new Date(`${startDate}, ${now.getFullYear()}`);
  if (isNaN(+d)) return null;
  if (+d < +now - 120 * 86400000) d.setFullYear(now.getFullYear() + 1);
  return d.toISOString();
}

// Upsert that self-heals if migration_016 columns aren't applied yet: on a
// "column does not exist" schema error it retries without the optional fields.
const OPTIONAL_COLS = ["starts_at", "ends_at", "status", "last_seen_at", "venue_status", "place_id"];
async function upsertEvents(rows: any[]): Promise<string | null> {
  let { error } = await admin.from("events").upsert(rows, { onConflict: "external_id" });
  if (error && /does not exist|schema cache|PGRST204/i.test(error.message || "")) {
    const stripped = rows.map((r) => { const c = { ...r }; OPTIONAL_COLS.forEach((k) => delete c[k]); return c; });
    ({ error } = await admin.from("events").upsert(stripped, { onConflict: "external_id" }));
  }
  return error ? error.message : null;
}

// Stable id from title+date+venue so re-runs update the same row (no dupes).
async function hashId(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function looksFree(ev: any): boolean {
  const hay = (JSON.stringify(ev.ticket_info || []) + " " + (ev.title || "")).toLowerCase();
  return /\bfree\b/.test(hay);
}

async function mapEvent(ev: any, metroId: string) {
  const venueName = ev.venue?.name || (Array.isArray(ev.address) ? ev.address[0] : "") || "";
  const addr = Array.isArray(ev.address) ? ev.address.join(", ") : (ev.address || "");
  const link = ev.link || ev.ticket_info?.[0]?.link || "";
  // Store an ABSOLUTE date ("Jul 17") — the app's parseEventDate reads "Mon DD"
  // and pins the year. The "when" string ("Today, 7:30 – 9 PM") goes stale and
  // isn't parseable, so those events would dodge every date filter.
  const startDate = ev.date?.start_date || "";
  const when = ev.date?.when || "";
  const time = when.split(",").map((s: string) => s.trim())
    .find((p: string) => /\d/.test(p) && /(am|pm|:)/i.test(p)) || "";
  const desc = String(ev.description || `${ev.title} — found via Google Events.`).trim();
  const ext = "sa_" + (await hashId(`${ev.title}|${startDate}|${venueName}`));
  const rating = Number(ev.venue?.rating);
  return {
    external_id: ext,
    source: "serpapi",
    city_id: metroId,
    name: ev.title || "Untitled event",
    type: "event",
    type_label: "Event",
    venue: venueName,
    neighborhood: addr,
    date: startDate || when || "TBD",
    time,
    starts_at: toIso(startDate, time),  // real timestamp (self-heals if col absent)
    last_seen_at: new Date().toISOString(),
    price: looksFree(ev) ? "Free" : "See tickets",
    litt_score: 72,
    rating: Number.isFinite(rating) && rating <= 9.9 ? rating : 0,
    reviews: Number(ev.venue?.reviews) || 0,
    going: 0,
    lat: null,                 // Google Events doesn't return coords → list/search only
    lng: null,
    url: link || null,         // real ticket/source link → app's "Get Tickets" deep-links here
    vibes: ["🔎 Google Events"],
    description: desc,
    emoji: "📅",
    featured: false,
    trending: false,
    tonight: false,
  };
}

Deno.serve(async (req) => {
  try {
    if (!SERP_KEY) throw new Error("SERPAPI_API_KEY not set");
    const p = new URL(req.url).searchParams;
    const pages = Math.max(1, Math.min(5, Number(p.get("pages") || "1")));
    const onlyCity = p.get("city");
    const freeOnly = p.get("free") === "1";
    const metros = onlyCity ? METROS.filter((m) => m.id === onlyCity) : METROS;
    // Rotate the community query weekly (or override with ?q=) — same credit cost.
    const weekIdx = Math.floor(Date.now() / (7 * 86400000)) % QUERIES.length;
    const qBase = p.get("q") || QUERIES[weekIdx];

    let upserted = 0, searches = 0;
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const m of metros) {
      for (let pg = 0; pg < pages; pg++) {
        const url = new URL("https://serpapi.com/search.json");
        url.searchParams.set("engine", "google_events");
        url.searchParams.set("q", `${qBase} in ${m.q}`);
        url.searchParams.set("location", m.loc);
        url.searchParams.set("hl", "en");
        url.searchParams.set("gl", "us");
        url.searchParams.set("start", String(pg * 10));
        url.searchParams.set("api_key", SERP_KEY);
        searches++;

        const res = await fetch(url.toString());
        if (!res.ok) { errors.push(`${m.id} p${pg}: HTTP ${res.status}`); break; }
        const json = await res.json();
        if (json.error) { errors.push(`${m.id} p${pg}: ${json.error}`); break; }

        const items = json.events_results || [];
        if (!items.length) break; // no more pages for this metro

        const rows: any[] = [];
        for (const ev of items) {
          if (freeOnly && !looksFree(ev)) continue;
          const row = await mapEvent(ev, m.id);
          if (seen.has(row.external_id)) continue; // de-dupe within this run
          seen.add(row.external_id);
          rows.push(row);
        }
        if (!rows.length) continue;

        const err = await upsertEvents(rows);
        if (err) errors.push(`${m.id} p${pg}: ${err}`);
        else upserted += rows.length;
      }
    }

    return new Response(JSON.stringify({ upserted, searches, errors }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
