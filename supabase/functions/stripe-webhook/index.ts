// Supabase Edge Function — Stripe webhook: record the ticket after payment.
//
// Guarantees fulfillment even if the buyer's browser never returns from Checkout.
// Idempotent: upserts the tickets row by its app id, so it converges with the
// client-side finalize (no duplicates).
//
// Deploy:   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets:  supabase secrets set STRIPE_SECRET_KEY=sk_... \
//                               STRIPE_WEBHOOK_SECRET=whsec_... \
//                               SUPABASE_URL=https://<ref>.supabase.co \
//                               SUPABASE_SERVICE_ROLE_KEY=...   (service role — server only!)
// Then in Stripe → Developers → Webhooks, add the function URL and subscribe to
// `checkout.session.completed`.
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" });
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",   // bypasses RLS — server only
);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Bad signature: ${e}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const m = (event.data.object as any).metadata || {};
    try {
      if (!m.ticket_id || !m.user_id) throw new Error("missing metadata");
      // Denormalize event details from the catalog (don't trust the client for these).
      const { data: ev } = await admin.from("events").select("*").eq("id", Number(m.event_id)).single();
      await admin.from("tickets").upsert({
        id: m.ticket_id,
        user_id: m.user_id,
        event_id: m.event_id ? Number(m.event_id) : null,
        kind: m.kind || "ticket",
        code: m.code || null,
        event_name: ev?.name ?? null,
        venue: ev?.venue ?? null,
        neighborhood: ev?.neighborhood ?? null,
        emoji: ev?.emoji ?? null,
        gradient: ev?.gradient ?? null,
        date: ev?.date ?? null,
        time: ev?.["time"] ?? null,
        qty_ga: Number(m.qty_ga || 0),
        qty_vip: Number(m.qty_vip || 0),
        total: Number(m.total || 0),
        status: "paid",
      });
    } catch (e) {
      console.error("fulfill error", e);
      return new Response("fulfill error", { status: 500 }); // Stripe will retry
    }
  }
  return new Response("ok", { status: 200 });
});
