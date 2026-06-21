// Supabase Edge Function — auto-set city celebration banners from a sports API.
//
// For each metro's team it pulls the NEXT scheduled game from TheSportsDB (free)
// and sets a "find a watch party" celebration. Upserts public.celebrations
// (read by the app on load). Idempotent; run on a schedule (see migration_007
// for the cron pattern, pointed at this function).
//
// Deploy:  supabase functions deploy ingest-sports-celebrations
// Secret (optional): SPORTSDB_KEY (default '3' = free tier).
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected.)
//
// ⚠️ Scaffold: TheSportsDB shapes/team names vary — verify and adjust the TEAMS
// map and field mapping. For a true "Congratulations <Team> — Champions!" set
// that row manually (or extend this to read standings/championship results).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const KEY = Deno.env.get("SPORTSDB_KEY") ?? "3";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// city_id → { team name (as TheSportsDB knows it), emoji, gradient }
const TEAMS: Record<string, { team: string; emoji: string; gradient: string }> = {
  nyc:     { team: "New York Knicks",     emoji: "🏀", gradient: "linear-gradient(135deg,#F58426,#1D428A)" },
  la:      { team: "Los Angeles Lakers",  emoji: "🏀", gradient: "linear-gradient(135deg,#552583,#FDB927)" },
  atlanta: { team: "Atlanta Hawks",       emoji: "🏀", gradient: "linear-gradient(135deg,#E03A3E,#26282A)" },
  miami:   { team: "Miami Heat",          emoji: "🔥", gradient: "linear-gradient(135deg,#98002E,#F9A01B)" },
  chicago: { team: "Chicago Bulls",       emoji: "🏀", gradient: "linear-gradient(135deg,#CE1141,#000000)" },
  houston: { team: "Houston Rockets",     emoji: "🚀", gradient: "linear-gradient(135deg,#CE1141,#000000)" },
  dallas:  { team: "Dallas Mavericks",    emoji: "⭐", gradient: "linear-gradient(135deg,#00538C,#041E42)" },
  dc:      { team: "Washington Wizards",  emoji: "🏀", gradient: "linear-gradient(135deg,#002B5C,#E31837)" },
};
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

async function nextGameText(teamName: string): Promise<string | null> {
  try {
    const s = await (await fetch(`https://www.thesportsdb.com/api/v1/json/${KEY}/searchteams.php?t=${encodeURIComponent(teamName)}`)).json();
    const id = s?.teams?.[0]?.idTeam;
    if (!id) return null;
    const ev = await (await fetch(`https://www.thesportsdb.com/api/v1/json/${KEY}/eventsnext.php?id=${id}`)).json();
    const g = ev?.events?.[0];
    if (!g) return `${teamName} season is on — find a watch party`;
    const opp = (g.strEvent || "").replace(teamName, "").replace(/^\s*vs\.?\s*|\s*@\s*/i, "").trim();
    const when = g.dateEvent ? new Date(g.dateEvent + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "soon";
    return `${teamName}${opp ? ` vs ${opp}` : ""} ${when} — find a watch party`;
  } catch { return null; }
}

Deno.serve(async () => {
  const rows: any[] = [];
  for (const [city_id, t] of Object.entries(TEAMS)) {
    const text = await nextGameText(t.team);
    if (text) rows.push({ city_id, emoji: t.emoji, text, gradient: t.gradient, active: true, updated_at: new Date().toISOString() });
  }
  if (!rows.length) return json({ upserted: 0, note: "no games found — check TEAMS / API" });
  const { error } = await admin.from("celebrations").upsert(rows, { onConflict: "city_id" });
  if (error) return json({ error: error.message }, 500);
  return json({ upserted: rows.length });
});
