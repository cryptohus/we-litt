// Supabase Edge Function — keep the catalog current by removing dead listings.
//
// Deletes ingested events that have passed, been cancelled, whose venue closed,
// or that ingestion hasn't seen in a while (likely removed at the source). The
// app already hides these client-side via isShowable(); this keeps the DB lean
// and authoritative. Curated rows (source='curated') are never deleted here.
//
// Deploy:   supabase functions deploy prune-events
// Schedule: daily (see migration_017_cron_refresh.sql).
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async () => {
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 2 * 86400000).toISOString(); // not seen in 2 days
  const out: Record<string, number | string> = {};
  try {
    // 1) Past ingested events (their real start is already gone).
    const past = await admin.from("events").delete({ count: "exact" })
      .neq("source", "curated").not("starts_at", "is", null).lt("starts_at", now);
    out.past = past.count ?? 0;

    // 2) Cancelled / postponed ingested events.
    const cancelled = await admin.from("events").delete({ count: "exact" })
      .neq("source", "curated").in("status", ["cancelled", "postponed"]);
    out.cancelled = cancelled.count ?? 0;

    // 3) Permanently-closed venues (any source — catches closed real venues).
    const closed = await admin.from("events").delete({ count: "exact" })
      .eq("venue_status", "CLOSED_PERMANENTLY");
    out.closed = closed.count ?? 0;

    // 4) Stale ingested rows — gone from the source feed for 2+ days.
    const gone = await admin.from("events").delete({ count: "exact" })
      .neq("source", "curated").lt("last_seen_at", stale);
    out.stale = gone.count ?? 0;

    return new Response(JSON.stringify({ pruned: out }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
