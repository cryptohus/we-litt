// Supabase Edge Function — create a Stripe Checkout Session for event tickets.
//
// Deploy:   supabase functions deploy create-checkout
// Secret:   supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
//
// Note: tickets to in-person events are "physical services" and may use Stripe
// (no Apple IAP). The Litt Pass subscription is digital and must use Apple IAP
// on iOS — do NOT route it through here. See docs/ios-compliance.md.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!STRIPE_SECRET) throw new Error("STRIPE_SECRET_KEY not set");
    // items: [{ name, amount /* cents */, qty }]
    const { items, successUrl, cancelUrl } = await req.json();
    if (!Array.isArray(items) || !items.length) throw new Error("no items");

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", successUrl);
    form.set("cancel_url", cancelUrl);
    items.forEach((it: any, i: number) => {
      form.set(`line_items[${i}][price_data][currency]`, "usd");
      form.set(`line_items[${i}][price_data][product_data][name]`, String(it.name));
      form.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(it.amount)));
      form.set(`line_items[${i}][quantity]`, String(it.qty || 1));
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const session = await res.json();
    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
