// Quick local smoke test for the SerpApi Google Events integration.
// Proves your key works and shows what We Litt will ingest — no Supabase needed.
//
//   SERPAPI_API_KEY=your_key node scripts/test-serpapi.mjs            # default: Atlanta
//   SERPAPI_API_KEY=your_key node scripts/test-serpapi.mjs "Miami, Florida"
//
// Each run costs ONE SerpApi search credit (free plan ≈ 100/month).

const KEY = process.env.SERPAPI_API_KEY;
if (!KEY) {
  console.error("✗ SERPAPI_API_KEY is not set.\n  Run:  SERPAPI_API_KEY=your_key node scripts/test-serpapi.mjs");
  process.exit(1);
}

const location = process.argv[2] || "Atlanta, Georgia";
const city = location.split(",")[0];

const url = new URL("https://serpapi.com/search.json");
url.searchParams.set("engine", "google_events");
url.searchParams.set("q", `Events in ${city}`);
url.searchParams.set("location", location);
url.searchParams.set("hl", "en");
url.searchParams.set("gl", "us");
url.searchParams.set("api_key", KEY);

console.log(`Searching Google Events for "${city}" (${location})…\n`);

const res = await fetch(url);
const json = await res.json();

if (json.error) {
  console.error(`✗ SerpApi error: ${json.error}`);
  process.exit(1);
}

const events = json.events_results || [];
console.log(`✓ ${events.length} events returned. First few:\n`);

for (const ev of events.slice(0, 6)) {
  const venue = ev.venue?.name || (Array.isArray(ev.address) ? ev.address[0] : "") || "—";
  const when = ev.date?.when || ev.date?.start_date || "TBD";
  console.log(`  • ${ev.title}`);
  console.log(`    ${when}  @  ${venue}`);
  if (ev.link) console.log(`    ${ev.link}`);
  console.log("");
}

if (events.length === 0) {
  console.log("  (No events — try a different location string, e.g. \"Miami, Florida\".)");
}
