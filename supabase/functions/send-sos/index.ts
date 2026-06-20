// Supabase Edge Function — send an emergency SMS via Twilio.
//
// Deploy:  supabase functions deploy send-sos
// Secrets: supabase secrets set TWILIO_ACCOUNT_SID=AC... \
//                              TWILIO_AUTH_TOKEN=... \
//                              TWILIO_FROM=+1XXXXXXXXXX
//
// Lets the Safety Center send alerts automatically (no "tap to send"). The app
// still falls back to the device messaging app if this isn't configured.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const FROM = Deno.env.get("TWILIO_FROM") ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!SID || !TOKEN || !FROM) throw new Error("Twilio env not set");
    const { to, body } = await req.json(); // to: string[]
    if (!Array.isArray(to) || !to.length || !body) throw new Error("missing to/body");

    const results: any[] = [];
    for (const num of to) {
      const form = new URLSearchParams({ To: String(num), From: FROM, Body: String(body) });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${SID}:${TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        },
      );
      results.push({ to: num, ok: res.ok, status: res.status });
    }
    return new Response(JSON.stringify({ results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
